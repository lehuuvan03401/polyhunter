import { NextRequest, NextResponse } from 'next/server';
import { prisma, normalizeAddress, errorResponse } from '../utils';

export async function GET(request: NextRequest) {
    try {
        const walletAddress = request.nextUrl.searchParams.get('walletAddress');

        if (!walletAddress) {
            return errorResponse('Wallet address is required');
        }

        const normalized = normalizeAddress(walletAddress);

        const referrer = await prisma.referrer.findUnique({
            where: { walletAddress: normalized },
        });

        if (!referrer) {
            return errorResponse('Wallet not registered as affiliate', 404);
        }

        const referrals = await prisma.referral.findMany({
            where: { referrerId: referrer.id },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(
            referrals.map((r) => ({
                address: r.refereeAddress,
                joinedAt: r.createdAt.toISOString(),
                lifetimeVolume: r.lifetimeVolume,
                last30DaysVolume: r.last30DaysVolume,
                lastActiveAt: r.lastActiveAt?.toISOString() || null,
            }))
        );
    } catch (error) {
        console.error('Referrals error:', error);
        return errorResponse('Internal server error', 500);
    }
}
