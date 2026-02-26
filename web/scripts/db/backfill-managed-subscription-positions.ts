import 'dotenv/config';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ManagedSubscriptionStatus } from '@prisma/client';

type PositionState = {
    balance: number;
    avgEntryPrice: number;
    totalCost: number;
};

const DATABASE_URL = process.env.DATABASE_URL || '';
if (!DATABASE_URL) {
    console.error('[BackfillManagedPositions] Missing DATABASE_URL');
    process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

function normalizeTradeSide(value: string | null | undefined): 'BUY' | 'SELL' | null {
    const side = String(value || '').toUpperCase();
    if (side === 'BUY') return 'BUY';
    if (side === 'SELL') return 'SELL';
    return null;
}

function applyTradeToPosition(
    position: PositionState,
    side: 'BUY' | 'SELL',
    shares: number,
    notionalUsdc: number
): PositionState {
    if (!Number.isFinite(shares) || shares <= 0) return position;

    if (side === 'BUY') {
        const nextBalance = position.balance + shares;
        const nextTotalCost = position.totalCost + notionalUsdc;
        return {
            balance: nextBalance,
            totalCost: nextTotalCost,
            avgEntryPrice: nextBalance > 0 ? nextTotalCost / nextBalance : 0,
        };
    }

    if (position.balance <= 0) {
        return {
            balance: 0,
            totalCost: 0,
            avgEntryPrice: 0,
        };
    }

    const settledShares = Math.min(position.balance, shares);
    const nextBalance = Math.max(0, position.balance - settledShares);
    const nextTotalCost = nextBalance > 0 ? position.avgEntryPrice * nextBalance : 0;
    return {
        balance: nextBalance,
        totalCost: nextTotalCost,
        avgEntryPrice: nextBalance > 0 ? position.avgEntryPrice : 0,
    };
}

async function rebuildSubscriptionPositions(subscription: {
    id: string;
    walletAddress: string;
    copyConfigId: string;
}) {
    const trades = await prisma.copyTrade.findMany({
        where: {
            configId: subscription.copyConfigId,
            status: 'EXECUTED',
            tokenId: { not: null },
            copySize: { gt: 0 },
            copyPrice: { gt: 0 },
        },
        select: {
            tokenId: true,
            originalSide: true,
            copySize: true,
            copyPrice: true,
            executedAt: true,
            detectedAt: true,
        },
        orderBy: [
            { executedAt: 'asc' },
            { detectedAt: 'asc' },
        ],
    });

    const byToken = new Map<string, PositionState>();

    for (const trade of trades) {
        const tokenId = trade.tokenId;
        if (!tokenId) continue;

        const side = normalizeTradeSide(trade.originalSide);
        if (!side) continue;

        const notionalUsdc = Number(trade.copySize || 0);
        const price = Number(trade.copyPrice || 0);
        if (!Number.isFinite(notionalUsdc) || !Number.isFinite(price) || price <= 0 || notionalUsdc <= 0) {
            continue;
        }

        const shares = notionalUsdc / price;
        const current = byToken.get(tokenId) || {
            balance: 0,
            avgEntryPrice: 0,
            totalCost: 0,
        };
        byToken.set(tokenId, applyTradeToPosition(current, side, shares, notionalUsdc));
    }

    const nextRows = Array.from(byToken.entries())
        .map(([tokenId, state]) => ({ tokenId, ...state }))
        .filter((row) => row.balance > 0.00000001);

    await prisma.$transaction(async (tx) => {
        await tx.managedSubscriptionPosition.deleteMany({
            where: { subscriptionId: subscription.id },
        });

        if (nextRows.length > 0) {
            await tx.managedSubscriptionPosition.createMany({
                data: nextRows.map((row) => ({
                    subscriptionId: subscription.id,
                    walletAddress: subscription.walletAddress,
                    tokenId: row.tokenId,
                    balance: Number(row.balance.toFixed(10)),
                    avgEntryPrice: Number(row.avgEntryPrice.toFixed(10)),
                    totalCost: Number(row.totalCost.toFixed(10)),
                })),
            });
        }
    });

    return {
        subscriptionId: subscription.id,
        rebuiltTokenCount: nextRows.length,
        tradesScanned: trades.length,
    };
}

async function main() {
    const activeStatuses: ManagedSubscriptionStatus[] = [
        'RUNNING',
        'MATURED',
        'LIQUIDATING',
    ];

    const subscriptions = await prisma.managedSubscription.findMany({
        where: {
            status: { in: activeStatuses },
            copyConfigId: { not: null },
        },
        select: {
            id: true,
            walletAddress: true,
            copyConfigId: true,
        },
        orderBy: { createdAt: 'asc' },
    });

    console.log(`[BackfillManagedPositions] Found ${subscriptions.length} active managed subscriptions.`);

    let totalTrades = 0;
    let totalTokens = 0;

    for (const sub of subscriptions) {
        if (!sub.copyConfigId) continue;
        const result = await rebuildSubscriptionPositions({
            id: sub.id,
            walletAddress: sub.walletAddress,
            copyConfigId: sub.copyConfigId,
        });
        totalTrades += result.tradesScanned;
        totalTokens += result.rebuiltTokenCount;
        console.log(
            `[BackfillManagedPositions] subscription=${result.subscriptionId} trades=${result.tradesScanned} tokens=${result.rebuiltTokenCount}`
        );
    }

    console.log(
        `[BackfillManagedPositions] Done. subscriptions=${subscriptions.length} trades=${totalTrades} activeTokens=${totalTokens}`
    );
}

main()
    .catch((error) => {
        console.error('[BackfillManagedPositions] Failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
