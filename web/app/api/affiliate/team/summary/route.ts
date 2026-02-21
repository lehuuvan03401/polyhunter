
import { NextResponse } from 'next/server';
import { prisma, errorResponse, normalizeAddress } from '../../utils';

/**
 * GET /api/affiliate/team/summary
 * Returns generation breakdown for the affiliate's team
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
        return errorResponse('Wallet address required');
    }

    try {
        const normalized = normalizeAddress(walletAddress);

        const referrer = await prisma.referrer.findUnique({
            where: { walletAddress: normalized },
            select: { id: true }
        });

        if (!referrer) {
            return errorResponse('Affiliate not found', 404);
        }

        // Group by depth to get generation counts
        const generationCounts = await prisma.teamClosure.groupBy({
            by: ['depth'],
            where: {
                ancestorId: referrer.id,
                depth: { gt: 0, lte: 15 } // Gen 1-15
            },
            _count: { descendantId: true },
            orderBy: { depth: 'asc' }
        });

        // Transform to frontend format
        const byGeneration = generationCounts.map((g: any) => ({
            generation: g.depth,
            count: g._count.descendantId
        }));

        const total = byGeneration.reduce((sum, g) => sum + g.count, 0);

        // Calculate percentages
        const withPercentages = byGeneration.map(g => ({
            ...g,
            percentage: total > 0 ? Math.round((g.count / total) * 100) : 0
        }));

        return NextResponse.json({
            total,
            byGeneration: withPercentages
        });

    } catch (error) {
        console.error('Get team summary error:', error);
        return errorResponse('Internal server error', 500);
    }
}
