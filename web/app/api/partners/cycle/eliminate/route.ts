import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import {
    MONTHLY_ELIMINATION_COUNT,
    buildPartnerSeatRanking,
    computeRefundDeadline,
    isAdminRequest,
    parseMonthKey,
    toMonthKey,
} from '@/lib/participation-program/partner-program';

export const dynamic = 'force-dynamic';

const eliminationSchema = z.object({
    monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    eliminateCount: z.number().int().positive().max(100).optional(),
    dryRun: z.boolean().optional().default(false),
    reason: z.string().max(200).optional(),
});

const listSchema = z.object({
    monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    source: z.enum(['AUTO', 'SNAPSHOT', 'LIVE']).optional().default('AUTO'),
});

export async function GET(request: NextRequest) {
    try {
        if (!isAdminRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const { searchParams } = new URL(request.url);
        const parsed = listSchema.safeParse({
            monthKey: searchParams.get('monthKey') || undefined,
            source: searchParams.get('source') || undefined,
        });
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const monthKey = parsed.data.monthKey ?? toMonthKey(new Date());
        parseMonthKey(monthKey);

        const snapshotRanks = parsed.data.source === 'LIVE'
            ? []
            : await prisma.partnerMonthlyRank.findMany({
                where: { monthKey },
                include: {
                    seat: {
                        select: {
                            id: true,
                            walletAddress: true,
                            status: true,
                            joinedAt: true,
                            seatFeeUsd: true,
                            privilegeLevel: true,
                            backendAccess: true,
                        },
                    },
                },
                orderBy: { rank: 'asc' },
            });

        const eliminationRows = await prisma.partnerElimination.findMany({
            where: { monthKey },
            include: {
                refund: {
                    select: {
                        id: true,
                        status: true,
                        amountUsd: true,
                        requestedAt: true,
                        completedAt: true,
                        txHash: true,
                        errorMessage: true,
                    },
                },
            },
            orderBy: { rankAtElimination: 'asc' },
        });
        const eliminationMap = new Map(
            eliminationRows.map((row) => [row.seatId, row])
        );

        const useSnapshot = parsed.data.source !== 'LIVE' && snapshotRanks.length > 0;

        if (useSnapshot) {
            const ranking = snapshotRanks.map((row) => ({
                seatId: row.seatId,
                walletAddress: row.seat.walletAddress,
                seatStatus: row.seat.status,
                rank: row.rank,
                scoreNetDepositUsd: row.scoreNetDepositUsd,
                scoreActiveManagedUsd: (row as any).scoreActiveManagedUsd || 0, // Fallback for old records
                joinedAt: row.seat.joinedAt,
                seatFeeUsd: row.seat.seatFeeUsd,
                elimination: eliminationMap.get(row.seatId) ?? null,
            }));

            return NextResponse.json({
                monthKey,
                source: 'SNAPSHOT',
                ranking,
                eliminationCount: eliminationRows.length,
            });
        }

        const activeSeats = await prisma.partnerSeat.findMany({
            where: { status: 'ACTIVE' },
            select: {
                id: true,
                walletAddress: true,
                seatFeeUsd: true,
                joinedAt: true,
            },
        });

        const ranking = await buildPartnerSeatRanking(prisma, activeSeats);
        const eliminationPreview = [...ranking]
            .sort((a, b) => {
                if (a.scoreNetDepositUsd !== b.scoreNetDepositUsd) {
                    return a.scoreNetDepositUsd - b.scoreNetDepositUsd;
                }
                if (a.joinedAt.getTime() !== b.joinedAt.getTime()) {
                    return b.joinedAt.getTime() - a.joinedAt.getTime();
                }
                return b.walletAddress.localeCompare(a.walletAddress);
            })
            .slice(0, Math.min(MONTHLY_ELIMINATION_COUNT, ranking.length));

        return NextResponse.json({
            monthKey,
            source: 'LIVE',
            ranking,
            eliminationCount: eliminationRows.length,
            eliminationPreview,
        });
    } catch (error) {
        console.error('[PartnerElimination] GET failed:', error);
        return NextResponse.json({ error: 'Failed to fetch elimination cycle data' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!isAdminRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const body = await request.json().catch(() => ({}));
        const parsed = eliminationSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const monthKey = parsed.data.monthKey ?? toMonthKey(new Date());
        parseMonthKey(monthKey);

        let task = await prisma.partnerEliminationTask.findUnique({
            where: { monthKey }
        });

        if (task) {
            if (task.status === 'COMPLETED') {
                return NextResponse.json(
                    {
                        error: 'Cycle already executed for this month',
                        code: 'CYCLE_ALREADY_EXECUTED',
                        monthKey,
                    },
                    { status: 409 }
                );
            } else if (task.status === 'PROCESSING') {
                return NextResponse.json({
                    error: 'Cycle is currently processing',
                    code: 'CYCLE_PROCESSING',
                    monthKey,
                }, { status: 429 });
            }
        } else {
            task = await prisma.partnerEliminationTask.create({
                data: { monthKey, status: 'PROCESSING', startedAt: new Date() }
            });
        }

        const activeSeats = await prisma.partnerSeat.findMany({
            where: { status: 'ACTIVE' },
            select: {
                id: true,
                walletAddress: true,
                seatFeeUsd: true,
                joinedAt: true,
            },
        });

        if (activeSeats.length === 0) {
            if (!parsed.data.dryRun) {
                await prisma.partnerEliminationTask.update({
                    where: { id: task!.id },
                    data: { status: 'COMPLETED', completedAt: new Date(), totalSeats: 0 }
                });
            }
            return NextResponse.json({
                monthKey,
                dryRun: parsed.data.dryRun,
                message: 'No active seats to process',
                processed: 0,
            });
        }

        const ranked = await buildPartnerSeatRanking(prisma, activeSeats);

        const eliminateCount = Math.min(
            parsed.data.eliminateCount ?? MONTHLY_ELIMINATION_COUNT,
            ranked.length
        );

        const eliminationCandidates = [...ranked]
            .sort((a, b) => {
                if (a.scoreNetDepositUsd !== b.scoreNetDepositUsd) {
                    return a.scoreNetDepositUsd - b.scoreNetDepositUsd;
                }
                if (a.joinedAt.getTime() !== b.joinedAt.getTime()) {
                    return b.joinedAt.getTime() - a.joinedAt.getTime();
                }
                return b.walletAddress.localeCompare(a.walletAddress);
            })
            .slice(0, eliminateCount);

        if (parsed.data.dryRun) {
            return NextResponse.json({
                monthKey,
                dryRun: true,
                activeSeatCount: ranked.length,
                eliminateCount,
                ranked,
                eliminationCandidates,
            });
        }

        // Mark processing started
        await prisma.partnerEliminationTask.update({
            where: { id: task!.id },
            data: { status: 'PROCESSING', totalSeats: ranked.length }
        });

        const now = new Date();
        const refundDeadline = computeRefundDeadline(now);
        let processed = 0;
        let eliminated = 0;

        try {
            for (let i = task!.processedSeats; i < ranked.length; i++) {
                const seat = ranked[i];
                const isEliminated = eliminationCandidates.some(c => c.id === seat.id);

                await prisma.$transaction(async (tx) => {
                    // 1. Record rank
                    await tx.partnerMonthlyRank.upsert({
                        where: { seatId_monthKey: { seatId: seat.id, monthKey } },
                        update: {
                            rank: seat.rank,
                            scoreNetDepositUsd: seat.scoreNetDepositUsd,
                            scoreActiveManagedUsd: seat.scoreActiveManagedUsd,
                            snapshotAt: now,
                        },
                        create: {
                            seatId: seat.id,
                            monthKey,
                            rank: seat.rank,
                            scoreNetDepositUsd: seat.scoreNetDepositUsd,
                            scoreActiveManagedUsd: seat.scoreActiveManagedUsd,
                            snapshotAt: now,
                        },
                    });

                    // 2. Perform elimination if applicable
                    if (isEliminated) {
                        const elimination = await tx.partnerElimination.upsert({
                            where: { seatId_monthKey: { seatId: seat.id, monthKey } },
                            update: {
                                rankAtElimination: seat.rank,
                                scoreNetDepositUsd: seat.scoreNetDepositUsd,
                                scoreActiveManagedUsd: seat.scoreActiveManagedUsd,
                                reason: parsed.data.reason,
                                eliminatedAt: now,
                                refundDeadlineAt: refundDeadline,
                            },
                            create: {
                                seatId: seat.id,
                                monthKey,
                                rankAtElimination: seat.rank,
                                scoreNetDepositUsd: seat.scoreNetDepositUsd,
                                scoreActiveManagedUsd: seat.scoreActiveManagedUsd,
                                reason: parsed.data.reason,
                                eliminatedAt: now,
                                refundDeadlineAt: refundDeadline,
                            },
                        });

                        await tx.partnerRefund.upsert({
                            where: { eliminationId: elimination.id },
                            update: { amountUsd: seat.seatFeeUsd, status: 'PENDING' },
                            create: {
                                seatId: seat.id,
                                eliminationId: elimination.id,
                                amountUsd: seat.seatFeeUsd,
                                status: 'PENDING',
                            },
                        });

                        await tx.partnerSeat.update({
                            where: { id: seat.id },
                            data: {
                                status: 'ELIMINATED',
                                backendAccess: false,
                                eliminatedAt: now,
                            },
                        });
                        eliminated++;
                    }

                    // 3. Update task progress
                    processed++;
                    await tx.partnerEliminationTask.update({
                        where: { id: task!.id },
                        data: { processedSeats: task!.processedSeats + processed }
                    });
                });
            }

            await prisma.partnerEliminationTask.update({
                where: { id: task!.id },
                data: { status: 'COMPLETED', completedAt: new Date() }
            });

        } catch (err: any) {
            await prisma.partnerEliminationTask.update({
                where: { id: task!.id },
                data: { status: 'FAILED', errorLog: err.message || 'Unknown error' }
            });
            throw err;
        }

        return NextResponse.json({
            monthKey,
            dryRun: false,
            activeSeatCount: ranked.length,
            eliminateCount,
            eliminated,
            refundDeadline,
        });
    } catch (error) {
        console.error('[PartnerElimination] POST failed:', error);
        return NextResponse.json({ error: 'Failed to run elimination cycle' }, { status: 500 });
    }
}
