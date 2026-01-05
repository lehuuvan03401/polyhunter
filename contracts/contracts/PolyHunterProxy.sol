// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IPolymarketCTF
 * @notice Interface for Polymarket Conditional Token Framework
 */
interface IPolymarketCTF {
    function getPositionId(bytes32 conditionId, uint256 indexSet) external pure returns (uint256);
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
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
contract PolyHunterProxy is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Owner (user) of this proxy
    address public immutable owner;
    
    // Platform treasury
    address public treasury;
    
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
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
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
        uint256 _feePercent
    ) {
        require(_owner != address(0), "Invalid owner");
        require(_treasury != address(0), "Invalid treasury");
        require(_usdc != address(0), "Invalid USDC");
        require(_feePercent <= 2000, "Fee too high"); // Max 20%
        
        owner = _owner;
        treasury = _treasury;
        usdc = IERC20(_usdc);
        ctfExchange = _ctfExchange;
        feePercent = _feePercent;
        factory = msg.sender;
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
     * @notice Withdraw USDC with automatic fee deduction on profits
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        require(amount > 0 && amount <= balance, "Invalid amount");
        
        // Calculate current profit
        uint256 netDeposits = totalDeposited > totalWithdrawn ? totalDeposited - totalWithdrawn : 0;
        uint256 profit = balance > netDeposits ? balance - netDeposits : 0;
        
        // Calculate fee only on the profit portion being withdrawn
        uint256 fee = 0;
        if (profit > 0 && feePercent > 0) {
            // Pro-rata fee based on withdrawal amount vs total balance
            uint256 profitPortion = (amount * profit) / balance;
            fee = (profitPortion * feePercent) / 10000;
        }
        
        // Update accounting
        totalWithdrawn += amount;
        
        // Pay fee to treasury
        if (fee > 0) {
            totalFeesPaid += fee;
            usdc.forceApprove(treasury, fee);
            ITreasury(treasury).receiveFee(fee);
        }
        
        // Transfer remaining to owner
        uint256 netAmount = amount - fee;
        usdc.safeTransfer(owner, netAmount);
        
        emit Withdrawn(owner, netAmount, fee);
    }
    
    /**
     * @notice Withdraw all USDC with automatic fee deduction
     */
    function withdrawAll() external onlyOwner nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No balance");
        
        // Calculate profit
        uint256 netDeposits = totalDeposited > totalWithdrawn ? totalDeposited - totalWithdrawn : 0;
        uint256 profit = balance > netDeposits ? balance - netDeposits : 0;
        
        // Calculate fee on profit
        uint256 fee = 0;
        if (profit > 0 && feePercent > 0) {
            fee = (profit * feePercent) / 10000;
        }
        
        // Update accounting
        totalWithdrawn += balance;
        
        // Pay fee to treasury
        if (fee > 0) {
            totalFeesPaid += fee;
            usdc.forceApprove(treasury, fee);
            ITreasury(treasury).receiveFee(fee);
        }
        
        // Transfer remaining to owner
        uint256 netAmount = balance - fee;
        usdc.safeTransfer(owner, netAmount);
        
        emit Withdrawn(owner, netAmount, fee);
    }
    
    /**
     * @notice Get current balance
     */
    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
    
    /**
     * @notice Get current unrealized profit
     */
    function getProfit() external view returns (int256) {
        uint256 balance = usdc.balanceOf(address(this));
        uint256 netDeposits = totalDeposited > totalWithdrawn ? totalDeposited - totalWithdrawn : 0;
        return int256(balance) - int256(netDeposits);
    }
    
    /**
     * @notice Get estimated fee on current profit
     */
    function getEstimatedFee() external view returns (uint256) {
        uint256 balance = usdc.balanceOf(address(this));
        uint256 netDeposits = totalDeposited > totalWithdrawn ? totalDeposited - totalWithdrawn : 0;
        if (balance <= netDeposits) return 0;
        uint256 profit = balance - netDeposits;
        return (profit * feePercent) / 10000;
    }
    
    /**
     * @notice Get proxy stats
     */
    function getStats() external view returns (
        uint256 balance,
        uint256 deposited,
        uint256 withdrawn,
        uint256 feesPaid,
        int256 profit,
        uint256 currentFeePercent
    ) {
        balance = usdc.balanceOf(address(this));
        deposited = totalDeposited;
        withdrawn = totalWithdrawn;
        feesPaid = totalFeesPaid;
        uint256 netDeposits = totalDeposited > totalWithdrawn ? totalDeposited - totalWithdrawn : 0;
        profit = int256(balance) - int256(netDeposits);
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
    function approveTrading(address spender, uint256 amount) external onlyOwner {
        usdc.forceApprove(spender, amount);
    }
    
    /**
     * @notice Execute arbitrary call for trading
     * @dev Owner can call Polymarket contracts through this proxy
     */
    function execute(
        address target,
        bytes calldata data
    ) external onlyOwner nonReentrant returns (bytes memory) {
        require(target != address(usdc), "Cannot call USDC directly");
        require(target != treasury, "Cannot call treasury directly");
        
        (bool success, bytes memory result) = target.call(data);
        require(success, "Execution failed");
        return result;
    }
}
