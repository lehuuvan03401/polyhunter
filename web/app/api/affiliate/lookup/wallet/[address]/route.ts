import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function normalizeAddress(address: string): string {
    return address.toLowerCase();
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ address: string }> }
) {
    try {
        const { address } = await params;
        const normalized = normalizeAddress(address);

        const referrer = await prisma.referrer.findUnique({
            where: { walletAddress: normalized },
        });

        if (referrer) {
            return NextResponse.json({
                registered: true,
                referralCode: referrer.referralCode,
                tier: referrer.tier,
            });
        }

        return NextResponse.json({ registered: false });
    } catch (error) {
        console.error('Lookup wallet error:', error);
        return NextResponse.json({ registered: false });
    }
}
