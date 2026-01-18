
import { NextResponse } from 'next/server';
import { prisma, errorResponse } from '../utils';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
        return errorResponse('Wallet address required');
    }

    try {
        const referrer = await prisma.referrer.findUnique({
            where: { walletAddress },
            include: {
                payouts: {
                    orderBy: { createdAt: 'desc' },
                    take: 20
                }
            }
        });

        if (!referrer) {
            return errorResponse('Affiliate not found', 404);
        }

        // For this iteration, we return the aggregated stats + recent payouts.
        // In full implementation, we would query a detailed 'CommissionRecord' table.
        // Current implementation accumulates to 'totalEarned'.

        return NextResponse.json({
            totalEarned: referrer.totalEarned,
            pendingPayout: referrer.pendingPayout,
            recentPayouts: referrer.payouts,
            // ToDo: Detail breakout (Zero Line vs Sun Line) requires 'CommissionRecord' table which we haven't added yet to schema.
            // We'll stick to aggregated for now as per minimal change.
        });

    } catch (error) {
        console.error('Get commissions error:', error);
        return errorResponse('Internal server error', 500);
    }
}
