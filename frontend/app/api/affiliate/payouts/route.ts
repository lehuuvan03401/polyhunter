import { NextRequest, NextResponse } from 'next/server';
import { prisma, normalizeAddress, errorResponse } from '../utils';
import { ethers } from 'ethers';

type PayoutRow = {
    id: string;
    amountUsd: number;
    status: string;
    txHash: string | null;
    createdAt: Date;
    processedAt: Date | null;
};

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
        }) as PayoutRow[];

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

/**
 * Generate the expected signature message for payout verification.
 */
function getPayoutMessage(walletAddress: string, amount: number, timestamp: number): string {
    return `Withdraw ${amount.toFixed(2)} USDC from PolyHunter Affiliate Program. Nonce: ${timestamp}`;
}

// Request a payout (with signature verification)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { walletAddress, signature, timestamp } = body;

        if (!walletAddress) {
            return errorResponse('Wallet address is required');
        }

        if (!signature) {
            return errorResponse('Signature is required for payout authorization', 401);
        }

        if (!timestamp) {
            return errorResponse('Timestamp is required', 400);
        }

        // Validate timestamp is within 5 minutes
        const now = Date.now();
        const signedTime = Number(timestamp);
        if (Math.abs(now - signedTime) > 5 * 60 * 1000) {
            return errorResponse('Signature expired. Please sign again.', 401);
        }

        const normalized = normalizeAddress(walletAddress);

        // First, get the referrer to know the amount for signature verification
        const referrer = await prisma.referrer.findUnique({
            where: { walletAddress: normalized },
        });

        if (!referrer) {
            return errorResponse('Wallet not registered as affiliate', 404);
        }

        if (referrer.pendingPayout < 10) {
            return errorResponse('Minimum withdrawal amount is $10', 400);
        }

        // Verify signature
        const expectedMessage = getPayoutMessage(normalized, referrer.pendingPayout, signedTime);

        try {
            const recoveredAddress = ethers.utils.verifyMessage(expectedMessage, signature);
            if (recoveredAddress.toLowerCase() !== normalized) {
                console.error(`Signature mismatch: expected ${normalized}, got ${recoveredAddress.toLowerCase()}`);
                return errorResponse('Invalid signature. Recovered address does not match.', 401);
            }
        } catch (sigError) {
            console.error('Signature verification error:', sigError);
            return errorResponse('Invalid signature format', 401);
        }

        // Proceed with payout (signature verified)
        const result = await prisma.$transaction(async (tx: any) => {
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

/**
 * Helper endpoint to get the message that needs to be signed
 * This allows frontend to display the exact message before signing
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { walletAddress, timestamp } = body;

        if (!walletAddress || !timestamp) {
            return errorResponse('walletAddress and timestamp are required');
        }

        const normalized = normalizeAddress(walletAddress);

        const referrer = await prisma.referrer.findUnique({
            where: { walletAddress: normalized },
        });

        if (!referrer) {
            return errorResponse('Wallet not registered as affiliate', 404);
        }

        const message = getPayoutMessage(normalized, referrer.pendingPayout, timestamp);

        return NextResponse.json({
            message,
            amount: referrer.pendingPayout
        });

    } catch (error) {
        console.error('Get payout message error:', error);
        return errorResponse('Internal server error', 500);
    }
}
