import type { PrismaClient } from '@prisma/client';

type PositionScopeDb = Pick<
    PrismaClient,
    'managedSubscriptionPosition' | 'copyTrade' | 'userPosition'
>;

export type ManagedOpenPosition = {
    id: string;
    walletAddress: string;
    tokenId: string;
    balance: number;
    avgEntryPrice: number;
    totalCost: number;
    source: 'SCOPED' | 'LEGACY';
};

async function listManagedTokenUniverse(
    db: PositionScopeDb,
    copyConfigId: string
): Promise<string[]> {
    const rows = await db.copyTrade.findMany({
        where: {
            configId: copyConfigId,
            tokenId: { not: null },
            status: { in: ['EXECUTED', 'SETTLEMENT_PENDING'] },
        },
        select: { tokenId: true },
        distinct: ['tokenId'],
    });

    return rows
        .map((row) => row.tokenId)
        .filter((tokenId): tokenId is string => Boolean(tokenId));
}

export async function listManagedOpenPositionsWithFallback(
    db: PositionScopeDb,
    input: {
        subscriptionId: string;
        walletAddress: string;
        copyConfigId?: string | null;
    }
): Promise<ManagedOpenPosition[]> {
    const scoped = await db.managedSubscriptionPosition.findMany({
        where: {
            subscriptionId: input.subscriptionId,
            balance: { gt: 0 },
        },
        select: {
            id: true,
            walletAddress: true,
            tokenId: true,
            balance: true,
            avgEntryPrice: true,
            totalCost: true,
        },
    });

    if (scoped.length > 0) {
        return scoped.map((row) => ({
            ...row,
            source: 'SCOPED' as const,
        }));
    }

    if (!input.copyConfigId) {
        return [];
    }

    const tokenIds = await listManagedTokenUniverse(db, input.copyConfigId);
    if (tokenIds.length === 0) {
        return [];
    }

    const legacy = await db.userPosition.findMany({
        where: {
            walletAddress: input.walletAddress,
            tokenId: { in: tokenIds },
            balance: { gt: 0 },
        },
        select: {
            id: true,
            walletAddress: true,
            tokenId: true,
            balance: true,
            avgEntryPrice: true,
            totalCost: true,
        },
    });

    return legacy.map((row) => ({
        ...row,
        source: 'LEGACY' as const,
    }));
}

export async function countManagedOpenPositionsWithFallback(
    db: PositionScopeDb,
    input: {
        subscriptionId: string;
        walletAddress: string;
        copyConfigId?: string | null;
    }
): Promise<number> {
    const scopedCount = await db.managedSubscriptionPosition.count({
        where: {
            subscriptionId: input.subscriptionId,
            balance: { gt: 0 },
        },
    });

    if (scopedCount > 0) {
        return scopedCount;
    }

    if (!input.copyConfigId) {
        return 0;
    }

    const tokenIds = await listManagedTokenUniverse(db, input.copyConfigId);
    if (tokenIds.length === 0) {
        return 0;
    }

    return db.userPosition.count({
        where: {
            walletAddress: input.walletAddress,
            tokenId: { in: tokenIds },
            balance: { gt: 0 },
        },
    });
}
