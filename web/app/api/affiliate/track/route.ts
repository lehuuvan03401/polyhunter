import { NextResponse } from 'next/server';
import { prisma, normalizeAddress, errorResponse } from '../utils';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { referralCode, referrerWallet, refereeAddress } = body;

        if (!referralCode && !referrerWallet) {
            return errorResponse('Referral code or referrer wallet is required');
        }

        if (!refereeAddress || !/^0x[a-fA-F0-9]{40}$/.test(refereeAddress)) {
            return errorResponse('Invalid referee address format');
        }

        const normalizedReferee = normalizeAddress(refereeAddress);

        // Check if referee already tracked
        const existingReferral = await prisma.referral.findUnique({
            where: { refereeAddress: normalizedReferee },
        });

        if (existingReferral) {
            return NextResponse.json({
                success: true,
                message: 'Already tracked',
            });
        }

        // Find referrer by code OR wallet
        let referrer = null;

        if (referralCode) {
            referrer = await prisma.referrer.findUnique({
                where: { referralCode: referralCode.toUpperCase() },
            });
        }

        if (!referrer && referrerWallet) {
            referrer = await prisma.referrer.findUnique({
                where: { walletAddress: normalizeAddress(referrerWallet) },
            });
        }

        if (!referrer) {
            return errorResponse('Invalid referral code or wallet');
        }

        // Prevent self-referral
        if (referrer.walletAddress === normalizedReferee) {
            return errorResponse('Cannot refer yourself');
        }

        // Create referral
        await prisma.referral.create({
            data: {
                referrerId: referrer.id,
                refereeAddress: normalizedReferee,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Track error:', error);
        return errorResponse('Internal server error', 500);
    }
}
