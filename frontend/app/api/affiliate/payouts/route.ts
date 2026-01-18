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

// Request a payout
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { walletAddress } = body;

        if (!walletAddress) {
            return errorResponse('Wallet address is required');
        }

        const normalized = normalizeAddress(walletAddress);

        // Transaction to ensure atomic balance update
        const result = await prisma.$transaction(async (tx) => {
            const referrer = await tx.referrer.findUnique({
                where: { walletAddress: normalized },
            });

            if (!referrer) {
                throw new Error('Wallet not registered as affiliate');
            }

            if (referrer.pendingPayout < 10) {
                throw new Error('Minimum withdrawal amount is $10');
            }

            const amount = referrer.pendingPayout;

            // Debit balance
            await tx.referrer.update({
                where: { id: referrer.id },
                data: { pendingPayout: 0 }
            });

            // Create Payout Record
            const payout = await tx.payout.create({
                data: {
                    referrerId: referrer.id,
                    amountUsd: amount,
                    status: 'PENDING',
                }
            });

            return payout;
        });

        return NextResponse.json({
            success: true,
            payoutId: result.id,
            amount: result.amountUsd,
            message: 'Withdrawal request submitted successfully'
        });

    } catch (error: any) {
        console.error('Payout request error:', error);
        return errorResponse(error.message || 'Internal server error', 400);
    }
}
