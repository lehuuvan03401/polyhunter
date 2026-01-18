import { NextRequest, NextResponse } from 'next/server';
import { prisma, normalizeAddress, errorResponse, TIER_RATES, TIER_THRESHOLDS } from '../utils';
import { AffiliateTier } from '@prisma/client';

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
        const currentTier = referrer.tier as AffiliateTier;
        const tiers = [
            AffiliateTier.ORDINARY,
            AffiliateTier.VIP,
            AffiliateTier.ELITE,
            AffiliateTier.PARTNER,
            AffiliateTier.SUPER_PARTNER
        ] as const;
        const currentIndex = tiers.indexOf(currentTier);
        const nextTier = currentIndex < 4 ? tiers[currentIndex + 1] : null;

        // Use Team Differential Rate for "commissionRate" display, or Zero Line?
        // Frontend displays "Zero Line" and "Team Diff" separately now, inferred from Tier.
        // But for backward compat or generic display:

        const volumeToNextTier = nextTier
            ? Math.max(0, TIER_THRESHOLDS[nextTier] - referrer.totalVolume)
            : 0;

        // Calculate real Team Size (Closure)
        const teamSize = await prisma.teamClosure.count({
            where: {
                ancestorId: referrer.id,
                depth: { gt: 0 }
            }
        });

        // Calculate Earnings Breakdown
        const earnings = await prisma.commissionLog.groupBy({
            by: ['type'],
            where: { referrerId: referrer.id },
            _sum: { amount: true }
        });

        const zeroLineEarnings = earnings.find(e => e.type === 'ZERO_LINE')?._sum.amount || 0;
        const sunLineEarnings = earnings.find(e => e.type === 'SUN_LINE')?._sum.amount || 0;

        return NextResponse.json({
            walletAddress: referrer.walletAddress,
            referralCode: referrer.referralCode,
            tier: referrer.tier,
            commissionRate: TIER_RATES[currentTier],
            totalVolumeGenerated: referrer.totalVolume,
            totalReferrals: referrer._count.referrals, // Directs
            teamSize, // Total Downline
            earningsBreakdown: {
                zeroLine: zeroLineEarnings,
                sunLine: sunLineEarnings
            },
            sunLineCount: referrer.sunLineCount,
            maxDepth: referrer.maxDepth,
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
