import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

function createGetRequest(url: string) {
    return new NextRequest(url, {
        method: 'GET',
    });
}

async function setupRoute(params?: {
    isAdmin?: boolean;
}) {
    const now = new Date('2026-02-26T12:00:00.000Z');

    const managedSubscriptionFindMany = vi.fn().mockResolvedValue([
        {
            id: 'sub-run-mapped',
            status: 'RUNNING',
            walletAddress: '0x1111111111111111111111111111111111111111',
            copyConfigId: 'cfg-1',
            createdAt: new Date('2026-02-26T10:30:00.000Z'),
            updatedAt: new Date('2026-02-26T11:50:00.000Z'),
            endAt: new Date('2026-03-01T00:00:00.000Z'),
        },
        {
            id: 'sub-matured-unmapped',
            status: 'MATURED',
            walletAddress: '0x2222222222222222222222222222222222222222',
            copyConfigId: null,
            createdAt: new Date('2026-02-26T09:00:00.000Z'),
            updatedAt: new Date('2026-02-26T11:20:00.000Z'),
            endAt: new Date('2026-02-25T00:00:00.000Z'),
        },
        {
            id: 'sub-liq-backlog',
            status: 'LIQUIDATING',
            walletAddress: '0x3333333333333333333333333333333333333333',
            copyConfigId: 'cfg-3',
            createdAt: new Date('2026-02-26T08:00:00.000Z'),
            updatedAt: new Date('2026-02-26T10:00:00.000Z'),
            endAt: new Date('2026-02-24T00:00:00.000Z'),
        },
        {
            id: 'sub-liq-ready',
            status: 'LIQUIDATING',
            walletAddress: '0x4444444444444444444444444444444444444444',
            copyConfigId: 'cfg-4',
            createdAt: new Date('2026-02-26T11:20:00.000Z'),
            updatedAt: new Date('2026-02-26T11:30:00.000Z'),
            endAt: new Date('2026-02-24T00:00:00.000Z'),
        },
    ]);

    const managedSettlementFindMany = vi.fn().mockResolvedValue([
        {
            id: 'settlement-1',
            subscriptionId: 'sub-run-mapped',
            grossPnl: 100,
            settledAt: new Date('2026-02-26T11:00:00.000Z'),
            subscription: {
                walletAddress: '0x1111111111111111111111111111111111111111',
            },
        },
        {
            id: 'settlement-2',
            subscriptionId: 'sub-liq-ready',
            grossPnl: 80,
            settledAt: new Date('2026-02-26T10:00:00.000Z'),
            subscription: {
                walletAddress: '0x5555555555555555555555555555555555555555',
            },
        },
    ]);

    const referralFindMany = vi.fn().mockResolvedValue([
        {
            refereeAddress: '0x1111111111111111111111111111111111111111',
        },
    ]);

    const commissionLogFindMany = vi.fn().mockResolvedValue([]);

    vi.useFakeTimers();
    vi.setSystemTime(now);

    vi.resetModules();
    vi.doMock('@/lib/prisma', () => ({
        prisma: {
            managedSubscription: {
                findMany: managedSubscriptionFindMany,
            },
            managedSettlement: {
                findMany: managedSettlementFindMany,
            },
            referral: {
                findMany: referralFindMany,
            },
            commissionLog: {
                findMany: commissionLogFindMany,
            },
        },
        isDatabaseEnabled: true,
    }));

    vi.doMock('@/lib/participation-program/partner-program', () => ({
        isAdminRequest: () => params?.isAdmin ?? true,
    }));

    vi.doMock('@/lib/managed-wealth/subscription-position-scope', () => ({
        countManagedOpenPositionsWithFallback: (_db: unknown, input: { subscriptionId: string }) => {
            if (input.subscriptionId === 'sub-liq-backlog') {
                return Promise.resolve(2);
            }
            if (input.subscriptionId === 'sub-liq-ready') {
                return Promise.resolve(0);
            }
            return Promise.resolve(0);
        },
    }));

    const route = await import('@/app/api/managed-settlement/health/route');

    return {
        get: route.GET,
    };
}

describe('Managed settlement health route integration', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('rejects unauthorized requests', async () => {
        const { get } = await setupRoute({ isAdmin: false });

        const res = await get(createGetRequest('http://localhost/api/managed-settlement/health'));
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
    });

    it('returns allocation, liquidation backlog, and settlement-parity metrics', async () => {
        const { get } = await setupRoute({ isAdmin: true });

        const res = await get(createGetRequest('http://localhost/api/managed-settlement/health?windowDays=7&staleMappingMinutes=30'));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.allocation.executionScopeSubscriptions).toBe(4);
        expect(body.allocation.mappedCount).toBe(3);
        expect(body.allocation.unmappedCount).toBe(1);
        expect(body.allocation.staleUnmapped).toHaveLength(1);

        expect(body.liquidation.totalLiquidating).toBe(2);
        expect(body.liquidation.backlogCount).toBe(1);
        expect(body.liquidation.readyToSettleCount).toBe(1);

        expect(body.settlementCommissionParity.checkedSettlements).toBe(2);
        expect(body.settlementCommissionParity.settlementsWithReferral).toBe(1);
        expect(body.settlementCommissionParity.settlementsWithoutReferral).toBe(1);
        expect(body.settlementCommissionParity.missingCount).toBe(1);
        expect(body.settlementCommissionParity.feeMismatchCount).toBe(0);
    });
});
