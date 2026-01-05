/**
 * Profit Calculation Service
 * 
 * Calculates profits for user proxy wallets by comparing on-chain balance
 * with deposited amounts. Used to determine fee amounts on withdrawal.
 */

import { ethers } from 'ethers';
import { prisma } from '@/lib/prisma';
import { TIER_FEE_PERCENTAGES } from '../proxy/utils';

// USDC.e on Polygon (6 decimals)
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const USDC_ABI = [
    'function balanceOf(address) view returns (uint256)',
];

// PolyHunterProxy ABI (for getStats)
const PROXY_ABI = [
    'function getStats() view returns (uint256 balance, uint256 deposited, uint256 withdrawn, uint256 feesPaid, int256 profit, uint256 currentFeePercent)',
    'function getBalance() view returns (uint256)',
    'function getProfit() view returns (int256)',
    'function getEstimatedFee() view returns (uint256)',
];

interface ProxyStats {
    proxyAddress: string;
    walletAddress: string;
    tier: string;
    balance: number;
    deposited: number;
    withdrawn: number;
    profit: number;
    feesPaid: number;
    estimatedFee: number;
    feePercent: number;
}

/**
 * Get RPC provider for Polygon
 * Note: Using ethers v5 API (providers.JsonRpcProvider)
 */
function getProvider() {
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    return new ethers.providers.JsonRpcProvider(rpcUrl);
}

/**
 * Fetch on-chain stats for a proxy contract
 */
export async function fetchProxyStats(proxyAddress: string): Promise<{
    balance: bigint;
    deposited: bigint;
    withdrawn: bigint;
    feesPaid: bigint;
    profit: bigint;
    feePercent: bigint;
} | null> {
    try {
        const provider = getProvider();
        const proxyContract = new ethers.Contract(proxyAddress, PROXY_ABI, provider);

        const stats = await proxyContract.getStats();

        return {
            balance: stats.balance,
            deposited: stats.deposited,
            withdrawn: stats.withdrawn,
            feesPaid: stats.feesPaid,
            profit: stats.profit,
            feePercent: stats.currentFeePercent,
        };
    } catch (error) {
        console.error(`Failed to fetch stats for proxy ${proxyAddress}:`, error);
        return null;
    }
}

/**
 * Calculate profit for a single proxy
 */
export async function calculateProxyProfit(proxyAddress: string): Promise<number | null> {
    try {
        const provider = getProvider();
        const proxyContract = new ethers.Contract(proxyAddress, PROXY_ABI, provider);

        const profit = await proxyContract.getProfit();
        // Convert from 6 decimals (USDC) to number
        return Number(profit) / 1e6;
    } catch (error) {
        console.error(`Failed to calculate profit for ${proxyAddress}:`, error);
        return null;
    }
}

/**
 * Calculate estimated fee for a proxy
 */
export async function calculateEstimatedFee(proxyAddress: string): Promise<number | null> {
    try {
        const provider = getProvider();
        const proxyContract = new ethers.Contract(proxyAddress, PROXY_ABI, provider);

        const fee = await proxyContract.getEstimatedFee();
        return Number(fee) / 1e6;
    } catch (error) {
        console.error(`Failed to calculate fee for ${proxyAddress}:`, error);
        return null;
    }
}

/**
 * Sync all proxy stats from on-chain to database
 */
export async function syncAllProxyStats(): Promise<{
    synced: number;
    failed: number;
    errors: string[];
}> {
    const proxies = await prisma.userProxy.findMany({
        where: { isActive: true },
    });

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const proxy of proxies) {
        try {
            const stats = await fetchProxyStats(proxy.proxyAddress);

            if (stats) {
                await prisma.userProxy.update({
                    where: { id: proxy.id },
                    data: {
                        totalDeposited: Number(stats.deposited) / 1e6,
                        totalWithdrawn: Number(stats.withdrawn) / 1e6,
                        totalProfit: Number(stats.profit) / 1e6,
                        totalFeesPaid: Number(stats.feesPaid) / 1e6,
                    },
                });
                synced++;
            } else {
                failed++;
                errors.push(`No stats for ${proxy.proxyAddress}`);
            }
        } catch (error) {
            failed++;
            errors.push(`Error syncing ${proxy.proxyAddress}: ${error}`);
        }
    }

    return { synced, failed, errors };
}

/**
 * Get aggregated platform stats
 */
export async function getPlatformProfitStats(): Promise<{
    totalProfit: number;
    totalFees: number;
    totalVolume: number;
    activeProxies: number;
}> {
    const aggregates = await prisma.userProxy.aggregate({
        _sum: {
            totalProfit: true,
            totalFeesPaid: true,
            totalVolume: true,
        },
        _count: {
            _all: true,
        },
        where: {
            isActive: true,
        },
    });

    return {
        totalProfit: aggregates._sum.totalProfit || 0,
        totalFees: aggregates._sum.totalFeesPaid || 0,
        totalVolume: aggregates._sum.totalVolume || 0,
        activeProxies: aggregates._count._all,
    };
}

/**
 * Calculate fee for a given profit amount and tier
 */
export function calculateFee(profitAmount: number, tier: 'STARTER' | 'PRO' | 'WHALE'): number {
    if (profitAmount <= 0) return 0;
    const feePercent = TIER_FEE_PERCENTAGES[tier];
    return (profitAmount * feePercent) / 100;
}

/**
 * Get user's proxy stats (combined on-chain + database)
 */
export async function getUserProxyStats(walletAddress: string): Promise<ProxyStats | null> {
    const proxy = await prisma.userProxy.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!proxy) return null;

    // Try to get fresh on-chain data
    const onChainStats = await fetchProxyStats(proxy.proxyAddress);

    if (onChainStats) {
        // Update database with fresh data
        await prisma.userProxy.update({
            where: { id: proxy.id },
            data: {
                totalDeposited: Number(onChainStats.deposited) / 1e6,
                totalWithdrawn: Number(onChainStats.withdrawn) / 1e6,
                totalProfit: Number(onChainStats.profit) / 1e6,
                totalFeesPaid: Number(onChainStats.feesPaid) / 1e6,
            },
        });

        return {
            proxyAddress: proxy.proxyAddress,
            walletAddress: proxy.walletAddress,
            tier: proxy.tier,
            balance: Number(onChainStats.balance) / 1e6,
            deposited: Number(onChainStats.deposited) / 1e6,
            withdrawn: Number(onChainStats.withdrawn) / 1e6,
            profit: Number(onChainStats.profit) / 1e6,
            feesPaid: Number(onChainStats.feesPaid) / 1e6,
            estimatedFee: await calculateEstimatedFee(proxy.proxyAddress) || 0,
            feePercent: TIER_FEE_PERCENTAGES[proxy.tier as keyof typeof TIER_FEE_PERCENTAGES],
        };
    }

    // Return database values if on-chain fetch fails
    return {
        proxyAddress: proxy.proxyAddress,
        walletAddress: proxy.walletAddress,
        tier: proxy.tier,
        balance: 0,
        deposited: proxy.totalDeposited,
        withdrawn: proxy.totalWithdrawn,
        profit: proxy.totalProfit,
        feesPaid: proxy.totalFeesPaid,
        estimatedFee: 0,
        feePercent: TIER_FEE_PERCENTAGES[proxy.tier as keyof typeof TIER_FEE_PERCENTAGES],
    };
}
