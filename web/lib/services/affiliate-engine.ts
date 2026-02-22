
import { PrismaClient, AffiliateTier } from '@prisma/client';
import { Referrer } from '@prisma/client'; // Import type

export interface TradeContext {
    tradeId: string;
    traderAddress: string; // The user who traded
    volume: number; // USD Volume
    platformFee: number; // The fee collected by platform
}

// Tier thresholds based on team size (direct referrals and total team)
const TIER_REQUIREMENTS: Partial<Record<AffiliateTier, { directReferrals: number; teamSize: number }>> = {
    [AffiliateTier.VIP]: { directReferrals: 3, teamSize: 10 },
    [AffiliateTier.ELITE]: { directReferrals: 10, teamSize: 100 },
    [AffiliateTier.PARTNER]: { directReferrals: 30, teamSize: 500 },
    [AffiliateTier.SUPER_PARTNER]: { directReferrals: 50, teamSize: 1000 },
};

const TIER_ORDER: AffiliateTier[] = [
    AffiliateTier.ORDINARY,
    AffiliateTier.VIP,
    AffiliateTier.ELITE,
    AffiliateTier.PARTNER,
    AffiliateTier.SUPER_PARTNER,
];

export class AffiliateEngine {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    /**
     * Registers a new affiliate with an optional sponsor.
     * Handles Closure Table population.
     */
    async registerMember(walletAddress: string, sponsorCode?: string): Promise<Referrer> {
        // 1. Validate Sponsor
        let sponsor: Referrer | null = null;
        if (sponsorCode) {
            sponsor = await this.prisma.referrer.findUnique({ where: { referralCode: sponsorCode } });
        }

        // 2. Create Member
        const code = Math.random().toString(36).substring(2, 8).toUpperCase(); // Simple code gen
        const newMember = await this.prisma.referrer.create({
            data: {
                walletAddress,
                referralCode: code,
                tier: AffiliateTier.ORDINARY
            }
        });

        // 3. Populate Closure Table
        // Self-reference (Depth 0)
        await this.prisma.teamClosure.create({
            data: {
                ancestorId: newMember.id,
                descendantId: newMember.id,
                depth: 0
            }
        });

        if (sponsor) {
            // Copy all ancestors of sponsor and add 1 to depth
            const sponsorAncestors = await this.prisma.teamClosure.findMany({
                where: { descendantId: sponsor.id }
            });

            const closureInserts = sponsorAncestors.map(anc => ({
                ancestorId: anc.ancestorId,
                descendantId: newMember.id,
                depth: anc.depth + 1
            }));

            if (closureInserts.length > 0) {
                await this.prisma.teamClosure.createMany({ data: closureInserts });
            }
        }

        return newMember;
    }

    /**
     * Calculates and distributes commissions for a completed trade.
     * Also updates volume tracking and checks for tier upgrades.
     */
    async distributeCommissions(context: TradeContext) {
        console.log(`[AffiliateEngine] Distributing for ${context.tradeId} (Fee: $${context.platformFee}, Volume: $${context.volume})`);

        // 1. Find the User's Referrer (The direct parent)
        const referralRecord = await this.prisma.referral.findUnique({
            where: { refereeAddress: context.traderAddress },
            include: { referrer: true }
        });

        if (!referralRecord) return; // No upline

        const directSponsor = referralRecord.referrer;

        // 2. Update Volume Tracking
        await this.updateVolumeTracking(referralRecord.id, directSponsor.id, context);

        // 3. Get Ancestry Chain (up to 15 gens)
        const ancestry = await this.prisma.teamClosure.findMany({
            where: {
                descendantId: directSponsor.id,
                depth: { lte: 15 }
            },
            include: { ancestor: true },
            orderBy: { depth: 'asc' }
        });

        // Track which referrers received commissions for tier upgrade check
        const rewardedReferrerIds: string[] = [];
        let maxRatePaid = 0;

        for (const record of ancestry) {
            const member = record.ancestor;
            const gen = record.depth + 1; // 1-based generation from Trader

            // --- ZERO LINE (Direct Bonus) ---
            const zeroRate = this.getZeroLineRate(gen);
            if (zeroRate > 0) {
                const amount = context.platformFee * zeroRate;
                await this.recordCommission(
                    member.id,
                    amount,
                    'ZERO_LINE',
                    context.tradeId,
                    context.traderAddress,
                    gen
                );
                if (!rewardedReferrerIds.includes(member.id)) {
                    rewardedReferrerIds.push(member.id);
                }
            }

            // --- SUN LINE (Team Differential) ---
            const teamRate = this.getTeamRate(member.tier);

            if (teamRate > maxRatePaid) {
                const differential = teamRate - maxRatePaid;
                const bonusAmount = context.platformFee * differential;

                if (bonusAmount > 0) {
                    await this.recordCommission(
                        member.id,
                        bonusAmount,
                        'SUN_LINE',
                        context.tradeId,
                        context.traderAddress,
                        gen
                    );
                    if (!rewardedReferrerIds.includes(member.id)) {
                        rewardedReferrerIds.push(member.id);
                    }
                    maxRatePaid = teamRate;
                }
            }

            if (maxRatePaid >= 0.08) break; // SUPER_PARTNER max rate
        }

        // 4. Check tier upgrades for all rewarded referrers
        for (const referrerId of rewardedReferrerIds) {
            await this.checkAndUpgradeTier(referrerId);
        }
    }

