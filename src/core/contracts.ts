/**
 * Smart Contract ABIs and Addresses
 * 
 * Shared constants for SDK
 */

// Contract addresses
export const CONTRACT_ADDRESSES = {
    // Polygon Mainnet (137)
    polygon: {
        proxyFactory: '0xabc123...', // Placeholder, should be updated with real address or env var
        usdc: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC.e (bridged)
    },
    // Polygon Amoy (80002)
    amoy: {
        proxyFactory: process.env.NEXT_PUBLIC_AMOY_PROXY_FACTORY_ADDRESS || '',
        usdc: process.env.NEXT_PUBLIC_AMOY_USDC_ADDRESS || '',
    },
    // Common
    ctf: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045', // Polygon Mainnet CTF
} as const;

// CTF ABI (ERC1155 subset for transfers)
export const CTF_ABI = [
    'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) external',
    'function setApprovalForAll(address operator, bool approved) external',
    'function isApprovedForAll(address account, address operator) external view returns (bool)',
    'function balanceOf(address account, uint256 id) external view returns (uint256)',
] as const;

// ProxyFactory ABI (for creating proxies)
export const PROXY_FACTORY_ABI = [
    'function createProxy(uint8 tier) external returns (address)',
    'function getUserProxy(address user) external view returns (address)',
    'function hasProxy(address user) external view returns (bool)',
    'function getTotalProxies() external view returns (uint256)',
    'function getTierFee(uint8 tier) external view returns (uint256)',
    'event ProxyCreated(address indexed user, address indexed proxy, uint8 tier)',
] as const;

// PolyHunterProxy ABI (for user interactions)
export const POLY_HUNTER_PROXY_ABI = [
    // Read functions
    'function owner() external view returns (address)',
    'function getBalance() external view returns (uint256)',
    'function operators(address operator) external view returns (bool)',
    // Write functions
    'function setOperator(address operator, bool active) external',
    'function deposit(uint256 amount) external',
    'function withdraw(uint256 amount) external',
    'function execute(address target, bytes calldata data) external returns (bytes memory)',
    // Events
    'event Deposited(address indexed user, uint256 amount)',
    'event Withdrawn(address indexed user, uint256 amount, uint256 fee)',
] as const;

// ERC20 ABI (for USDC approvals)
export const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function decimals() external view returns (uint8)',
] as const;

// Constants
export const USDC_DECIMALS = 6;
