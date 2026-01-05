import { NextResponse } from 'next/server';
import { prisma, generateReferralCode, normalizeAddress, errorResponse } from '../utils';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { walletAddress } = body;

        if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            return errorResponse('Invalid wallet address format');
        }

        const normalized = normalizeAddress(walletAddress);

        // Check if already registered
        const existing = await prisma.referrer.findUnique({
            where: { walletAddress: normalized },
        });

        if (existing) {
            return NextResponse.json({
                success: true,
                referralCode: existing.referralCode,
                walletAddress: existing.walletAddress,
                message: 'Already registered',
            });
        }

        // Generate unique referral code
        let referralCode = generateReferralCode(normalized);
        let attempt = 0;
        while (await prisma.referrer.findUnique({ where: { referralCode } })) {
            referralCode = referralCode + String.fromCharCode(65 + attempt);
            attempt++;
            if (attempt > 10) {
                return errorResponse('Could not generate unique referral code');
            }
        }

        // Create new referrer
        const referrer = await prisma.referrer.create({
            data: {
                walletAddress: normalized,
                referralCode,
            },
        });

        return NextResponse.json({
            success: true,
            referralCode: referrer.referralCode,
            walletAddress: referrer.walletAddress,
        });
    } catch (error) {
        console.error('Register error:', error);
        return errorResponse('Internal server error', 500);
    }
}
