
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { polyClient } from '@/lib/polymarket';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Standardize to lowercase for consistent DB matching
    const normalizedWallet = walletAddress.toLowerCase();

    try {
        // 1. Get Open Positions (for Invested Funds & Unrealized PnL)
        const positions = await prisma.userPosition.findMany({
            where: {
                walletAddress: normalizedWallet,
                balance: { gt: 0 }
            }
        });

        // Calculate Invested Funds (Total Cost Basis of open positions)
        const totalInvested = positions.reduce((sum, pos) => sum + pos.totalCost, 0);

        // 2. Fetch Current Prices for Unrealized PnL
        let unrealizedPnL = 0;

        if (positions.length > 0) {
            try {
                // Get unique token IDs
                const tokenIds = positions.map(p => p.tokenId);

                // Fetch orderbooks to get current mid/best price (CLOB)
                const orderbooks = await polyClient.markets.getTokenOrderbooks(
                    tokenIds.map(id => ({ tokenId: id, side: 'BUY' }))
                );

                // Build CLOB price map
                const clobPriceMap = new Map<string, number>();
                orderbooks.forEach((book, tid) => {
                    if (book.bids.length > 0) {
                        clobPriceMap.set(tid, Number(book.bids[0].price));
                    }
                });

                // Fallback: Fetch Gamma prices using marketSlug from CopyTrade metadata
                const tradeMetadata = await prisma.copyTrade.findMany({
                    where: { tokenId: { in: tokenIds } },
                    select: { tokenId: true, marketSlug: true, outcome: true },
                    orderBy: { detectedAt: 'desc' },
                    distinct: ['tokenId']
                });

                const gammaPriceMap = new Map<string, number>();

                // Query Gamma by slug for each unique market
                const slugsToQuery = [...new Set(tradeMetadata.filter(t => t.marketSlug && !t.marketSlug.includes('unknown')).map(t => t.marketSlug!))];

                for (const slug of slugsToQuery) {
                    try {
                        const res = await fetch(`https://gamma-api.polymarket.com/markets?slug=${slug}&limit=1`);
                        const data = await res.json();
                        const market = data?.[0];
                        if (market?.outcomePrices && market?.outcomes) {
                            const outcomePrices = typeof market.outcomePrices === 'string'
                                ? JSON.parse(market.outcomePrices).map(Number)
                                : market.outcomePrices.map(Number);
                            const outcomes = typeof market.outcomes === 'string'
                                ? JSON.parse(market.outcomes)
                                : market.outcomes;

                            // Map prices to tokens
                            tradeMetadata.filter(t => t.marketSlug === slug).forEach(t => {
                                const idx = outcomes.findIndex((o: string) =>
                                    o.toLowerCase() === t.outcome?.toLowerCase()
                                );
                                if (idx >= 0 && outcomePrices[idx] !== undefined) {
                                    gammaPriceMap.set(t.tokenId, outcomePrices[idx]);
                                }
                            });
                        }
                    } catch (e) {
                        console.warn(`Gamma fetch failed for ${slug}:`, e);
                    }
                }

                // Calculate PnL per position, prioritizing CLOB, then Gamma, then entry price
                positions.forEach(pos => {
                    let currentPrice = pos.avgEntryPrice; // Default to entry price (neutral PnL)

                    // Priority 1: CLOB price (most accurate for liquid markets)
                    if (clobPriceMap.has(pos.tokenId)) {
                        currentPrice = clobPriceMap.get(pos.tokenId)!;
                    }
                    // Priority 2: Gamma price (works for simulation/illiquid markets)
                    else if (gammaPriceMap.has(pos.tokenId)) {
                        currentPrice = gammaPriceMap.get(pos.tokenId)!;
                    }
                    // Priority 3: Entry price (no market data available)

                    // Value diff = (Current price * Balance) - Total Cost
                    const positionValue = currentPrice * pos.balance;
                    const profit = positionValue - pos.totalCost;
                    unrealizedPnL += profit;
                });
            } catch (err) {
                console.warn('Failed to calculate unrealized PnL:', err);
                // Fallback: don't add to PnL if fetch failed
            }
        }

        // 3. Get Realized PnL
        // For now, consistent with simulation limitation, we leave Realized as 0 
        // until we add a ledger or PnL field to CopyTrade.
        // Most dashboard movement comes from Unrealized PnL anyway.
        const realizedPnL = 0;

        return NextResponse.json({
            totalInvested,
            activePositions: positions.length,
            realizedPnL,
            unrealizedPnL,
            totalPnl: realizedPnL + unrealizedPnL // Frontend likely uses this
        });

    } catch (error) {
        console.error('Error fetching metrics:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