    /**
     * Updates volume tracking at multiple levels.
     */
    private async updateVolumeTracking(
        referralId: string,
        directSponsorId: string,
        context: TradeContext
    ) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await this.prisma.$transaction(async (tx) => {
            // 1. Update Referral.lifetimeVolume and last30DaysVolume
            await tx.referral.update({
                where: { id: referralId },
                data: {
                    lifetimeVolume: { increment: context.volume },
                    last30DaysVolume: { increment: context.volume },
                    lastActiveAt: new Date()
                }
            });

            // 2. Update direct sponsor's totalVolume
            await tx.referrer.update({
                where: { id: directSponsorId },
                data: {
                    totalVolume: { increment: context.volume }
                }
            });

            // 3. Cascade teamVolume to all ancestors (up to 15 generations)
            const ancestors = await tx.teamClosure.findMany({
                where: {
                    descendantId: directSponsorId,
                    depth: { gt: 0, lte: 15 }
                },
                select: { ancestorId: true }
            });

            for (const anc of ancestors) {
                await tx.referrer.update({
                    where: { id: anc.ancestorId },
                    data: {
                        teamVolume: { increment: context.volume }
                    }
                });
            }

            // 4. Create/Update ReferralVolume daily aggregation
            const existingDailyRecord = await tx.referralVolume.findFirst({
                where: {
                    referrerId: directSponsorId,
                    date: today
                }
            });

            if (existingDailyRecord) {
                await tx.referralVolume.update({
                    where: { id: existingDailyRecord.id },
                    data: {
                        volumeUsd: { increment: context.volume },
                        commissionUsd: { increment: context.platformFee },
                        tradeCount: { increment: 1 }
                    }
                });
            } else {
                await tx.referralVolume.create({
                    data: {
                        referrerId: directSponsorId,
                        date: today,
                        volumeUsd: context.volume,
                        commissionUsd: context.platformFee,
                        tradeCount: 1
                    }
                });
            }
        });

