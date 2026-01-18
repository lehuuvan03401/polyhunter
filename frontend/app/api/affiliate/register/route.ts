import { NextResponse } from 'next/server';
import { prisma, errorResponse, normalizeAddress } from '../utils';
import { AffiliateEngine } from '../../../../lib/services/affiliate-engine';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { walletAddress, sponsorCode } = body; // Accept sponsorCode

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

        // Use AffiliateEngine to Register (Populate Closure Table)
        const engine = new AffiliateEngine(prisma);
        const referrer = await engine.registerMember(normalized, sponsorCode);

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
