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

        const existingCycleCount = await prisma.partnerElimination.count({
            where: { monthKey },
        });
        if (existingCycleCount > 0) {
            return NextResponse.json(
                {
                    error: 'Cycle already executed for this month',
                    code: 'CYCLE_ALREADY_EXECUTED',
                    monthKey,
                    eliminationCount: existingCycleCount,
                },
                { status: 409 }
            );
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

        const now = new Date();
        const refundDeadline = computeRefundDeadline(now);

        const result = await prisma.$transaction(async (tx) => {
            for (const seat of ranked) {
                await tx.partnerMonthlyRank.upsert({
                    where: {
                        seatId_monthKey: {
                            seatId: seat.id,
                            monthKey,
                        },
                    },
                    update: {
                        rank: seat.rank,
                        scoreNetDepositUsd: seat.scoreNetDepositUsd,
                        snapshotAt: now,
                    },
                    create: {
                        seatId: seat.id,
                        monthKey,
                        rank: seat.rank,
                        scoreNetDepositUsd: seat.scoreNetDepositUsd,
                        snapshotAt: now,
                    },
                });
            }

            let eliminated = 0;
            for (const candidate of eliminationCandidates) {
                const elimination = await tx.partnerElimination.upsert({
                    where: {
                        seatId_monthKey: {
                            seatId: candidate.id,
                            monthKey,
                        },
                    },
                    update: {
                        rankAtElimination: candidate.rank,
                        scoreNetDepositUsd: candidate.scoreNetDepositUsd,
                        reason: parsed.data.reason,
                        eliminatedAt: now,
                        refundDeadlineAt: refundDeadline,
                    },
                    create: {
                        seatId: candidate.id,
                        monthKey,
                        rankAtElimination: candidate.rank,
                        scoreNetDepositUsd: candidate.scoreNetDepositUsd,
                        reason: parsed.data.reason,
                        eliminatedAt: now,
                        refundDeadlineAt: refundDeadline,
                    },
                });

                await tx.partnerRefund.upsert({
                    where: { eliminationId: elimination.id },
                    update: {
                        amountUsd: candidate.seatFeeUsd,
                        status: 'PENDING',
                    },
                    create: {
                        seatId: candidate.id,
                        eliminationId: elimination.id,
                        amountUsd: candidate.seatFeeUsd,
                        status: 'PENDING',
                    },
                });

                await tx.partnerSeat.update({
                    where: { id: candidate.id },
                    data: {
                        status: 'ELIMINATED',
                        backendAccess: false,
                        eliminatedAt: now,
                    },
                });

                eliminated += 1;
            }

            return { eliminated };
        });

        return NextResponse.json({
            monthKey,
            dryRun: false,
            activeSeatCount: ranked.length,
            eliminateCount,
            eliminated: result.eliminated,
            refundDeadline,
        });
    } catch (error) {
        console.error('[PartnerElimination] POST failed:', error);
        return NextResponse.json({ error: 'Failed to run elimination cycle' }, { status: 500 });
    }
}
