import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ subscriptionId: string }> }
) {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json(
                { error: 'Database not configured' },
                { status: 503 }
            );
        }

        const { subscriptionId } = await params;
        const walletAddress = request.nextUrl.searchParams.get('wallet')?.toLowerCase();

        const settlement = await prisma.managedSettlement.findUnique({
            where: { subscriptionId },
            include: {
                subscription: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                slug: true,
                                name: true,
                                strategyProfile: true,
                                isGuaranteed: true,
                            },
                        },
                        term: {
                            select: {
                                id: true,
                                label: true,
                                durationDays: true,
                                minYieldRate: true,
                                performanceFeeRate: true,
                            },
                        },
                    },
                },
            },
        });

        if (!settlement) {
            return NextResponse.json(
                { error: 'Settlement not found for subscription' },
                { status: 404 }
            );
        }

        if (walletAddress && settlement.subscription.walletAddress !== walletAddress) {
            return NextResponse.json(
                { error: 'Settlement does not belong to wallet' },
                { status: 403 }
            );
        }

        return NextResponse.json({ settlement });
    } catch (error) {
        console.error('Failed to fetch managed settlement:', error);
        return NextResponse.json(
            { error: 'Failed to fetch managed settlement' },
            { status: 500 }
        );
    }
}
