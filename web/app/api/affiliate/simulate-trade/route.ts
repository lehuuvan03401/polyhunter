import { NextResponse } from 'next/server';
import { affiliateEngine } from '@/lib/services/affiliate-engine';
import { prisma, normalizeAddress, errorResponse } from '../utils';

type CommissionLogRow = {
    type: string;
    referrer: {
        walletAddress: string;
        tier: string;
    };
    generation: number;
    amount: number;
};

/**
 * POST /api/affiliate/simulate-trade
 * Simulates a trade and triggers full commission distribution (Zero Line + Sun Line)
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { refereeAddress, volume } = body;

        if (!refereeAddress || !volume || volume <= 0) {
            return errorResponse('Valid refereeAddress and positive volume required');
        }

        const normalizedReferee = normalizeAddress(refereeAddress);

        // 1. Check if this wallet is referred
        const referral = await prisma.referral.findUnique({
            where: { refereeAddress: normalizedReferee },
            include: { referrer: true },
        });

        if (!referral) {
            return errorResponse('This wallet is not referred by anyone', 404);
        }

        // 2. Calculate platform fee (assume 0.1% of volume)
        const platformFee = volume * 0.001;

        // 3. Use the full distributeCommissions logic
        const tradeId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        console.log(`[SimulateTrade] Starting distribution for ${normalizedReferee}`);
        console.log(`[SimulateTrade] Volume: $${volume}, Platform Fee: $${platformFee}`);

        await affiliateEngine.distributeCommissions({
            tradeId,
            traderAddress: normalizedReferee,
            platformFee,
            volume,
        });

        // 4. Query the newly created commission logs
        const recentCommissions = await prisma.commissionLog.findMany({
            where: {
                sourceUserId: normalizedReferee,
                createdAt: { gte: new Date(Date.now() - 10000) } // Last 10 seconds
            },
            include: { referrer: true },
            orderBy: { createdAt: 'desc' }
        }) as CommissionLogRow[];

        // 5. Summarize results
        const summary = {
            zeroLine: recentCommissions.filter((c) => c.type === 'ZERO_LINE').map((c) => ({
                referrer: c.referrer.walletAddress.slice(0, 10) + '...',
                tier: c.referrer.tier,
                generation: c.generation,
                amount: c.amount.toFixed(4)
            })),
            sunLine: recentCommissions.filter((c) => c.type === 'SUN_LINE').map((c) => ({
                referrer: c.referrer.walletAddress.slice(0, 10) + '...',
                tier: c.referrer.tier,
                generation: c.generation,
                amount: c.amount.toFixed(4)
            })),
        };

        return NextResponse.json({
            success: true,
            tradeId,
            volume,
            platformFee,
            commissions: {
                zeroLineCount: summary.zeroLine.length,
                sunLineCount: summary.sunLine.length,
                details: summary
            },
            message: `Distributed to ${recentCommissions.length} referrers`
        });

    } catch (error) {
        console.error('Simulation error:', error);
        return errorResponse('Internal server error', 500);
    }
}
