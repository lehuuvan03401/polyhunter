import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { resolveWalletContext } from '@/lib/managed-wealth/request-wallet';

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
    netPnl?: number;
    netPnlPct?: number;
    grossPnl?: number;
    performanceFee?: number;
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
        const walletContext = resolveWalletContext(request, {
            queryWallet: searchParams.get('wallet'),
            requireHeader: true,
            requireSignature: true,
        });
        const limit = Math.min(Math.max(Number(searchParams.get('limit') || 200), 1), 1000);

        if (!walletContext.ok) {
            return NextResponse.json(
                { error: walletContext.error },
                { status: walletContext.status }
            );
        }

        const subscriptions = await prisma.managedSubscription.findMany({
            where: {
                walletAddress: walletContext.wallet,
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
                        performanceFee: true,
                        settledAt: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
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
                const netPnl = sub.settlement.finalPayout - sub.settlement.principal;
                const netPnlPct = sub.settlement.principal > 0
                    ? (netPnl / sub.settlement.principal) * 100
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
                    netPnl,
                    netPnlPct,
                    grossPnl: sub.settlement.grossPnl,
                    performanceFee: sub.settlement.performanceFee,
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
