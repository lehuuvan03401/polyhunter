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

        const payouts = await prisma.payout.findMany({
            where: { referrerId: referrer.id },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(
            payouts.map((p) => ({
                id: p.id,
                amount: p.amountUsd,
                status: p.status,
                txHash: p.txHash,
                createdAt: p.createdAt.toISOString(),
                processedAt: p.processedAt?.toISOString() || null,
            }))
        );
    } catch (error) {
        console.error('Payouts error:', error);
        return errorResponse('Internal server error', 500);
    }
}
