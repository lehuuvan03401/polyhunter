import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { z } from 'zod';
import { affiliateEngine } from '@/lib/services/affiliate-engine';
import {
    applyManagedSettlementMutation,
    calculateSettlementForSubscription,
    settleManagedProfitFeeIfNeeded,
    transitionSubscriptionToLiquidatingIfNeeded,
} from '@/lib/managed-wealth/managed-settlement-service';
import { countManagedOpenPositionsWithFallback } from '@/lib/managed-wealth/subscription-position-scope';

export const dynamic = 'force-dynamic';

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '')
    .split(',')
    .map((wallet) => wallet.toLowerCase().trim())
    .filter(Boolean);

function isAdmin(request: NextRequest): boolean {
    const adminWallet = request.headers.get('x-admin-wallet');
    if (process.env.NODE_ENV === 'development' && ADMIN_WALLETS.length === 0) {
        console.warn('[ManagedSettlementRun] Admin auth bypassed in development mode');
        return true;
    }
    if (!adminWallet) return false;
    return ADMIN_WALLETS.includes(adminWallet.toLowerCase());
}

const runSettlementSchema = z.object({
    dryRun: z.boolean().optional(),
    subscriptionIds: z.array(z.string()).optional(),
    limit: z.number().int().positive().max(500).optional(),
});

export async function POST(request: NextRequest) {
    try {
        if (!isAdmin(request)) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        if (!isDatabaseEnabled) {
            return NextResponse.json(
                { error: 'Database not configured' },
                { status: 503 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const parsed = runSettlementSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const dryRun = parsed.data.dryRun ?? false;
        const limit = parsed.data.limit ?? 200;
        const now = new Date();

        const candidates = await prisma.managedSubscription.findMany({
            where: {
                ...(parsed.data.subscriptionIds && parsed.data.subscriptionIds.length > 0
                    ? { id: { in: parsed.data.subscriptionIds } }
                    : {
                        status: { in: ['RUNNING', 'MATURED', 'LIQUIDATING'] },
                        endAt: { lte: now },
                    }),
            },
            include: {
                product: {
                    select: {
                        id: true,
                        slug: true,
                        isGuaranteed: true,
                        performanceFeeRate: true,
                    },
                },
                term: {
                    select: {
                        id: true,
                        minYieldRate: true,
                        performanceFeeRate: true,
                    },
                },
                settlement: {
                    select: { id: true, status: true },
                },
            },
            orderBy: { endAt: 'asc' },
            take: limit,
        });

        let settledCount = 0;
        let skippedCount = 0;
        const results: Array<Record<string, unknown>> = [];

        for (const sub of candidates) {
            if (sub.settlement?.status === 'COMPLETED') {
                skippedCount += 1;
                results.push({
                    subscriptionId: sub.id,
                    status: 'SKIPPED_ALREADY_SETTLED',
                });
                continue;
            }

            const openPositionsCount = await countManagedOpenPositionsWithFallback(prisma, {
                subscriptionId: sub.id,
                walletAddress: sub.walletAddress,
                copyConfigId: sub.copyConfigId,
            });

            if (openPositionsCount > 0) {
                if (!dryRun) {
                    await prisma.$transaction(async (tx) => {
                        await transitionSubscriptionToLiquidatingIfNeeded(tx, {
                            subscriptionId: sub.id,
                            currentStatus: sub.status,
                            copyConfigId: sub.copyConfigId,
                        });
                    });
                }

                skippedCount += 1;
                results.push({
                    subscriptionId: sub.id,
                    status: dryRun ? 'DRY_RUN_BLOCKED_OPEN_POSITIONS' : 'PENDING_LIQUIDATION',
                    openPositionsCount,
                });
                continue;
            }

            const { settlementCalc, guaranteeEligible } = calculateSettlementForSubscription(sub, now);

            if (dryRun) {
                settledCount += 1;
                results.push({
                    subscriptionId: sub.id,
                    status: 'DRY_RUN_READY',
                    guaranteeEligible,
                    ...settlementCalc,
                });
                continue;
            }

            const mutationResult = await prisma.$transaction(async (tx) =>
                applyManagedSettlementMutation(tx, {
                    subscriptionId: sub.id,
                    now,
                    reserveTopupNote: 'AUTO_SETTLEMENT_GUARANTEE_TOPUP',
                })
            );

            if (mutationResult.status === 'NOT_FOUND') {
                skippedCount += 1;
                results.push({
                    subscriptionId: sub.id,
                    status: 'SKIPPED_NOT_FOUND',
                });
                continue;
            }

            if (mutationResult.status === 'SKIPPED_ALREADY_SETTLED') {
                skippedCount += 1;
                results.push({
                    subscriptionId: sub.id,
                    status: 'SKIPPED_ALREADY_SETTLED',
                });
                continue;
            }

            settledCount += 1;
            results.push({
                subscriptionId: sub.id,
                status: 'SETTLED',
                principal: mutationResult.settlement.principal,
                finalPayout: mutationResult.settlement.finalPayout,
                reserveTopup: mutationResult.settlement.reserveTopup,
            });

            try {
                await settleManagedProfitFeeIfNeeded({
                    distributor: async (walletAddress, realizedProfit, tradeId, options) =>
                        affiliateEngine.distributeProfitFee(walletAddress, realizedProfit, tradeId, options),
                    walletAddress: sub.walletAddress,
                    subscriptionId: mutationResult.subscription.id,
                    settlementId: mutationResult.settlement.id,
                    grossPnl: mutationResult.settlement.grossPnl,
                    scope: 'MANAGED_WITHDRAWAL',
                    sourcePrefix: 'managed-withdraw',
                });
            } catch (affiliateError) {
                console.error('[ManagedSettlementRun] Profit fee distribution failed:', affiliateError);
            }
        }

        return NextResponse.json({
            dryRun,
            scanned: candidates.length,
            settledCount,
            skippedCount,
            results,
        });
    } catch (error) {
        console.error('Failed to run managed settlement:', error);
        return NextResponse.json(
            { error: 'Failed to run managed settlement' },
            { status: 500 }
        );
    }
}
