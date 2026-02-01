
import { NextResponse } from 'next/server';
import { polyClient } from '@/lib/polymarket';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET() {
    try {
        // Fetch top 100 to get a good volume sum representation
        const leaderboard = await polyClient.dataApi.getLeaderboard({ limit: 100 });

        // Ensure minimum trader count of 147 for marketing purposes
        const actualCount = leaderboard.total || 0;
        const traderCount = Math.max(actualCount, 147);
        const totalVolume = leaderboard.entries.reduce((sum, e) => sum + (e.volume || 0), 0);

        return NextResponse.json({
            traderCount,
            totalVolume
        });
    } catch (error) {
        console.warn('[HomeStats] Live fetch failed, falling back to cache:', error);

        try {
            if (!isDatabaseEnabled) {
                return NextResponse.json({ traderCount: 500, totalVolume: 2000000, source: 'static' });
            }
            // Fallback: Calculate from standard cache
            // We use '90d' period (ALL time) as the best proxy for "Total Volume"
            const entries = await prisma.cachedTraderLeaderboard.findMany({
                where: { period: '90d' },
                select: { traderData: true }
            });

            if (entries.length > 0) {
                const fallbackVolume = entries.reduce((sum, entry) => {
                    const data = entry.traderData as any;
                    return sum + (data.volume || 0);
                }, 0);

                return NextResponse.json({
                    traderCount: 500, // Hardcode decent number or derived estimate if possible
                    totalVolume: fallbackVolume,
                    cached: true
                });
            }

            // If cache is empty, return default marketing numbers
            return NextResponse.json({ traderCount: 500, totalVolume: 2000000, source: 'default' });

        } catch (dbError) {
            console.error('[HomeStats] DB fallback failed:', dbError);
            // Ultimate fallback to hardcoded marketing numbers to prevent UI error
            return NextResponse.json({ traderCount: 500, totalVolume: 2000000, source: 'static' });
        }
    }
}
