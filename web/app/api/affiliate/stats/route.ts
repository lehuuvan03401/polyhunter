import { NextRequest, NextResponse } from 'next/server';
import { prisma, normalizeAddress, errorResponse } from '../utils';
import { buildDoubleZonePromotionProgress } from '@/lib/participation-program/promotion';
import { PARTICIPATION_LEVEL_RULES } from '@/lib/participation-program/levels';

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

        // Get actual double zone progression
        const [progress] = await buildDoubleZonePromotionProgress(prisma, [normalized]);

        // Find current dividend rate for current V-Level
        const currentRule = PARTICIPATION_LEVEL_RULES.find(r => r.level === progress.promotionLevel);
        const dividendRate = currentRule ? currentRule.dividendRate : 0;

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

        const sameLevelEarnings = earnings.find(e => e.type === 'SAME_LEVEL')?._sum?.amount || 0;
        const teamDividendEarnings = earnings.find(e => e.type === 'TEAM_DIVIDEND')?._sum?.amount || 0;

        // Also map old ZERO_LINE/SUN_LINE if they exist for backward compat during migration
        const zeroLineEarnings = earnings.find(e => e.type === ('ZERO_LINE' as any))?._sum?.amount || 0;
        const sunLineEarnings = earnings.find(e => e.type === ('SUN_LINE' as any))?._sum?.amount || 0;

        return NextResponse.json({
            walletAddress: referrer.walletAddress,
            referralCode: referrer.referralCode,

            // DoubleZone V1-V9 Fields
            level: progress.promotionLevel,
            commissionRate: dividendRate,
            weakZoneUsd: progress.weakZoneNetDepositUsd,
            strongZoneUsd: progress.strongZoneNetDepositUsd,
            leftUsd: progress.leftNetDepositUsd,
            rightUsd: progress.rightNetDepositUsd,
            nextLevel: progress.nextLevel,
            nextLevelThresholdUsd: progress.nextLevelThresholdUsd,
            volumeToNextTier: progress.nextLevelGapUsd,
            legBreakdown: progress.legBreakdown,
            directLegCount: progress.directLegCount,

            // General Affiliate Fields
            totalVolumeGenerated: referrer.totalVolume,
            totalReferrals: referrer._count.referrals,
            teamSize,
            earningsBreakdown: {
                sameLevel: Number(sameLevelEarnings) + Number(zeroLineEarnings),
                teamDividend: Number(teamDividendEarnings) + Number(sunLineEarnings)
            },
            sunLineCount: referrer.sunLineCount, // Deprecated conceptually but kept for API structure
            maxDepth: referrer.maxDepth,
            totalEarned: referrer.totalEarned,
            pendingPayout: referrer.pendingPayout,
        });
    } catch (error) {
        console.error('Stats error:', error);
        return errorResponse('Internal server error', 500);
    }
}
