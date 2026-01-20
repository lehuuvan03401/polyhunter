
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { polyClient } from '@/lib/polymarket';
import { GammaMarket } from '@catalyst-team/poly-sdk';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Parse market slug into human-readable title
 * e.g., "btc-updown-15m-1768895100" -> "BTC 15min Up/Down (3:45 PM)"
 */
function parseMarketSlug(slug: string | null | undefined, tokenId?: string): string {
    if (!slug) {
        // Fallback: show truncated tokenId if available
        if (tokenId) {
            return `Market ${tokenId.slice(0, 8)}...`;
        }
        return 'Unknown Market';
    }

    // Known patterns for time-based markets
    const timePatterns: Record<string, string> = {
        '15m': '15min',
        '1h': '1 Hour',
        '4h': '4 Hour',
        '1d': '1 Day',
    };

    // Try to parse common formats
    // Pattern: {asset}-updown-{timeframe}-{timestamp}
    const upDownMatch = slug.match(/^([a-z]+)-updown-(\d+[mhd])-(\d+)$/i);
    if (upDownMatch) {
        const [, asset, timeframe, timestamp] = upDownMatch;
        const tf = timePatterns[timeframe] || timeframe;
        const date = new Date(parseInt(timestamp) * 1000);
        const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return `${asset.toUpperCase()} ${tf} Up/Down (${time})`;
    }

    // Pattern: {asset}-price-{target}-{timestamp}
    const priceMatch = slug.match(/^([a-z]+)-price-(\d+)-(\d+)$/i);
    if (priceMatch) {
        const [, asset, target] = priceMatch;
        return `${asset.toUpperCase()} > $${parseInt(target).toLocaleString()}`;
    }

    // Fallback: capitalize and clean up slug
    const cleaned = slug
        .replace(/-\d{10,}$/, '') // Remove trailing timestamp (10+ digits)
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

    return cleaned || slug;
}

/**
 * Normalize outcome display
 */
function parseOutcome(outcome: string | null | undefined): string {
    if (!outcome) return 'N/A';
    const normalized = outcome.toLowerCase();
    if (normalized === 'yes' || normalized === 'up') return 'Up';
    if (normalized === 'no' || normalized === 'down') return 'Down';
    return outcome; // Return as-is if not recognized
}

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

