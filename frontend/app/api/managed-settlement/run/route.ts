import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { z } from 'zod';
import { calculateManagedSettlement, calculateReserveBalance } from '@/lib/managed-wealth/settlement-math';

export const dynamic = 'force-dynamic';

const runSettlementSchema = z.object({
    dryRun: z.boolean().optional(),
    subscriptionIds: z.array(z.string()).optional(),
    limit: z.number().int().positive().max(500).optional(),
});

export async function POST(request: NextRequest) {
    try {
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
                        status: { in: ['RUNNING', 'MATURED'] },
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

            const settlementCalc = calculateManagedSettlement({
                principal: sub.principal,
                finalEquity: Number(sub.currentEquity ?? sub.principal),
                highWaterMark: sub.highWaterMark,
                performanceFeeRate: Number(sub.term.performanceFeeRate ?? sub.product.performanceFeeRate),
                isGuaranteed: sub.product.isGuaranteed,
                minYieldRate: sub.term.minYieldRate,
            });

            if (dryRun) {
                settledCount += 1;
                results.push({
                    subscriptionId: sub.id,
                    status: 'DRY_RUN_READY',
                    ...settlementCalc,
                });
                continue;
            }

            await prisma.$transaction(async (tx) => {
                const current = await tx.managedSubscription.findUnique({
                    where: { id: sub.id },
                    include: {
                        settlement: {
                            select: { id: true, status: true },
                        },
                    },
                });

                if (!current) return;
                if (current.settlement?.status === 'COMPLETED') return;

                if (settlementCalc.reserveTopup > 0) {
                    const reserveRows = await tx.reserveFundLedger.findMany({
                        select: { entryType: true, amount: true },
                    });
                    const reserveBalance = calculateReserveBalance(reserveRows);
                    const nextBalance = reserveBalance - settlementCalc.reserveTopup;

                    await tx.reserveFundLedger.create({
                        data: {
                            entryType: 'GUARANTEE_TOPUP',
                            amount: settlementCalc.reserveTopup,
                            balanceAfter: nextBalance,
                            subscriptionId: sub.id,
                            note: 'AUTO_SETTLEMENT_GUARANTEE_TOPUP',
                        },
                    });
                }

                await tx.managedSettlement.upsert({
                    where: { subscriptionId: sub.id },
                    update: {
                        status: 'COMPLETED',
                        principal: settlementCalc.principal,
                        finalEquity: settlementCalc.finalEquity,
                        grossPnl: settlementCalc.grossPnl,
                        highWaterMark: settlementCalc.highWaterMark,
                        hwmEligibleProfit: settlementCalc.hwmEligibleProfit,
                        performanceFeeRate: settlementCalc.performanceFeeRate,
                        performanceFee: settlementCalc.performanceFee,
                        guaranteedPayout: settlementCalc.guaranteedPayout,
                        reserveTopup: settlementCalc.reserveTopup,
                        finalPayout: settlementCalc.finalPayout,
                        errorMessage: null,
                        settledAt: now,
                    },
                    create: {
                        subscriptionId: sub.id,
                        status: 'COMPLETED',
                        principal: settlementCalc.principal,
                        finalEquity: settlementCalc.finalEquity,
                        grossPnl: settlementCalc.grossPnl,
                        highWaterMark: settlementCalc.highWaterMark,
                        hwmEligibleProfit: settlementCalc.hwmEligibleProfit,
                        performanceFeeRate: settlementCalc.performanceFeeRate,
                        performanceFee: settlementCalc.performanceFee,
                        guaranteedPayout: settlementCalc.guaranteedPayout,
                        reserveTopup: settlementCalc.reserveTopup,
                        finalPayout: settlementCalc.finalPayout,
                        settledAt: now,
                    },
                });

                await tx.managedSubscription.update({
                    where: { id: sub.id },
                    data: {
                        status: 'SETTLED',
                        currentEquity: settlementCalc.finalEquity,
                        highWaterMark: Math.max(current.highWaterMark, settlementCalc.finalEquity),
                        maturedAt: current.maturedAt ?? now,
                        settledAt: now,
                    },
                });
            });

            settledCount += 1;
            results.push({
                subscriptionId: sub.id,
                status: 'SETTLED',
                principal: settlementCalc.principal,
                finalPayout: settlementCalc.finalPayout,
                reserveTopup: settlementCalc.reserveTopup,
            });
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
