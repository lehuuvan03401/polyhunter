import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

function createPostRequest(url: string, body: unknown, headers?: Record<string, string>) {
    return new NextRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
}

const ORIGINAL_ADMIN_WALLETS = process.env.ADMIN_WALLETS;

async function setupRunRoute() {
    const countManagedOpenPositionsWithFallback = vi.fn().mockResolvedValue(0);
    const calculateSettlementForSubscription = vi.fn().mockReturnValue({
        settlementCalc: {
            finalPayout: 1100,
        },
        guaranteeEligible: true,
    });
    const applyManagedSettlementMutation = vi.fn().mockResolvedValue({
        status: 'COMPLETED',
        subscription: {
            id: 'sub-1',
        },
        settlement: {
            id: 'settlement-1',
            principal: 1000,
            finalPayout: 1100,
            reserveTopup: 0,
            grossPnl: 100,
        },
    });
    const settleManagedProfitFeeIfNeeded = vi.fn().mockResolvedValue({
        commissionStatus: 'COMPLETED',
    });

    vi.resetModules();
    process.env.ADMIN_WALLETS = '0xadmin';

    vi.doMock('@/lib/prisma', () => ({
        prisma: {
            managedSubscription: {
                findMany: vi.fn().mockResolvedValue([
                    {
                        id: 'sub-1',
                        walletAddress: '0xuser',
                        copyConfigId: 'cfg-1',
                        status: 'MATURED',
                        endAt: new Date('2026-03-01T00:00:00.000Z'),
                        product: {
                            id: 'prod-1',
                            slug: 'prod-1',
                            isGuaranteed: true,
                            performanceFeeRate: 0.1,
                        },
                        term: {
                            id: 'term-1',
                            minYieldRate: 0.02,
                            performanceFeeRate: 0.1,
                        },
                        settlement: null,
                    },
                ]),
            },
            $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({})),
        },
        isDatabaseEnabled: true,
    }));

    vi.doMock('@/lib/services/affiliate-engine', () => ({
        affiliateEngine: {
            distributeProfitFee: vi.fn(),
        },
    }));

    vi.doMock('@/lib/managed-wealth/managed-settlement-service', () => ({
        applyManagedSettlementMutation,
        calculateSettlementForSubscription,
        settleManagedProfitFeeIfNeeded,
        transitionSubscriptionToLiquidatingIfNeeded: vi.fn(),
    }));

    vi.doMock('@/lib/managed-wealth/subscription-position-scope', () => ({
        countManagedOpenPositionsWithFallback,
    }));

    const route = await import('@/app/api/managed-settlement/run/route');

    return {
        post: route.POST,
        mocks: {
            calculateSettlementForSubscription,
            applyManagedSettlementMutation,
            settleManagedProfitFeeIfNeeded,
            countManagedOpenPositionsWithFallback,
        },
    };
}

