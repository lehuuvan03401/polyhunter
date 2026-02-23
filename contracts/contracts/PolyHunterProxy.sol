// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title IPolymarketCTF
 * @notice Interface for Polymarket Conditional Token Framework
 */
interface IPolymarketCTF {
    function getPositionId(
        bytes32 conditionId,
        uint256 indexSet
    ) external pure returns (uint256);

    function balanceOf(
        address account,
        uint256 id
    ) external view returns (uint256);

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;
}

/**
 * @title ITreasury
 * @notice Interface for Treasury contract
 */
interface ITreasury {
    function receiveFee(uint256 amount) external;
}

/**
 * @title PolyHunterProxy
 * @notice User's personal trading proxy for Polymarket
 * @dev Handles deposits, trading execution, and automatic fee collection on withdrawal
 */
contract PolyHunterProxy is ReentrancyGuard, IERC1271 {
    using SafeERC20 for IERC20;

    // Owner (user) of this proxy
    address public immutable owner;

    // Platform treasury
    address public treasury;

    // Bound executor contract
    address public executor;

    // Pause switch for execution
    bool public paused;

    // Fee percentage in basis points (1000 = 10%, 500 = 5%, 200 = 2%)
    uint256 public feePercent;

    // USDC token
    IERC20 public immutable usdc;

    // Polymarket CTF Exchange (for position tracking)
    address public immutable ctfExchange;

    // Total amount deposited by user
    uint256 public totalDeposited;

    // Total amount withdrawn by user
    uint256 public totalWithdrawn;

    // Total fees paid
    uint256 public totalFeesPaid;

    // Factory that created this proxy
    address public immutable factory;

    // Events
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount, uint256 fee);
    event TreasuryUpdated(address newTreasury);
    event FeePercentUpdated(uint256 newFeePercent);
    event ExecutorUpdated(address newExecutor);
    event AllowedTargetUpdated(address indexed target, bool allowed);
    event ExecutionPaused(bool paused);

    // Allowed execution targets (CTF, USDC, etc.)
    mapping(address => bool) public allowedTargets;

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyExecutorOrOwner() {
        require(
            msg.sender == owner || msg.sender == executor,
            "Not authorized"
        );
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(
        address _owner,
        address _treasury,
        address _usdc,
        address _ctfExchange,
        address _executor,
        uint256 _feePercent
    ) {
        require(_owner != address(0), "Invalid owner");
        require(_treasury != address(0), "Invalid treasury");
        require(_usdc != address(0), "Invalid USDC");
        require(_ctfExchange != address(0), "Invalid CTF");
        require(_executor != address(0), "Invalid executor");
        require(_feePercent <= 2000, "Fee too high"); // Max 20%

        owner = _owner;
        treasury = _treasury;
        usdc = IERC20(_usdc);
        ctfExchange = _ctfExchange;
        executor = _executor;
        feePercent = _feePercent;
        factory = msg.sender;

        allowedTargets[_usdc] = true;
        allowedTargets[_ctfExchange] = true;
    }

    /**
     * @notice Deposit USDC into the proxy
     * @param amount Amount of USDC to deposit
     */
    function deposit(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be > 0");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited += amount;
        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Calculate pending fees based on Lifetime High Water Mark
     * @return fee Amount of USDC to pay as fee
     * @return profit Total lifetime profit
     */
    function _calculatePendingFee()
        internal
        view
        returns (uint256 fee, int256 profit)
    {
        uint256 balance = usdc.balanceOf(address(this));

        // Lifetime Profit = CurrentBalance + TotalWithdrawn + TotalFeesPaid - TotalDeposited
        // Using int256 to handle potential negative profit (losses)
        int256 totalValue = int256(balance) +
            int256(totalWithdrawn) +
            int256(totalFeesPaid);
        int256 lifetimeProfit = totalValue - int256(totalDeposited);

        if (lifetimeProfit > 0 && feePercent > 0) {
            uint256 totalFeesDue = (uint256(lifetimeProfit) * feePercent) /
                10000;
            if (totalFeesDue > totalFeesPaid) {
                fee = totalFeesDue - totalFeesPaid;
            }
        }

        return (fee, lifetimeProfit);
    }

    /**
     * @notice Settle any pending fees based on current profit
     * @dev Callable by Executor (Bot) or Owner to realize platform revenue
     */
    function settleFees() external onlyExecutorOrOwner nonReentrant {
        (uint256 fee, ) = _calculatePendingFee();
        require(fee > 0, "No fees due");
        require(
            usdc.balanceOf(address(this)) >= fee,
            "Insufficient balance for fees"
        );

        totalFeesPaid += fee;
        usdc.forceApprove(treasury, fee);
        ITreasury(treasury).receiveFee(fee);
    }

    /**
     * @notice Withdraw USDC with HWM fee deduction
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        require(amount > 0 && amount <= balance, "Invalid amount");

        // 1. Calculate and pay ALL pending fees first
        // If we only pay partial fees, tracking HWM becomes complex.
        // Best practice: Settle accounts before withdrawal.
        (uint256 fee, ) = _calculatePendingFee();

        // Cap fee at current balance (shouldn't happen if logic is sound, but safety first)
        if (fee > balance) {
            fee = balance;
        }

        // Update accounting
        if (fee > 0) {
            totalFeesPaid += fee;
            usdc.forceApprove(treasury, fee);
            ITreasury(treasury).receiveFee(fee);
        }

        // 2. Handle User Withdrawal
        // Deduct fee from balance first.
        // If user requested amount > remaining balance, cap it.
        uint256 remainingBalance = balance - fee;
        uint256 withdrawAmount = amount;

        // If the fee ate into the requested amount, user gets less.
        // Or should we treat 'amount' as what user WANTS to receive?
        // Standard is: "Withdraw X" -> Deduct Fee -> Send X-Fee? No, we just settled Global Fees.
        // If global fees were pending, we pay them.
        // Then we send 'amount' if available.

        if (withdrawAmount > remainingBalance) {
            withdrawAmount = remainingBalance;
        }

        if (withdrawAmount > 0) {
            totalWithdrawn += withdrawAmount;
            usdc.safeTransfer(owner, withdrawAmount);
        }

        emit Withdrawn(owner, withdrawAmount, fee);
    }

    /**
     * @notice Withdraw all USDC with HWM fee deduction
     */
    function withdrawAll() external onlyOwner nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No balance");

        (uint256 fee, ) = _calculatePendingFee();

        if (fee > balance) fee = balance;

        if (fee > 0) {
            totalFeesPaid += fee;
            usdc.forceApprove(treasury, fee);
            ITreasury(treasury).receiveFee(fee);
        }

        uint256 remaining = balance - fee;

        if (remaining > 0) {
            totalWithdrawn += remaining;
            usdc.safeTransfer(owner, remaining);
        }

        emit Withdrawn(owner, remaining, fee);
    }

    /**
     * @notice Get current balance
     */
    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Get current lifetime profit
     */
    function getProfit() external view returns (int256) {
        (, int256 profit) = _calculatePendingFee();
        return profit;
    }

    /**
     * @notice Get estimated pending fee
     */
    function getEstimatedFee() external view returns (uint256) {
        (uint256 fee, ) = _calculatePendingFee();
        return fee;
    }

    /**
     * @notice Get proxy stats
     */
    function getStats()
        external
        view
        returns (
            uint256 balance,
            uint256 deposited,
            uint256 withdrawn,
            uint256 feesPaid,
            int256 profit,
            uint256 currentFeePercent,
            uint256 pendingFee
        )
    {
        balance = usdc.balanceOf(address(this));
        deposited = totalDeposited;
        withdrawn = totalWithdrawn;
        feesPaid = totalFeesPaid;
        uint256 fee;
        (fee, profit) = _calculatePendingFee();
        pendingFee = fee;
        currentFeePercent = feePercent;
    }

    // ========== Admin Functions (Factory Only) ==========

    /**
     * @notice Update treasury address
     * @dev Only callable by factory
     */
    function setTreasury(address _treasury) external onlyFactory {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /**
     * @notice Update fee percentage
     * @dev Only callable by factory
     */
    function setFeePercent(uint256 _feePercent) external onlyFactory {
        require(_feePercent <= 2000, "Fee too high");
        feePercent = _feePercent;
        emit FeePercentUpdated(_feePercent);
    }

    /**
     * @notice Approve USDC spending for Polymarket trading
     * @dev Owner can approve exchanges to spend proxy's USDC
     */
    function approveTrading(
        address spender,
        uint256 amount
    ) external onlyOwner {
        usdc.forceApprove(spender, amount);
    }

    /**
     * @notice Set executor address
     * @param _executor Executor contract address
     */
    function setExecutor(address _executor) external onlyFactory {
        require(_executor != address(0), "Invalid executor");
        executor = _executor;
        emit ExecutorUpdated(_executor);
    }

    function setAllowedTarget(
        address target,
        bool allowed
    ) external onlyFactory {
        require(target != address(0), "Invalid target");
        allowedTargets[target] = allowed;
        emit AllowedTargetUpdated(target, allowed);
    }

    function setAllowedTargets(
        address[] calldata targets,
        bool allowed
    ) external onlyFactory {
        for (uint256 i = 0; i < targets.length; i++) {
            address target = targets[i];
            if (target != address(0)) {
                allowedTargets[target] = allowed;
                emit AllowedTargetUpdated(target, allowed);
            }
        }
    }

    function pauseExecution() external onlyFactory {
        paused = true;
        emit ExecutionPaused(true);
    }

    function unpauseExecution() external onlyFactory {
        paused = false;
        emit ExecutionPaused(false);
    }

    /**
     * @notice Execute arbitrary call for trading
     * @dev Owner or Executor can call Polymarket contracts through this proxy
     */
    function execute(
        address target,
        bytes calldata data
    ) external onlyExecutorOrOwner nonReentrant returns (bytes memory) {
        require(!paused, "Execution paused");
        require(allowedTargets[target], "Target not allowed");

        (bool success, bytes memory result) = target.call(data);
        require(success, "Execution failed");
        return result;
    }

    /**
     * @notice Validates a signature according to EIP-1271
     * @dev Allows the bot (executor) or the owner to sign orders (e.g. Polymarket limits) on behalf of the proxy.
     * @param hash Hash of the data to be signed
     * @param signature Signature byte array associated with hash
     * @return magicValue EIP-1271 magic value if the signature is valid, otherwise 0xffffffff
     */
    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) external view override returns (bytes4 magicValue) {
        address signer = ECDSA.recover(hash, signature);

        if (signer == owner || signer == executor) {
            return IERC1271.isValidSignature.selector; // 0x1626ba7e
        } else {
            return 0xffffffff;
        }
    }
}
