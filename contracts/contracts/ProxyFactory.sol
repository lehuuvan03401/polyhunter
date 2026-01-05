// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./PolyHunterProxy.sol";

/**
 * @title ProxyFactory
 * @notice Factory contract for creating PolyHunterProxy instances
 * @dev Manages proxy creation, tier-based fees, and admin functions
 */
contract ProxyFactory is Ownable {
    // USDC token address
    address public immutable usdc;
    
    // Polymarket CTF Exchange address
    address public immutable ctfExchange;
    
    // Platform treasury
    address public treasury;
    
    // Tier-based fee percentages (in basis points)
    // STARTER = 1000 (10%), PRO = 500 (5%), WHALE = 200 (2%)
    mapping(uint8 => uint256) public tierFees;
    
    // User address => Proxy address
    mapping(address => address) public userProxies;
    
    // All created proxies
    address[] public allProxies;
    
    // Events
    event ProxyCreated(address indexed user, address indexed proxy, uint8 tier);
    event TierFeeUpdated(uint8 tier, uint256 feePercent);
    event TreasuryUpdated(address newTreasury);
    event ProxyTierUpdated(address indexed proxy, uint8 newTier);
    
    // Tier enum (for clarity)
    uint8 public constant TIER_STARTER = 0;
    uint8 public constant TIER_PRO = 1;
    uint8 public constant TIER_WHALE = 2;
    
    constructor(
        address _usdc,
        address _ctfExchange,
        address _treasury,
        address _owner
    ) Ownable(_owner) {
        require(_usdc != address(0), "Invalid USDC");
        require(_treasury != address(0), "Invalid treasury");
        
        usdc = _usdc;
        ctfExchange = _ctfExchange;
        treasury = _treasury;
        
        // Set default tier fees
        tierFees[TIER_STARTER] = 1000; // 10%
        tierFees[TIER_PRO] = 500;      // 5%
        tierFees[TIER_WHALE] = 200;    // 2%
    }
    
    /**
     * @notice Create a proxy for a user
     * @param tier User's subscription tier (0=Starter, 1=Pro, 2=Whale)
     */
    function createProxy(uint8 tier) external returns (address) {
        require(userProxies[msg.sender] == address(0), "Proxy already exists");
        require(tier <= TIER_WHALE, "Invalid tier");
        
        uint256 feePercent = tierFees[tier];
        
        PolyHunterProxy proxy = new PolyHunterProxy(
            msg.sender,
            treasury,
            usdc,
            ctfExchange,
            feePercent
        );
        
        address proxyAddress = address(proxy);
        userProxies[msg.sender] = proxyAddress;
        allProxies.push(proxyAddress);
        
        emit ProxyCreated(msg.sender, proxyAddress, tier);
        
        return proxyAddress;
    }
    
    /**
     * @notice Get user's proxy address
     */
    function getUserProxy(address user) external view returns (address) {
        return userProxies[user];
    }
    
    /**
     * @notice Check if user has a proxy
     */
    function hasProxy(address user) external view returns (bool) {
        return userProxies[user] != address(0);
    }
    
    /**
     * @notice Get total number of proxies created
     */
    function getTotalProxies() external view returns (uint256) {
        return allProxies.length;
    }
    
    /**
     * @notice Get fee for a tier
     */
    function getTierFee(uint8 tier) external view returns (uint256) {
        return tierFees[tier];
    }
    
    // ========== Admin Functions ==========
    
    /**
     * @notice Set fee for a tier
     * @param tier Tier ID (0=Starter, 1=Pro, 2=Whale)
     * @param feePercent Fee in basis points (1000 = 10%)
     */
    function setTierFee(uint8 tier, uint256 feePercent) external onlyOwner {
        require(tier <= TIER_WHALE, "Invalid tier");
        require(feePercent <= 2000, "Fee too high"); // Max 20%
        tierFees[tier] = feePercent;
        emit TierFeeUpdated(tier, feePercent);
    }
    
    /**
     * @notice Update treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }
    
    /**
     * @notice Update a user's proxy tier (fee percentage)
     * @param user User address
     * @param newTier New tier
     */
    function updateProxyTier(address user, uint8 newTier) external onlyOwner {
        require(newTier <= TIER_WHALE, "Invalid tier");
        address proxyAddress = userProxies[user];
        require(proxyAddress != address(0), "No proxy exists");
        
        uint256 newFee = tierFees[newTier];
        PolyHunterProxy(proxyAddress).setFeePercent(newFee);
        
        emit ProxyTierUpdated(proxyAddress, newTier);
    }
    
    /**
     * @notice Batch update treasury for all proxies
     * @dev Use with caution - can be gas intensive
     */
    function batchUpdateTreasury(uint256 startIndex, uint256 endIndex) external onlyOwner {
        require(endIndex <= allProxies.length, "Invalid end index");
        for (uint256 i = startIndex; i < endIndex; i++) {
            PolyHunterProxy(allProxies[i]).setTreasury(treasury);
        }
    }
}
