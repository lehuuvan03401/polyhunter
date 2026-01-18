
import { PrismaClient, AffiliateTier } from '@prisma/client';
import { Referrer } from '@prisma/client'; // Import type

export interface TradeContext {
    tradeId: string;
    traderAddress: string; // The user who traded
    volume: number; // USD Volume
    platformFee: number; // The fee collected by platform
}

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
            // Query raw or use loop if efficiency is concern.
            // For closure table: Insert (A -> New, depth = A->Sponsor + 1) for all A where A is ancestor of Sponsor
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
     */
    async distributeCommissions(context: TradeContext) {
        console.log(`[AffiliateEngine] Distributing for ${context.tradeId} (Fee: $${context.platformFee})`);

        // 1. Find the User's Referrer (The direct parent)
        // In the Schema, Referral model links User-defined address to a Referrer.
        const referralParams = await this.prisma.referral.findUnique({
            where: { refereeAddress: context.traderAddress },
            include: { referrer: true }
        });

        if (!referralParams) return; // No upline

        const directSponsor = referralParams.referrer;

        // 2. Get Ancestry Chain (up to 15 gens)
        const ancestry = await this.prisma.teamClosure.findMany({
            where: {
                descendantId: directSponsor.id, // Start from the direct sponsor
                depth: { lte: 15 }
            },
            include: { ancestor: true },
            orderBy: { depth: 'asc' } // 0=DirectSponsor, 1=GrandSponsor, etc. (Wait, logic check below)
        });

        // Note: In Closure Table for Member X:
        // Ancestor=X, Descendant=X, Depth=0
        // Ancestor=Sponsor, Descendant=X, Depth=1
        // Ancestor=GrandSponsor, Descendant=X, Depth=2

        // So 'ancestry' list contains the upline.
        // We iterate them.

        // --- ZERO LINE (Direct Bonus) ---
        // Paid to the nearest 5 ancestors. 
        // depth=0 is direct sponsor relative to himself? No.
        // In 'ancestry' list query above:
        // ancestor=Sponsor, descendant=Sponsor, depth=0 (Self)
        // ancestor=GrandSponsor, descendant=Sponsor, depth=1

        // But the TRADER is 'refereeAddress'. The 'Referrer' linked is the direct sponsor.
        // So for the TRADER, the 'Direct Sponsor' is Generation 1.
        // The 'Grand Sponsor' is Generation 2.

        // So we iterate `ancestry`:
        // Item with depth=0 is Direct Sponsor (Gen 1 for Trader)
        // Item with depth=1 is Grand Sponsor (Gen 2 for Trader)
        // ...

        // ...

        let maxRatePaid = 0;

        for (const record of ancestry) {
            const member = record.ancestor;
            const gen = record.depth + 1; // 1-based generation from Trader

            // Calc Zero Line
            const zeroRate = this.getZeroLineRate(gen);
            if (zeroRate > 0) {
                const amount = context.platformFee * zeroRate;
                await this.recordCommission(member.id, amount, 'ZERO_LINE', context.tradeId);
            }


            // --- SUN LINE (Team Differential) ---
            // Requirement: (UplineBonusRate - DownlineBonusRate) * Volume
            // Logic:
            // 1. Traverse up. Keep track of the 'current max rate paid'.
            // 2. Initial state: maxRatePaid = 0.
            // 3. For each ancestor:
            //    a. Determine their 'Team Rate' based on Rank (Tier).
            //    b. If TeamRate > maxRatePaid:
            //       - Bonus = (TeamRate - maxRatePaid) * Volume
            //       - Pay Bonus
            //       - Update maxRatePaid = TeamRate
            //    c. If maxRatePaid >= MaxPossibleRate, stop.

            // Get ancestor's tier to determine rate
            // We need to fetch the ancestor's tier if not available.
            // In the current `ancestry` query, we included `ancestor`.

            // Map Tier to Rate
            const teamRate = this.getTeamRate(member.tier);

            if (teamRate > maxRatePaid) {
                const differential = teamRate - maxRatePaid;
                const bonusAmount = context.platformFee * differential; // Based on fee (or volume? Spec says Volume in formula loop but context.platformFee in ZeroLine)
                // Clarification: Usually MLM is on volume or fee. ZeroLine uses fee. SunLine should likely use fee to be sustainable.
                // Spec says context.platformFee * differential.

                if (bonusAmount > 0) {
                    await this.recordCommission(member.id, bonusAmount, 'SUN_LINE', context.tradeId);
                    maxRatePaid = teamRate;
                }
            }

            if (maxRatePaid >= 0.08) break; // SUPER_PARTNER max rate
        }
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

    private async recordCommission(referrerId: string, amount: number, type: string, refId: string) {
        if (amount < 0.01) return;
        // In real app, create a detailed Ledger entry. 
        // For MVP, update totalEarned and create Payout record or Commission Log.
        await this.prisma.referrer.update({
            where: { id: referrerId },
            data: {
                totalEarned: { increment: amount },
                pendingPayout: { increment: amount }
            }
        });
        console.log(`[AffiliateEngine] Paid $${amount.toFixed(4)} (${type}) to ${referrerId}`);
    }
}
