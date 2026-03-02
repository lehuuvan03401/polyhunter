import {
    type ManagedExecutionTargetSelection,
    resolveManagedExecutionConfigIds,
} from './execution-targets';

type PositionScopeDb = {
    managedSubscriptionExecutionTarget: {
        findMany: (...args: any[]) => Promise<ManagedExecutionTargetSelection[]>;
    };
    managedSubscriptionPosition: {
        findMany: (...args: any[]) => Promise<Array<{
            id: string;
            walletAddress: string;
            tokenId: string;
            balance: number;
            avgEntryPrice: number;
            totalCost: number;
        }>>;
        count: (...args: any[]) => Promise<number>;
    };
    copyTrade: {
        findMany: (...args: any[]) => Promise<Array<{
            tokenId: string | null;
        }>>;
    };
    userPosition: {
        findMany: (...args: any[]) => Promise<Array<{
            id: string;
            walletAddress: string;
            tokenId: string;
            balance: number;
            avgEntryPrice: number;
            totalCost: number;
        }>>;
        count: (...args: any[]) => Promise<number>;
    };
};

function isScopeFallbackEnabled(): boolean {
    return process.env.MANAGED_POSITION_SCOPE_FALLBACK !== 'false';
}

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
    copyConfigIds: string[]
): Promise<string[]> {
    if (copyConfigIds.length === 0) {
        return [];
    }

    const rows = await db.copyTrade.findMany({
        where: {
            configId: copyConfigIds.length === 1
                ? copyConfigIds[0]
                : { in: copyConfigIds },
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
        copyConfigIds?: string[] | null;
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

    if (!isScopeFallbackEnabled()) {
        return [];
    }

    const configIds = input.copyConfigIds && input.copyConfigIds.length > 0
        ? input.copyConfigIds
        : await resolveManagedExecutionConfigIds(db, {
            subscriptionId: input.subscriptionId,
            fallbackCopyConfigId: input.copyConfigId,
        });

    if (!isScopeFallbackEnabled() || configIds.length === 0) {
        return [];
    }

    const tokenIds = await listManagedTokenUniverse(db, configIds);
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
        copyConfigIds?: string[] | null;
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

    if (!isScopeFallbackEnabled()) {
        return 0;
    }

    const configIds = input.copyConfigIds && input.copyConfigIds.length > 0
        ? input.copyConfigIds
        : await resolveManagedExecutionConfigIds(db, {
            subscriptionId: input.subscriptionId,
            fallbackCopyConfigId: input.copyConfigId,
        });

    if (configIds.length === 0) {
        return 0;
    }

    const tokenIds = await listManagedTokenUniverse(db, configIds);
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