async function setupWithdrawRoute() {
    const countManagedOpenPositionsWithFallback = vi.fn().mockResolvedValue(0);
    const calculateSettlementForSubscription = vi.fn().mockReturnValue({
        settlementCalc: {
            finalPayout: 1100,
            finalEquity: 1100,
        },
    });
    const applyManagedSettlementMutation = vi.fn().mockResolvedValue({
        status: 'COMPLETED',
        subscription: {
            id: 'sub-1',
        },
        settlement: {
            id: 'settlement-1',
            grossPnl: 100,
            finalPayout: 1100,
        },
        guaranteeEligible: true,
    });
    const settleManagedProfitFeeIfNeeded = vi.fn().mockResolvedValue({
        commissionStatus: 'COMPLETED',
    });

    vi.resetModules();

    vi.doMock('@/lib/prisma', () => ({
        prisma: {
            $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
                callback({
                    managedSubscription: {
                        findUnique: vi.fn().mockResolvedValue({
                            id: 'sub-1',
                            walletAddress: '0xuser',
                            copyConfigId: 'cfg-1',
                            status: 'MATURED',
                            createdAt: new Date('2026-02-01T00:00:00.000Z'),
                            startAt: new Date('2026-02-01T00:00:00.000Z'),
                            endAt: new Date('2026-03-01T00:00:00.000Z'),
                            principal: 1000,
                            term: {
                                id: 'term-1',
                                durationDays: 30,
                                minYieldRate: 0.02,
                                performanceFeeRate: 0.1,
                            },
                            product: {
                                id: 'prod-1',
                                isGuaranteed: true,
                                performanceFeeRate: 0.1,
                            },
                            settlement: null,
                        }),
                    },
                    managedRiskEvent: {
                        create: vi.fn(),
                    },
                })
            ),
        },
        isDatabaseEnabled: true,
    }));

    vi.doMock('@/lib/managed-wealth/request-wallet', () => ({
        resolveWalletContext: vi.fn().mockReturnValue({
            ok: true,
            wallet: '0xuser',
        }),
    }));

    vi.doMock('@/lib/services/affiliate-engine', () => ({
        affiliateEngine: {
            distributeProfitFee: vi.fn(),
        },
    }));

    vi.doMock('@/lib/managed-wealth/managed-settlement-service', () => ({
        applyManagedSettlementMutation,
        calculateSettlementForSubscription,
        settleManagedProfitFeeIfNeeded,
        transitionSubscriptionToLiquidatingIfNeeded: vi.fn(),
    }));

    vi.doMock('@/lib/managed-wealth/subscription-position-scope', () => ({
        countManagedOpenPositionsWithFallback,
    }));

    const route = await import('@/app/api/managed-subscriptions/[id]/withdraw/route');

    return {
        post: route.POST,
        mocks: {
            calculateSettlementForSubscription,
            applyManagedSettlementMutation,
            settleManagedProfitFeeIfNeeded,
            countManagedOpenPositionsWithFallback,
        },
    };
}

describe('Managed settlement entrypoint parity integration', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        if (ORIGINAL_ADMIN_WALLETS === undefined) {
            delete process.env.ADMIN_WALLETS;
        } else {
            process.env.ADMIN_WALLETS = ORIGINAL_ADMIN_WALLETS;
        }
    });

    it('admin batch settlement uses the shared settlement workflow and profit-fee distribution contract', async () => {
        const { post, mocks } = await setupRunRoute();

        const res = await post(
            createPostRequest(
                'http://localhost/api/managed-settlement/run',
                {},
                { 'x-admin-wallet': '0xadmin' }
            )
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.settledCount).toBe(1);
        expect(mocks.countManagedOpenPositionsWithFallback).toHaveBeenCalledTimes(1);
        expect(mocks.calculateSettlementForSubscription).toHaveBeenCalledTimes(1);
        expect(mocks.applyManagedSettlementMutation).toHaveBeenCalledTimes(1);
        expect(mocks.settleManagedProfitFeeIfNeeded).toHaveBeenCalledWith(
            expect.objectContaining({
                walletAddress: '0xuser',
                subscriptionId: 'sub-1',
                settlementId: 'settlement-1',
                scope: 'MANAGED_WITHDRAWAL',
                sourcePrefix: 'managed-withdraw',
            })
        );
    });

    it('manual withdrawal uses the same settlement workflow and profit-fee distribution contract', async () => {
        const { post, mocks } = await setupWithdrawRoute();

        const res = await post(
            createPostRequest('http://localhost/api/managed-subscriptions/sub-1/withdraw', {
                confirm: true,
                walletAddress: '0xuser',
            }),
            {
                params: Promise.resolve({ id: 'sub-1' }),
            }
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mocks.countManagedOpenPositionsWithFallback).toHaveBeenCalledTimes(1);
        expect(mocks.calculateSettlementForSubscription).toHaveBeenCalledTimes(1);
        expect(mocks.applyManagedSettlementMutation).toHaveBeenCalledTimes(1);
        expect(mocks.settleManagedProfitFeeIfNeeded).toHaveBeenCalledWith(
            expect.objectContaining({
                walletAddress: '0xuser',
                subscriptionId: 'sub-1',
                settlementId: 'settlement-1',
                scope: 'MANAGED_WITHDRAWAL',
                sourcePrefix: 'managed-withdraw',
            })
        );
    });
});
