import { NextRequest, NextResponse } from 'next/server';
import { prisma, normalizeAddress, errorResponse, TIER_RATES, TIER_THRESHOLDS } from '../utils';

export async function GET(request: NextRequest) {
    try {
        const walletAddress = request.nextUrl.searchParams.get('walletAddress');

        if (!walletAddress) {
            return errorResponse('Wallet address is required');
        }

        const normalized = normalizeAddress(walletAddress);

        const referrer = await prisma.referrer.findUnique({
            where: { walletAddress: normalized },
            include: {
                _count: {
                    select: { referrals: true },
                },
            },
        });

        if (!referrer) {
            return errorResponse('Wallet not registered as affiliate', 404);
        }

        // Calculate next tier
        const currentTier = referrer.tier as keyof typeof TIER_THRESHOLDS;
        const tiers = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'] as const;
        const currentIndex = tiers.indexOf(currentTier);
        const nextTier = currentIndex < 4 ? tiers[currentIndex + 1] : null;
        const volumeToNextTier = nextTier
            ? Math.max(0, TIER_THRESHOLDS[nextTier] - referrer.totalVolume)
            : 0;

        return NextResponse.json({
            walletAddress: referrer.walletAddress,
            referralCode: referrer.referralCode,
            tier: referrer.tier,
            commissionRate: TIER_RATES[currentTier],
            totalVolumeGenerated: referrer.totalVolume,
            totalReferrals: referrer._count.referrals,
            totalEarned: referrer.totalEarned,
            pendingPayout: referrer.pendingPayout,
            volumeToNextTier,
            nextTier,
        });
    } catch (error) {
        console.error('Stats error:', error);
        return errorResponse('Internal server error', 500);
    }
}
