// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Treasury
 * @notice Platform treasury for collecting trading fees
 * @dev All fees from PolyHunterProxy contracts are sent here
 */
contract Treasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // USDC token address (USDC.e on Polygon)
    IERC20 public immutable usdc;
    
    // Events
    event FeeReceived(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    
    constructor(address _usdc, address _owner) Ownable(_owner) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);
    }
    
    /**
     * @notice Receive fees from proxy contracts
     * @dev Called by PolyHunterProxy when user withdraws with profit
     */
    function receiveFee(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit FeeReceived(msg.sender, amount);
    }
    
    /**
     * @notice Withdraw accumulated fees to owner
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient balance");
        usdc.safeTransfer(owner(), amount);
        emit Withdrawn(owner(), amount);
    }
    
    /**
     * @notice Withdraw all accumulated fees
     */
    function withdrawAll() external onlyOwner nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No balance");
        usdc.safeTransfer(owner(), balance);
        emit Withdrawn(owner(), balance);
    }
    
    /**
     * @notice Get current treasury balance
     */
    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
