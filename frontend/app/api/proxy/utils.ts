import { prisma } from '@/lib/prisma';
import { SubscriptionTier } from '@prisma/client';

// Fee percentages for each tier (in basis points, 1000 = 10%)
export const TIER_FEES: Record<SubscriptionTier, number> = {
    STARTER: 1000, // 10%
    PRO: 500,      // 5%
    WHALE: 200,    // 2%
};

// Fee percentages as readable percentages
export const TIER_FEE_PERCENTAGES: Record<SubscriptionTier, number> = {
    STARTER: 10,
    PRO: 5,
    WHALE: 2,
};

// Contract addresses (will be updated after deployment)
export const CONTRACT_ADDRESSES = {
    // Polygon Mainnet
    polygon: {
        proxyFactory: process.env.PROXY_FACTORY_ADDRESS || '',
        treasury: process.env.TREASURY_ADDRESS || '',
        usdc: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC.e
    },
    // Polygon Amoy Testnet
    amoy: {
        proxyFactory: process.env.AMOY_PROXY_FACTORY_ADDRESS || '',
        treasury: process.env.AMOY_TREASURY_ADDRESS || '',
        usdc: process.env.AMOY_USDC_ADDRESS || '',
    },
};

/**
 * Get user proxy by wallet address
 */
export async function getUserProxy(walletAddress: string) {
    return prisma.userProxy.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
        include: {
            feeTransactions: {
                orderBy: { createdAt: 'desc' },
                take: 10,
            },
        },
    });
}

/**
 * Create a new user proxy record
 */
export async function createUserProxy(
    walletAddress: string,
    proxyAddress: string,
    tier: SubscriptionTier = 'STARTER'
) {
    return prisma.userProxy.create({
        data: {
            walletAddress: walletAddress.toLowerCase(),
            proxyAddress: proxyAddress.toLowerCase(),
            tier,
        },
    });
}

/**
 * Update user proxy stats
 */
export async function updateProxyStats(
    proxyAddress: string,
    stats: {
        totalDeposited?: number;
        totalWithdrawn?: number;
        totalVolume?: number;
        totalProfit?: number;
        totalFeesPaid?: number;
    }
) {
    return prisma.userProxy.update({
        where: { proxyAddress: proxyAddress.toLowerCase() },
        data: stats,
    });
}

/**
 * Update user tier
 */
export async function updateUserTier(walletAddress: string, tier: SubscriptionTier) {
    return prisma.userProxy.update({
        where: { walletAddress: walletAddress.toLowerCase() },
        data: { tier },
    });
}

/**
 * Record a fee transaction
 */
export async function recordFeeTransaction(
    userProxyId: string,
    profitAmount: number,
    feeAmount: number,
    feePercent: number,
    txHash?: string,
    blockNumber?: number
) {
    return prisma.feeTransaction.create({
        data: {
            userProxyId,
            profitAmount,
            feeAmount,
            feePercent,
            txHash,
            blockNumber,
        },
    });
}

/**
 * Get platform stats
 */
export async function getPlatformStats() {
    const [totalProxies, activeProxies, totalFees, recentTransactions] = await Promise.all([
        prisma.userProxy.count(),
        prisma.userProxy.count({ where: { isActive: true } }),
        prisma.feeTransaction.aggregate({
            _sum: { feeAmount: true },
        }),
        prisma.feeTransaction.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
                userProxy: {
                    select: { walletAddress: true },
                },
            },
        }),
    ]);

    return {
        totalProxies,
        activeProxies,
        totalFeesCollected: totalFees._sum.feeAmount || 0,
        recentTransactions,
    };
}

/**
 * Get tier breakdown
 */
export async function getTierBreakdown() {
    const tiers = await prisma.userProxy.groupBy({
        by: ['tier'],
        _count: true,
    });

    return tiers.reduce((acc, { tier, _count }) => {
        acc[tier] = _count;
        return acc;
    }, {} as Record<SubscriptionTier, number>);
}

export { prisma };
