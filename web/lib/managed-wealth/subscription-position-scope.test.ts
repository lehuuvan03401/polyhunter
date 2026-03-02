import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    countManagedOpenPositionsWithFallback,
    listManagedOpenPositionsWithFallback,
} from './subscription-position-scope';

function createDbMocks() {
    return {
        managedSubscriptionExecutionTarget: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        managedSubscriptionPosition: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
        copyTrade: {
            findMany: vi.fn(),
        },
        userPosition: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
    };
}

const ORIGINAL_SCOPE_FALLBACK = process.env.MANAGED_POSITION_SCOPE_FALLBACK;

afterEach(() => {
    vi.restoreAllMocks();
    if (ORIGINAL_SCOPE_FALLBACK === undefined) {
        delete process.env.MANAGED_POSITION_SCOPE_FALLBACK;
    } else {
        process.env.MANAGED_POSITION_SCOPE_FALLBACK = ORIGINAL_SCOPE_FALLBACK;
    }
});

describe('subscription position scope helpers', () => {
    it('prefers scoped positions over legacy fallback', async () => {
        const db = createDbMocks();
        db.managedSubscriptionPosition.findMany.mockResolvedValue([
            {
                id: 'scoped-1',
                walletAddress: '0xabc',
                tokenId: 'token-1',
                balance: 12,
                avgEntryPrice: 0.42,
                totalCost: 5.04,
            },
        ]);

        const positions = await listManagedOpenPositionsWithFallback(db as never, {
            subscriptionId: 'sub-1',
            walletAddress: '0xabc',
            copyConfigId: 'cfg-1',
        });

        expect(positions).toEqual([
            {
                id: 'scoped-1',
                walletAddress: '0xabc',
                tokenId: 'token-1',
                balance: 12,
                avgEntryPrice: 0.42,
                totalCost: 5.04,
                source: 'SCOPED',
            },
        ]);
        expect(db.copyTrade.findMany).not.toHaveBeenCalled();
        expect(db.userPosition.findMany).not.toHaveBeenCalled();
    });

    it('falls back to legacy positions within the managed token universe', async () => {
        const db = createDbMocks();
        db.managedSubscriptionPosition.findMany.mockResolvedValue([]);
        db.managedSubscriptionExecutionTarget.findMany.mockResolvedValue([
            {
                copyConfigId: 'cfg-1',
                allocationVersion: 2,
                targetWeight: 0.6,
                targetOrder: 0,
                isPrimary: true,
                isActive: true,
            },
            {
                copyConfigId: 'cfg-2',
                allocationVersion: 2,
                targetWeight: 0.4,
                targetOrder: 1,
                isPrimary: false,
                isActive: true,
            },
        ]);
        db.copyTrade.findMany.mockResolvedValueOnce([
            { tokenId: 'token-1' },
            { tokenId: 'token-2' },
        ]);
        db.copyTrade.findMany.mockResolvedValueOnce([
            { tokenId: 'token-1' },
            { tokenId: 'token-2' },
            { tokenId: 'token-3' },
        ]);
        db.userPosition.findMany.mockResolvedValue([
            {
                id: 'legacy-1',
                walletAddress: '0xabc',
                tokenId: 'token-2',
                balance: 7,
                avgEntryPrice: 0.51,
                totalCost: 3.57,
            },
        ]);
        db.managedSubscriptionPosition.count.mockResolvedValue(0);
        db.userPosition.count.mockResolvedValue(1);

        const positions = await listManagedOpenPositionsWithFallback(db as never, {
            subscriptionId: 'sub-1',
            walletAddress: '0xabc',
            copyConfigId: 'cfg-1',
        });
        const count = await countManagedOpenPositionsWithFallback(db as never, {
            subscriptionId: 'sub-1',
            walletAddress: '0xabc',
            copyConfigId: 'cfg-1',
        });

        expect(db.copyTrade.findMany).toHaveBeenCalledTimes(2);
        expect(db.copyTrade.findMany).toHaveBeenNthCalledWith(1, {
            where: {
                configId: { in: ['cfg-1', 'cfg-2'] },
                tokenId: { not: null },
                status: { in: ['EXECUTED', 'SETTLEMENT_PENDING'] },
            },
            select: { tokenId: true },
            distinct: ['tokenId'],
        });
        expect(db.userPosition.findMany).toHaveBeenCalledWith({
            where: {
                walletAddress: '0xabc',
                tokenId: { in: ['token-1', 'token-2'] },
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
        expect(positions[0]?.source).toBe('LEGACY');
        expect(count).toBe(1);
    });

    it('returns zero and skips legacy reads when fallback is disabled', async () => {
        process.env.MANAGED_POSITION_SCOPE_FALLBACK = 'false';

        const db = createDbMocks();
        db.managedSubscriptionPosition.count.mockResolvedValue(0);

        const count = await countManagedOpenPositionsWithFallback(db as never, {
            subscriptionId: 'sub-1',
            walletAddress: '0xabc',
            copyConfigId: 'cfg-1',
        });

        expect(count).toBe(0);
        expect(db.managedSubscriptionExecutionTarget.findMany).not.toHaveBeenCalled();
        expect(db.copyTrade.findMany).not.toHaveBeenCalled();
        expect(db.userPosition.count).not.toHaveBeenCalled();
    });
});
