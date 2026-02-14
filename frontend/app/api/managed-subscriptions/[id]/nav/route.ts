import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json(
                { error: 'Database not configured' },
                { status: 503 }
            );
        }

        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('wallet')?.toLowerCase();
        const limit = Math.min(Math.max(Number(searchParams.get('limit') || 200), 1), 1000);

        const subscription = await prisma.managedSubscription.findUnique({
            where: { id },
            include: {
                product: {
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        strategyProfile: true,
                        isGuaranteed: true,
                        disclosurePolicy: true,
                        disclosureDelayHours: true,
                    },
                },
                term: {
                    select: {
                        id: true,
                        label: true,
                        durationDays: true,
                        targetReturnMin: true,
                        targetReturnMax: true,
                        maxDrawdown: true,
                        minYieldRate: true,
                        performanceFeeRate: true,
                    },
                },
                settlement: {
                    select: {
                        id: true,
                        status: true,
                        finalPayout: true,
                        performanceFee: true,
                        reserveTopup: true,
                        settledAt: true,
                    },
                },
            },
        });

        if (!subscription) {
            return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }

        if (walletAddress && subscription.walletAddress !== walletAddress) {
            return NextResponse.json(
                { error: 'Subscription does not belong to wallet' },
                { status: 403 }
            );
        }

        const snapshots = await prisma.managedNavSnapshot.findMany({
            where: { subscriptionId: id },
            orderBy: { snapshotAt: 'asc' },
            take: limit,
        });

        const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
        const peakNav = snapshots.reduce((max, point) => Math.max(max, point.nav), 1);
        const maxDrawdown = snapshots.reduce((max, point) => Math.max(max, point.drawdown ?? 0), 0);

        return NextResponse.json({
            subscription,
            summary: {
                latestNav: latest?.nav ?? 1,
                latestEquity: latest?.equity ?? subscription.currentEquity ?? subscription.principal,
                cumulativeReturn: latest?.cumulativeReturn ?? 0,
                maxDrawdown,
                peakNav,
                points: snapshots.length,
            },
            snapshots,
        });
    } catch (error) {
        console.error('Failed to fetch managed NAV:', error);
        return NextResponse.json(
            { error: 'Failed to fetch managed NAV' },
            { status: 500 }
        );
    }
}
