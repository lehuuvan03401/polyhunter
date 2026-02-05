/**
 * Smart Contract ABIs and Addresses
 * 
 * Shared constants for SDK
 */

// Contract addresses
export const CONTRACT_ADDRESSES = {
    // Polygon Mainnet (137)
    polygon: {
        // Defaults to undefined if not set, forcing caller to provide it or crash early
        proxyFactory: process.env.NEXT_PUBLIC_PROXY_FACTORY_ADDRESS || process.env.PROXY_FACTORY_ADDRESS || '0xa536e751cc68997e898165b3213eec355e09c6d3', // Known Factory Address or Env
        usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS || process.env.USDC_ADDRESS || '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC.e (bridged)
        executor: process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS || '0x4f07450Ef721147D38f29739eEe8079bC147f1f6', // New Executor Contract
    },
    // Polygon Amoy (80002)
    amoy: {
        proxyFactory: process.env.NEXT_PUBLIC_AMOY_PROXY_FACTORY_ADDRESS || process.env.AMOY_PROXY_FACTORY_ADDRESS || '',
        usdc: process.env.NEXT_PUBLIC_AMOY_USDC_ADDRESS || process.env.AMOY_USDC_ADDRESS || '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582', // Amoy USDC
        executor: process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS || '0x4f07450Ef721147D38f29739eEe8079bC147f1f6', // New Executor Contract
    },
    // Common
    ctf: process.env.NEXT_PUBLIC_CTF_ADDRESS || process.env.CTF_ADDRESS || '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045', // Polygon Mainnet CTF
} as const;

// CTF ABI (ERC1155 subset for transfers)
export const CTF_ABI = [
    'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) external',
    'function setApprovalForAll(address operator, bool approved) external',
    'function isApprovedForAll(address account, address operator) external view returns (bool)',
    'function balanceOf(address account, uint256 id) external view returns (uint256)',
    'function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] indexSets) external',
    'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
] as const;

// ProxyFactory ABI (for creating proxies)
export const PROXY_FACTORY_ABI = [
    'function createProxy(uint8 tier) external returns (address)',
    'function getUserProxy(address user) external view returns (address)',
    'function hasProxy(address user) external view returns (bool)',
    'function getTotalProxies() external view returns (uint256)',
    'function getTierFee(uint8 tier) external view returns (uint256)',
    'function setExecutor(address executor) external',
    'function updateProxyExecutor(address proxy, address newExecutor) external',
    'function updateProxyAllowlist(address proxy, address target, bool allowed) external',
    'function batchUpdateAllowlist(address target, bool allowed, uint256 startIndex, uint256 endIndex) external',
    'function pauseProxy(address proxy) external',
    'function unpauseProxy(address proxy) external',
    'event ProxyCreated(address indexed user, address indexed proxy, uint8 tier)',
] as const;

// PolyHunterProxy ABI (for user interactions)
export const POLY_HUNTER_PROXY_ABI = [
    // Read functions
    'function owner() external view returns (address)',
    'function executor() external view returns (address)',
    'function paused() external view returns (bool)',
    'function allowedTargets(address target) external view returns (bool)',
    'function getBalance() external view returns (uint256)',
    // Write functions
    'function setExecutor(address executor) external',
    'function setAllowedTarget(address target, bool allowed) external',
    'function setAllowedTargets(address[] calldata targets, bool allowed) external',
    'function pauseExecution() external',
    'function unpauseExecution() external',
    'function approveTrading(address spender, uint256 amount) external',
    'function deposit(uint256 amount) external',
    'function withdraw(uint256 amount) external',
    'function execute(address target, bytes calldata data) external returns (bytes memory)',
    // Events
    'event Deposited(address indexed user, uint256 amount)',
    'event Withdrawn(address indexed user, uint256 amount, uint256 fee)',
] as const;

// PolyHunterExecutor ABI (Fleet Commander)
export const EXECUTOR_ABI = [
    'function executeOnProxy(address proxy, address target, bytes calldata data) external payable returns (bytes memory)',
    'function addWorker(address worker) external',
    'function addWorkers(address[] calldata workers) external',
    'function setAllowedTarget(address target, bool allowed) external',
    'function setAllowedTargets(address[] calldata targets, bool allowed) external',
    'function pauseExecution() external',
    'function unpauseExecution() external',
    'function allowedTargets(address target) external view returns (bool)',
    'function paused() external view returns (bool)',
    'function removeWorker(address worker) external',
    'function isWorker(address worker) external view returns (bool)',
] as const;

// ERC20 ABI (for USDC approvals)
export const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
    'function decimals() external view returns (uint8)',
] as const;

// Constants
export const USDC_DECIMALS = 6;
