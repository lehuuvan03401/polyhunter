
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { polyClient } from '@/lib/polymarket';
import { GammaMarket } from '@catalyst-team/poly-sdk';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Standardize to lowercase
    const normalizedWallet = walletAddress.toLowerCase();

    try {
        // Fetch local DB positions
        const positions = await prisma.userPosition.findMany({
            where: {
                walletAddress: normalizedWallet,
                balance: { gt: 0 }
            },
            orderBy: { totalCost: 'desc' }
        });

        // Enrich with market data (Title, Outcome name, Current Price)
        // We need to fetch market info for these tokens.
        // Group by conditionId if available? We don't have conditionId in UserPosition, only tokenId.
        // We can try to fetch market by token ID via SDK if supported, or we just display basic info if not.

        // The `UserPosition` schema:
        // model UserPosition {
        //   walletAddress String
        //   tokenId       String
        //   balance       Float
        //   avgEntryPrice Float
        //   totalCost     Float
        //   ...
        // }

        // PROBLEM: We don't have `slug` or `outcome` name in `UserPosition`.
        // We do have `CopyTrade` history which has `tokenId` AND `marketSlug`/`outcome`.
        // We can join or double-lookup.

        const enrichedPositions = await Promise.all(positions.map(async (pos) => {
            // Find the latest CopyTrade for this tokenId to get metadata
            // (Optimize this via join in future, currently 1 query per pos)
            const tradeInfo = await prisma.copyTrade.findFirst({
                where: { tokenId: pos.tokenId },
                select: { marketSlug: true, outcome: true, conditionId: true, detectedAt: true },
                orderBy: { detectedAt: 'desc' }
            });

            if (!tradeInfo) {
                console.warn(`Missing CopyTrade info for position Token ${pos.tokenId} (Wallet: ${pos.walletAddress})`);
            }

            // Fetch live price for PnL calculation
            let curPrice = null;
            let percentPnl = 0;
            try {
                // Use getLastTradePrice from SDK
                curPrice = await polyClient.markets.getLastTradePrice(pos.tokenId);
            } catch (err) {
                // Ignore price fetch errors, keep as null
                console.warn(`Failed to fetch price for ${pos.tokenId}`, err);
            }

            if (curPrice !== null && pos.avgEntryPrice > 0) {
                // If holding Long/Yes, PnL = (Cur - Avg) / Avg
                // If holding Short/No, this logic assumes we hold "Token Shares" at a price.
                // In Polymarket, you hold outcome tokens (YES or NO). The price of that token moves.
                // So (CurrentPrice - AvgEntry) / AvgEntry is correct for both.
                percentPnl = (curPrice - pos.avgEntryPrice) / pos.avgEntryPrice;
            }

            return {
                tokenId: pos.tokenId,
                title: tradeInfo?.marketSlug || 'Unknown Market',
                outcome: tradeInfo?.outcome || '?',
                size: pos.balance,
                avgPrice: pos.avgEntryPrice,
                curPrice: curPrice,
                percentPnl: percentPnl,
                totalCost: pos.totalCost,
                simulated: true, // Flag for UI
                timestamp: tradeInfo?.detectedAt ? new Date(tradeInfo.detectedAt).getTime() : Date.now()
            };
        }));

        return NextResponse.json(enrichedPositions);

    } catch (error) {
        console.error('Error fetching positions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
