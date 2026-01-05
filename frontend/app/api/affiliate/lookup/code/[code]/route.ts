import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;

        const referrer = await prisma.referrer.findUnique({
            where: { referralCode: code.toUpperCase() },
        });

        if (referrer) {
            return NextResponse.json({
                valid: true,
                walletAddress: referrer.walletAddress,
            });
        }

        return NextResponse.json({ valid: false });
    } catch (error) {
        console.error('Lookup code error:', error);
        return NextResponse.json({ valid: false });
    }
}
