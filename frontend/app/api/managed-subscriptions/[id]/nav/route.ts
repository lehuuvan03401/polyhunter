import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { resolveWalletContext } from '@/lib/managed-wealth/request-wallet';

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
        const walletContext = resolveWalletContext(request, {
            queryWallet: searchParams.get('wallet'),
            requireHeader: true,
        });
        const limit = Math.min(Math.max(Number(searchParams.get('limit') || 200), 1), 1000);

        if (!walletContext.ok) {
            return NextResponse.json(
                { error: walletContext.error },
                { status: walletContext.status }
            );
        }

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

        if (subscription.walletAddress !== walletContext.wallet) {
            return NextResponse.json(
                { error: 'Subscription does not belong to wallet' },
                { status: 403 }
            );
        }

        const latestSnapshots = await prisma.managedNavSnapshot.findMany({
            where: { subscriptionId: id },
            orderBy: { snapshotAt: 'desc' },
            take: limit,
        });
        const snapshots = [...latestSnapshots].reverse();

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