        console.log(`[AffiliateEngine] Volume tracking updated: $${context.volume} for sponsor ${directSponsorId}`);
    }

    /**
     * Checks and upgrades a referrer's tier based on team metrics.
     */
    async checkAndUpgradeTier(referrerId: string): Promise<boolean> {
        const referrer = await this.prisma.referrer.findUnique({
            where: { id: referrerId },
            include: {
                _count: {
                    select: { referrals: true }
                }
            }
        });

        if (!referrer) return false;

        // Get team size from closure table
        const teamSize = await this.prisma.teamClosure.count({
            where: {
                ancestorId: referrerId,
                depth: { gt: 0 }
            }
        });

        const directReferrals = referrer._count.referrals;
        const currentTierIndex = TIER_ORDER.indexOf(referrer.tier);

        // Check each higher tier
        for (let i = TIER_ORDER.length - 1; i > currentTierIndex; i--) {
            const targetTier = TIER_ORDER[i];
            const requirements = TIER_REQUIREMENTS[targetTier];

            if (!requirements) continue;

            if (directReferrals >= requirements.directReferrals &&
                teamSize >= requirements.teamSize) {
                // Upgrade!
                await this.prisma.referrer.update({
                    where: { id: referrerId },
                    data: { tier: targetTier }
                });
                console.log(`[AffiliateEngine] 🎉 Tier Upgrade: ${referrer.walletAddress} -> ${targetTier}`);
                return true;
            }
        }

        return false;
    }

    // ========================================
    // PROFIT-BASED FEE SYSTEM (NEW)
    // ========================================

    /**
     * Volume-based fee tiers for profit fees.
     * Higher cumulative volume = lower fee rate.
     */
    private getFeeRateByVolume(cumulativeVolume: number): number {
        // Hardcoded tiers (can be moved to DB VolumeTier table later)
        if (cumulativeVolume >= 100000) return 0.10; // 10% (Whale)
        if (cumulativeVolume >= 10000) return 0.15;  // 15% (Pro)
        return 0.20;                                  // 20% (Standard)
    }

    /**
     * Distributes commissions based on REALIZED PROFIT (not volume).
     * Only called when profit > 0.
     * 
     * @param traderAddress - The follower who made the trade
     * @param realizedProfit - The profit amount in USDC
     * @param tradeId - Unique trade identifier
     */
    async distributeProfitFee(traderAddress: string, realizedProfit: number, tradeId: string) {
        // 1. Guard: No fee if no profit
        if (realizedProfit <= 0) {
            console.log(`[AffiliateEngine] No profit ($${realizedProfit.toFixed(4)}), skipping fee distribution.`);
            return;
        }

        // 2. Find the User's Referrer
        const referralRecord = await this.prisma.referral.findUnique({
            where: { refereeAddress: traderAddress.toLowerCase() },
            include: { referrer: true }
        });

        if (!referralRecord) {
            console.log(`[AffiliateEngine] ${traderAddress} has no referrer. Skipping profit fee.`);
            return;
        }

        const directSponsor = referralRecord.referrer;

        // 3. Get follower's cumulative volume to determine fee rate
        const followerVolume = referralRecord.lifetimeVolume || 0;
        const feeRate = this.getFeeRateByVolume(followerVolume);
        const feeAmount = realizedProfit * feeRate;

        console.log(`[AffiliateEngine] Profit Fee: $${realizedProfit.toFixed(4)} * ${(feeRate * 100).toFixed(0)}% = $${feeAmount.toFixed(4)} (Volume: $${followerVolume.toFixed(0)})`);

        // 4. Record the commission as a special "PROFIT_FEE" type
        await this.recordCommission(
            directSponsor.id,
            feeAmount,
            'PROFIT_FEE',
            tradeId,
            traderAddress,
            1 // Generation 1 (direct)
        );

        // 5. Optionally: Distribute partial to upline (Sun Line style)?
        // For MVP, we keep it simple and only pay the direct sponsor.
        // Future: Get ancestry and apply differential rates.

        console.log(`[AffiliateEngine] ✅ Profit Fee Distributed: $${feeAmount.toFixed(4)} to ${directSponsor.walletAddress}`);
    }

    private getZeroLineRate(gen: number): number {
        switch (gen) {
            case 1: return 0.25;
            case 2: return 0.10;
            case 3: return 0.05;
            case 4: return 0.03;
            case 5: return 0.02;
            default: return 0;
        }
    }

    private getTeamRate(tier: AffiliateTier): number {
        switch (tier) {
            case AffiliateTier.ORDINARY: return 0.01;
            case AffiliateTier.VIP: return 0.02;
            case AffiliateTier.ELITE: return 0.03;
            case AffiliateTier.PARTNER: return 0.05;
            case AffiliateTier.SUPER_PARTNER: return 0.08;
            default: return 0;
        }
    }

    private async recordCommission(
        referrerId: string,
        amount: number,
        type: string,
        tradeId: string,
        traderAddress: string,
        generation: number
    ) {
        await this.prisma.$transaction(async (tx) => {
            // Update referrer balance
            await tx.referrer.update({
                where: { id: referrerId },
                data: {
                    totalEarned: { increment: amount },
                    pendingPayout: { increment: amount }
                }
            });

            // Create ledger entry with full details
            await tx.commissionLog.create({
                data: {
                    referrerId,
                    amount,
                    type,
                    sourceTradeId: tradeId,
                    sourceUserId: traderAddress,
                    generation: type === 'ZERO_LINE' ? generation : null
                }
            });
        });
        console.log(`[AffiliateEngine] Paid $${amount.toFixed(4)} (${type} Gen${generation}) to ${referrerId}`);
    }
}

// Singleton instance for API routes
import { prisma } from '../prisma.js';
export const affiliateEngine = new AffiliateEngine(prisma);
