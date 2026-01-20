
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { polyClient } from '@/lib/polymarket';
import { GammaMarket } from '@catalyst-team/poly-sdk';
import { parseMarketSlug, parseOutcome } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// parsers moved to @/lib/utils

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

        const tokenIds = positions.map(p => p.tokenId).filter((id): id is string => !!id);
        const uniqueTokenIds = Array.from(new Set(tokenIds));

        // 1. Batch Fetch Metadata (DB)
        const tradeMetadata = await prisma.copyTrade.findMany({
            where: { tokenId: { in: uniqueTokenIds } },
            select: { tokenId: true, marketSlug: true, outcome: true, detectedAt: true },
            orderBy: { detectedAt: 'desc' },
            distinct: ['tokenId']
        });

        // Map metadata for O(1) lookup
        const metadataMap = new Map<string, typeof tradeMetadata[0]>();
        tradeMetadata.forEach(trade => {
            if (trade.tokenId && !metadataMap.has(trade.tokenId)) {
                metadataMap.set(trade.tokenId, trade);
            }
        });

        // 2. Batch Fetch Prices (SDK)
        let priceMap = new Map<string, number>();
        try {
            const orderbooks = await polyClient.markets.getTokenOrderbooks(
                uniqueTokenIds.map(id => ({ tokenId: id, side: 'BUY' as const }))
            );

            orderbooks.forEach((book, tokenId) => {
                if (book.bids.length > 0) {
                    priceMap.set(tokenId, book.bids[0].price);
                } else {
                    priceMap.set(tokenId, 0);
                }
            });
        } catch (err) {
            console.error("Failed to batch fetch prices", err);
        }

        console.log(`Debug: Fetched ${priceMap.size} prices for ${uniqueTokenIds.length} tokens.`);

        const enrichedPositions = positions.map((pos) => {
            const tradeInfo = metadataMap.get(pos.tokenId);
            const rawPrice = priceMap.get(pos.tokenId);

            // Use avgEntryPrice as fallback if current price unavailable
            const curPrice = rawPrice !== undefined && rawPrice > 0 ? rawPrice : pos.avgEntryPrice;

            // Safe PnL calculation with edge case handling
            let percentPnl = 0;
            if (pos.avgEntryPrice > 0 && curPrice !== null) {
                percentPnl = (curPrice - pos.avgEntryPrice) / pos.avgEntryPrice;
                // Clamp extreme values (shouldn't exceed +/- 100% in normal cases)
                if (percentPnl < -1) percentPnl = -1;
                if (percentPnl > 10) percentPnl = 10; // Cap at 1000%
            }

            // Calculate estimated current value
            const estValue = pos.balance * (curPrice || 0);

            // Determine market status based on current price
            // If price is 0 (dropped to nothing) -> the outcome LOST
            // If price is 1 (or very close) -> the outcome WON
            // If price is between 0 and 1 -> still OPEN
            let status: 'OPEN' | 'SETTLED_WIN' | 'SETTLED_LOSS' = 'OPEN';
            if (rawPrice !== undefined) {
                if (rawPrice >= 0.95) {
                    // Price went to ~1, this outcome WON
                    status = 'SETTLED_WIN';
                } else if (rawPrice <= 0.05) {
                    // Price dropped to ~0, this outcome LOST
                    status = 'SETTLED_LOSS';
                }
            }

            return {
                tokenId: pos.tokenId,
                slug: tradeInfo?.marketSlug || null, // Raw slug for building Polymarket URL
                title: parseMarketSlug(tradeInfo?.marketSlug, pos.tokenId),
                outcome: parseOutcome(tradeInfo?.outcome),
                size: pos.balance,
                avgPrice: pos.avgEntryPrice,
                curPrice: curPrice,
                percentPnl: percentPnl,
                estValue: estValue,
                totalCost: pos.totalCost,
                simulated: true,
                status: status,
                timestamp: tradeInfo?.detectedAt ? new Date(tradeInfo.detectedAt).getTime() : Date.now()
            };
        });

        return NextResponse.json(enrichedPositions);

    } catch (error) {
        console.error('Error fetching positions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

