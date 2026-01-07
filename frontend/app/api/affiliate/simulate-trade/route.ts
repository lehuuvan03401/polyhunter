import { NextResponse } from 'next/server';
import { prisma, normalizeAddress, errorResponse, TIER_RATES, getTierFromVolume } from '../utils';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { refereeAddress, volume } = body;

        if (!refereeAddress || !volume || volume <= 0) {
            return errorResponse('Valid refereeAddress and positive volume required');
        }

        const normalizedReferee = normalizeAddress(refereeAddress);

        // 1. Find referral link
        const referral = await prisma.referral.findUnique({
            where: { refereeAddress: normalizedReferee },
            include: { referrer: true },
        });

        if (!referral) {
            return errorResponse('This wallet is not referred by anyone', 404);
        }

        const referrer = referral.referrer;

        // 2. Calculate Commission
        // Commission = Volume * FeeRate (Assuming 0.1% fee) * TierRate
        // For simulation, let's assume we are passing the "Fee Amount" directly or deriving it?
        // Let's assume input 'volume' is the trade volume.
        // Standard fee = 0.1%? Let's assume standard fee is input or fixed.
        // Let's assume volume is the TRADE NOTIONAL.

        // Polymarket fees? Usually no fees on standard markets, but let's assume this is a "Fee Share" program.
        // Let's assume we earn 1% fee on the volume for this hypothetical program, or just use a fixed mock fee.
        // For simplicity: We calculate commission based on a fixed 0.1% platform fee.
        const platformFee = volume * 0.001;

        // Referrer share
        const tier = referrer.tier as keyof typeof TIER_RATES;
        const commissionRate = TIER_RATES[tier];
        const commissionEarned = platformFee * commissionRate;

        // 3. Update Referrer Stats
        const newTotalVolume = referrer.totalVolume + volume;
        const newTier = getTierFromVolume(newTotalVolume);

        await prisma.referrer.update({
            where: { id: referrer.id },
            data: {
                totalVolume: { increment: volume },
                totalEarned: { increment: commissionEarned },
                pendingPayout: { increment: commissionEarned },
                tier: newTier, // Auto-upgrade tier
            },
        });

        // 4. Update Referral Record Stats
        await prisma.referral.update({
            where: { id: referral.id },
            data: {
                lifetimeVolume: { increment: volume },
                last30DaysVolume: { increment: volume },
                lastActiveAt: new Date(),
            },
        });

        return NextResponse.json({
            success: true,
            commissionEarned,
            oldTier: tier,
            newTier,
            referrer: referrer.walletAddress
        });

    } catch (error) {
        console.error('Simulation error:', error);
        return errorResponse('Internal server error', 500);
    }
}
