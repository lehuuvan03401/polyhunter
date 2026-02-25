import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import {
    MONTHLY_ELIMINATION_COUNT,
    buildPartnerSeatRanking,
    isAdminRequest,
    parseMonthKey,
    toMonthKey,
} from '@/lib/participation-program/partner-program';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
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
        const parsed = querySchema.safeParse({
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

        const [snapshotRanks, eliminations] = await Promise.all([
            parsed.data.source === 'LIVE'
                ? Promise.resolve([])
                : prisma.partnerMonthlyRank.findMany({
                    where: { monthKey },
                    include: {
                        seat: {
                            select: {
                                id: true,
                                walletAddress: true,
                                status: true,
                                joinedAt: true,
                                seatFeeUsd: true,
                            },
                        },
                    },
                    orderBy: { rank: 'asc' },
                }),
            prisma.partnerElimination.findMany({
                where: { monthKey },
                include: {
                    refund: {
                        select: {
                            id: true,
                            status: true,
                            amountUsd: true,
                            requestedAt: true,
                            completedAt: true,
                        },
                    },
                },
            }),
        ]);

        const eliminationMap = new Map(eliminations.map((item) => [item.seatId, item]));

        if (parsed.data.source !== 'LIVE' && snapshotRanks.length > 0) {
            const ranking = snapshotRanks.map((row) => ({
                seatId: row.seatId,
                walletAddress: row.seat.walletAddress,
                rank: row.rank,
                scoreNetDepositUsd: row.scoreNetDepositUsd,
                seatStatus: row.seat.status,
                joinedAt: row.seat.joinedAt,
                seatFeeUsd: row.seat.seatFeeUsd,
                elimination: eliminationMap.get(row.seatId) ?? null,
            }));

            return NextResponse.json({
                monthKey,
                source: 'SNAPSHOT',
                ranking,
                eliminationCount: eliminations.length,
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
            eliminationCount: eliminations.length,
            eliminationPreview,
        });
    } catch (error) {
        console.error('[PartnerRankings] GET failed:', error);
        return NextResponse.json({ error: 'Failed to fetch partner rankings' }, { status: 500 });
    }
}
