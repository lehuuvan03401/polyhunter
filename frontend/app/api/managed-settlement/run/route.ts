import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const runSettlementSchema = z.object({
    dryRun: z.boolean().optional(),
    subscriptionIds: z.array(z.string()).optional(),
    limit: z.number().int().positive().max(500).optional(),
});

type ReserveBalance = {
    balance: number;
};

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

            const principal = sub.principal;
            const finalEquity = Number(sub.currentEquity ?? principal);
            const grossPnl = finalEquity - principal;
            const highWaterMark = Math.max(sub.highWaterMark, principal);
            const hwmEligibleProfit = Math.max(0, finalEquity - highWaterMark);
            const performanceFeeRate = Number(sub.term.performanceFeeRate ?? sub.product.performanceFeeRate);
            const performanceFee = hwmEligibleProfit * performanceFeeRate;
            const preGuaranteePayout = principal + grossPnl - performanceFee;

            let guaranteedPayout: number | null = null;
            let reserveTopup = 0;

            if (sub.product.isGuaranteed) {
                const minYieldRate = Number(sub.term.minYieldRate ?? 0);
                guaranteedPayout = principal * (1 + minYieldRate);
                reserveTopup = Math.max(0, guaranteedPayout - preGuaranteePayout);
            }

            const finalPayout = preGuaranteePayout + reserveTopup;

            if (dryRun) {
                settledCount += 1;
                results.push({
                    subscriptionId: sub.id,
                    status: 'DRY_RUN_READY',
                    principal,
                    finalEquity,
                    grossPnl,
                    performanceFeeRate,
                    performanceFee,
                    guaranteedPayout,
                    reserveTopup,
                    finalPayout,
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

                if (reserveTopup > 0) {
                    const reserveRows = await tx.reserveFundLedger.findMany({
                        select: { entryType: true, amount: true },
                    });
                    const reserve: ReserveBalance = {
                        balance: reserveRows.reduce((acc, row) => {
                            if (row.entryType === 'DEPOSIT' || row.entryType === 'ADJUSTMENT') return acc + row.amount;
                            if (row.entryType === 'WITHDRAW' || row.entryType === 'GUARANTEE_TOPUP') return acc - row.amount;
                            return acc;
                        }, 0),
                    };
                    const nextBalance = reserve.balance - reserveTopup;

                    await tx.reserveFundLedger.create({
                        data: {
                            entryType: 'GUARANTEE_TOPUP',
                            amount: reserveTopup,
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
                        principal,
                        finalEquity,
                        grossPnl,
                        highWaterMark,
                        hwmEligibleProfit,
                        performanceFeeRate,
                        performanceFee,
                        guaranteedPayout,
                        reserveTopup,
                        finalPayout,
                        errorMessage: null,
                        settledAt: now,
                    },
                    create: {
                        subscriptionId: sub.id,
                        status: 'COMPLETED',
                        principal,
                        finalEquity,
                        grossPnl,
                        highWaterMark,
                        hwmEligibleProfit,
                        performanceFeeRate,
                        performanceFee,
                        guaranteedPayout,
                        reserveTopup,
                        finalPayout,
                        settledAt: now,
                    },
                });

                await tx.managedSubscription.update({
                    where: { id: sub.id },
                    data: {
                        status: 'SETTLED',
                        currentEquity: finalEquity,
                        highWaterMark: Math.max(current.highWaterMark, finalEquity),
                        maturedAt: current.maturedAt ?? now,
                        settledAt: now,
                    },
                });
            });

            settledCount += 1;
            results.push({
                subscriptionId: sub.id,
                status: 'SETTLED',
                principal,
                finalPayout,
                reserveTopup,
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
