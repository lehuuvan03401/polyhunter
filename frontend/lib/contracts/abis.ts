/**
 * Smart Contract ABIs and Addresses
 * 
 * ABIs extracted from compiled contracts for frontend interaction
 */

// Contract addresses (update after deployment)
export const CONTRACT_ADDRESSES = {
    // Polygon Mainnet
    polygon: {
        proxyFactory: process.env.NEXT_PUBLIC_PROXY_FACTORY_ADDRESS || '',
        treasury: process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '',
        usdc: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC.e (bridged)
        executor: process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS || '0x4f07450Ef721147D38f29739eEe8079bC147f1f6',
        // Polymarket CLOB Exchange
        clobExchange: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
        negRiskExchange: '0xC5d563A36AE78145C45a50134d48A1215220f80a',
        ctfContract: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045',
    },
    amoy: {
        proxyFactory: process.env.NEXT_PUBLIC_AMOY_PROXY_FACTORY_ADDRESS || '',
        treasury: process.env.NEXT_PUBLIC_AMOY_TREASURY_ADDRESS || '',
        usdc: process.env.NEXT_PUBLIC_AMOY_USDC_ADDRESS || '',
        executor: process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS || '0x4f07450Ef721147D38f29739eEe8079bC147f1f6',
        clobExchange: '',
        negRiskExchange: '',
        ctfContract: '',
    },
    // Localhost Hardhat Fork
    localhost: {
        proxyFactory: process.env.NEXT_PUBLIC_PROXY_FACTORY_ADDRESS || '',
        treasury: process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '',
        usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        executor: process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS || '0x4f07450Ef721147D38f29739eEe8079bC147f1f6',
        clobExchange: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E', // Mainnet Fork
        negRiskExchange: '0xC5d563A36AE78145C45a50134d48A1215220f80a',
        ctfContract: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045',
    },
} as const;

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
    'function treasury() external view returns (address)',
    'function feePercent() external view returns (uint256)',
    'function totalDeposited() external view returns (uint256)',
    'function totalWithdrawn() external view returns (uint256)',
    'function totalFeesPaid() external view returns (uint256)',
    'function getBalance() external view returns (uint256)',
    'function getProfit() external view returns (int256)',
    'function getEstimatedFee() external view returns (uint256)',
    'function getStats() external view returns (uint256 balance, uint256 deposited, uint256 withdrawn, uint256 feesPaid, int256 profit, uint256 currentFeePercent)',
    'function operators(address operator) external view returns (bool)',
    // Write functions
    'function setOperator(address operator, bool active) external',
    'function deposit(uint256 amount) external',
    'function withdraw(uint256 amount) external',
    'function withdrawAll() external',
    'function approveTrading(address spender, uint256 amount) external',
    // Execute arbitrary calls for trading
    'function execute(address target, bytes calldata data) external returns (bytes memory)',
    // Events
    'event Deposited(address indexed user, uint256 amount)',
    'event Withdrawn(address indexed user, uint256 amount, uint256 fee)',
    'event OperatorUpdated(address indexed operator, bool active)',
] as const;

// ERC20 ABI (for USDC approvals)
export const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function decimals() external view returns (uint8)',
] as const;

// Treasury ABI
export const TREASURY_ABI = [
    'function getBalance() external view returns (uint256)',
    'event FeeReceived(address indexed from, uint256 amount)',
] as const;

// Tier constants
export const TIERS = {
    STARTER: 0,
    PRO: 1,
    WHALE: 2,
} as const;

export type TierName = keyof typeof TIERS;
export type TierValue = (typeof TIERS)[TierName];

// USDC decimals
export const USDC_DECIMALS = 6;

/**
 * Parse USDC amount from human readable to contract format
 */
export function parseUSDC(amount: number | string): bigint {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return BigInt(Math.floor(numAmount * 10 ** USDC_DECIMALS));
}

/**
 * Format USDC amount from contract format to human readable
 */
export function formatUSDC(amount: bigint | number | string): number {
    const bigAmount = typeof amount === 'bigint' ? amount : BigInt(amount);
    return Number(bigAmount) / 10 ** USDC_DECIMALS;
}
