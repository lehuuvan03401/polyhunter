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
    const config = await prisma.copyTradingConfig.findFirst({
        where: { walletAddress: normalizedWallet }
    });

    if (!config) {
        return NextResponse.json([]);
    }

    try {
        // Query filters
        let whereClause: Prisma.CopyTradeWhereInput = {
            configId: config.id,
            status: 'EXECUTED'
        };

        if (type === 'COUNTS') {
            const redeemedCount = await prisma.copyTrade.count({
                where: {
                    configId: config.id,
                    originalSide: 'REDEEM'
                }
            });
            const lostCount = await prisma.copyTrade.count({
                where: {
                    configId: config.id,
                    originalSide: 'SELL',
                    txHash: { contains: 'loss' }
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
                originalSide: 'REDEEM',
                // Or txHash contains sim-redeem
            };
        } else if (type === 'SETTLED_LOSS') {
            whereClause = {
                ...whereClause,
                originalSide: 'SELL',
                txHash: { contains: 'loss' } // sim-settle-loss
            };
        } else {
            // ALL history (both types)
            whereClause = {
                ...whereClause,
                OR: [
                    { originalSide: 'REDEEM' },
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
            status: t.originalSide === 'REDEEM' ? 'SETTLED_WIN' : 'SETTLED_LOSS',
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
