import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseMarketSlug, parseOutcome } from '@/lib/utils';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');
    const type = searchParams.get('type') as 'REDEEMED' | 'SETTLED_LOSS' | 'ALL' | 'COUNTS';

    if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    const normalizedWallet = walletAddress.toLowerCase();

    // 1. Find Config ID for user
    // 1. Find ALL Config IDs for user (to support multiple simulations/traders)
    const configs = await prisma.copyTradingConfig.findMany({
        where: { walletAddress: normalizedWallet },
        select: { id: true }
    });

    if (configs.length === 0) {
        return NextResponse.json([]);
    }

    const configIds = configs.map(c => c.id);

    try {
        // Query filters
        let whereClause: Prisma.CopyTradeWhereInput = {
            configId: { in: configIds },
            status: 'EXECUTED'
        };

        if (type === 'COUNTS') {
            const redeemedCount = await prisma.copyTrade.count({
                where: {
                    configId: { in: configIds },
                    OR: [
                        { originalSide: 'REDEEM' }, // Actual Redeems
                        { AND: [{ originalTrader: { in: ['POLYMARKET_SETTLEMENT', 'PROTOCOL'] } }, { originalPrice: 1 }] } // Simulated Wins
                    ]
                }
            });
            // Loss = Sell by Settlement with 0 price OR Sell with 'loss' hash
            const lostCount = await prisma.copyTrade.count({
                where: {
                    configId: { in: configIds },
                    OR: [
                        { AND: [{ originalTrader: { in: ['POLYMARKET_SETTLEMENT', 'PROTOCOL'] } }, { originalPrice: 0 }] }, // Settlement Loss
                        { AND: [{ originalSide: 'SELL' }, { txHash: { contains: 'loss' } }] } // Explicit Loss
                    ]
                }
            });
            return NextResponse.json({
                REDEEMED: redeemedCount,
                SETTLED_LOSS: lostCount
            });
        }

        if (type === 'REDEEMED') {
            whereClause = {
                ...whereClause,
                OR: [
                    { originalSide: 'REDEEM' },
                    { AND: [{ originalTrader: { in: ['POLYMARKET_SETTLEMENT', 'PROTOCOL'] } }, { originalPrice: 1 }] }
                ]
            };
        } else if (type === 'SETTLED_LOSS') {
            whereClause = {
                ...whereClause,
                OR: [
                    { AND: [{ originalTrader: { in: ['POLYMARKET_SETTLEMENT', 'PROTOCOL'] } }, { originalPrice: 0 }] },
                    { AND: [{ originalSide: 'SELL' }, { txHash: { contains: 'loss' } }] }
                ]
            };
        } else {
            // ALL history (both types)
            whereClause = {
                ...whereClause,
                OR: [
                    { originalSide: 'REDEEM' },
                    { AND: [{ originalTrader: { in: ['POLYMARKET_SETTLEMENT', 'PROTOCOL'] } }, { originalPrice: 0 }] },
                    { AND: [{ originalSide: 'SELL' }, { txHash: { contains: 'loss' } }] }
                ]
            };
        }

        const trades = await prisma.copyTrade.findMany({
            where: whereClause,
            orderBy: { executedAt: 'desc' },
            take: 50 // Limit to recent 50
        });

        // Map to Position interface structure for UI compatibility
        const positions = trades.map(t => ({
            id: t.id, // Unique Trade ID
            tokenId: t.tokenId || t.id, // Fallback ID
            slug: t.marketSlug,
            title: parseMarketSlug(t.marketSlug, t.tokenId || ''),
            outcome: parseOutcome(t.outcome),
            size: t.copySize, // This is now SHARES
            avgPrice: t.originalPrice === 1.0 ? 0.0 : t.originalPrice, // For redeemed, price was 1.0. For loss, 0.0. 
            // Wait, avgPrice should be Entry Price? We don't have Entry Price in CopyTrade record easily unless we query the BUY trade.
            // But we have realizedPnL.
            // If PnL = Proceeds - Cost.
            // Cost = Proceeds - PnL.
            // Proceeds = Size * Price (1.0 or 0.0).
            // Cost = (Size * 1.0) - PnL.
            // AvgEntry = Cost / Size.
            curPrice: t.copyPrice, // Settlement Price (1.0 or 0.0)
            percentPnl: t.realizedPnL && t.copySize ? (t.realizedPnL / (t.copySize * (t.copyPrice === 1 ? 0.05 : 0.95))) : 0, // Rough estimate
            // Better PnL %: PnL / Cost.
            pnlAbs: t.realizedPnL,
            estValue: t.copySize * (t.copyPrice || 0),
            totalCost: 0, // Calculated below
            simulated: true,
            status: (t.originalSide === 'REDEEM' || ((t.originalTrader === 'POLYMARKET_SETTLEMENT' || t.originalTrader === 'PROTOCOL') && t.originalPrice === 1.0)) ? 'SETTLED_WIN' : 'SETTLED_LOSS',
            timestamp: t.executedAt ? new Date(t.executedAt).getTime() : Date.now()
        }));

        // Refine PnL % calculation
        positions.forEach(p => {
            const proceeds = p.estValue;
            const cost = proceeds - (p.pnlAbs || 0);
            p.totalCost = cost;
            if (cost > 0) {
                p.avgPrice = cost / p.size;
                p.percentPnl = (p.pnlAbs || 0) / cost;
            } else {
                p.avgPrice = 0; // fallback
                p.percentPnl = 0;
            }
        });

        return NextResponse.json(positions);

    } catch (error) {
        console.error('Error fetching history:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
