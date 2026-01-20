
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

        const tokenIds = positions.map(p => p.tokenId).filter((id): id is string => !!id);
        const uniqueTokenIds = Array.from(new Set(tokenIds));

        // 1. Batch Fetch Metadata (DB)
        const tradeMetadata = await prisma.copyTrade.findMany({
            where: { tokenId: { in: uniqueTokenIds } },
            select: { tokenId: true, marketSlug: true, outcome: true, detectedAt: true },
            orderBy: { detectedAt: 'desc' },
            distinct: ['tokenId'] // Get latest per token if logic allows, or we filter manually. DISTINCT might not be supported on all DBs like this, safe to fetch all and map.
            // SQLite/Postgres support distinct on specific columns? Prisma `distinct` is supported.
            // But to be safe and simple: fetch all matches and we map by tokenId (taking the first/latest).
        });

        // Map metadata for O(1) lookup
        const metadataMap = new Map<string, typeof tradeMetadata[0]>();
        tradeMetadata.forEach(trade => {
            // Since we ordered by detectedAt desc, the first one we see is likely the latest (or we just overwrite? No, findMany returns array)
            // Actually findMany returns all. We want the latest.
            // If we use the map set, we should do it such that the latest one sticks.
            // If the query ordered by detectedAt DESC, the first one in the list is the latest.
            // So we set if not exists.
            if (!metadataMap.has(trade.tokenId)) {
                metadataMap.set(trade.tokenId, trade);
            }
        });

        // 2. Batch Fetch Prices (SDK)
        let priceMap = new Map<string, number>();
        try {
            // We request 'BUY' side (Bids) to get the price we can SELL at (Exit Price)
            const orderbooks = await polyClient.markets.getTokenOrderbooks(
                uniqueTokenIds.map(id => ({ tokenId: id, side: 'BUY' as const }))
            );

            orderbooks.forEach((book, tokenId) => {
                // Use Best Bid as current price
                if (book.bids.length > 0) {
                    priceMap.set(tokenId, book.bids[0].price);
                } else {
                    priceMap.set(tokenId, 0);
                }
            });
        } catch (err) {
            console.error("Failed to batch fetch prices", err);
            // Fallback to empty map, prices will be null/0
        }

        const enrichedPositions = positions.map((pos) => {
            const tradeInfo = metadataMap.get(pos.tokenId);
            const curPrice = priceMap.get(pos.tokenId) ?? null; // null if not found/fetched

            let percentPnl = 0;
            if (curPrice !== null && pos.avgEntryPrice > 0) {
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
                simulated: true,
                timestamp: tradeInfo?.detectedAt ? new Date(tradeInfo.detectedAt).getTime() : Date.now()
            };
        });

        return NextResponse.json(enrichedPositions);

    } catch (error) {
        console.error('Error fetching positions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
