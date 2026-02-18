import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type TransactionEvent = {
    id: string;
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'MATURED';
    date: string;
    amount: number;
    productName: string;
    strategyProfile: string;
    termLabel: string;
    subscriptionId: string;
    status: 'COMPLETED' | 'PENDING';
    pnl?: number;
    pnlPct?: number;
};

export async function GET(request: NextRequest) {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json({
                transactions: [],
                source: 'static',
                message: 'Database not configured',
            });
        }

        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('wallet');

        if (!walletAddress) {
            return NextResponse.json(
                { error: 'Missing wallet address' },
                { status: 400 }
            );
        }

        const subscriptions = await prisma.managedSubscription.findMany({
            where: {
                walletAddress: walletAddress.toLowerCase(),
            },
            include: {
                product: {
                    select: {
                        name: true,
                        strategyProfile: true,
                    },
                },
                term: {
                    select: {
                        label: true,
                    },
                },
                settlement: {
                    select: {
                        id: true,
                        status: true,
                        finalPayout: true,
                        grossPnl: true,
                        principal: true,
                        settledAt: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        const transactions: TransactionEvent[] = [];

        for (const sub of subscriptions) {
            // 1. DEPOSIT event — when subscription was created
            transactions.push({
                id: `dep-${sub.id}`,
                type: 'DEPOSIT',
                date: sub.createdAt.toISOString(),
                amount: sub.principal,
                productName: sub.product.name,
                strategyProfile: sub.product.strategyProfile,
                termLabel: sub.term.label,
                subscriptionId: sub.id,
                status: 'COMPLETED',
            });

            // 2. MATURED event — if subscription has maturedAt
            if (sub.maturedAt) {
                transactions.push({
                    id: `mat-${sub.id}`,
                    type: 'MATURED',
                    date: sub.maturedAt.toISOString(),
                    amount: sub.currentEquity ?? sub.principal,
                    productName: sub.product.name,
                    strategyProfile: sub.product.strategyProfile,
                    termLabel: sub.term.label,
                    subscriptionId: sub.id,
                    status: 'COMPLETED',
                });
            }

            // 3. WITHDRAWAL event — if settlement exists
            if (sub.settlement) {
                const pnl = sub.settlement.grossPnl;
                const pnlPct = sub.settlement.principal > 0
                    ? (pnl / sub.settlement.principal) * 100
                    : 0;

                transactions.push({
                    id: `wth-${sub.id}`,
                    type: 'WITHDRAWAL',
                    date: (sub.settlement.settledAt ?? sub.settledAt ?? sub.updatedAt).toISOString(),
                    amount: sub.settlement.finalPayout,
                    productName: sub.product.name,
                    strategyProfile: sub.product.strategyProfile,
                    termLabel: sub.term.label,
                    subscriptionId: sub.id,
                    status: sub.settlement.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
                    pnl,
                    pnlPct,
                });
            }
        }

        // Sort all events by date descending
        transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json({ transactions });
    } catch (error) {
        console.error('Failed to fetch transactions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch transactions' },
            { status: 500 }
        );
    }
}
