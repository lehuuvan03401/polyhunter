
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
                                if (!t.tokenId) return; // Skip if no tokenId
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

        // 3. Calculate Realized/Trading PnL from completed trades
        // This represents the execution slippage (buy price vs sell price for closed positions)
        let realizedPnL = 0;
        let tradingPnL = 0; // Separate metric for trading execution cost
        let realizedWins = 0;
        let realizedLosses = 0;
        let cumulativeInvestment = 0;

        try {
            // First, get all config IDs for this wallet
            const configs = await prisma.copyTradingConfig.findMany({
                where: { walletAddress: normalizedWallet },
                select: { id: true }
            });
            const configIds = configs.map(c => c.id);

            if (configIds.length > 0) {
                // Sum realizedPnL from ALL trades (Wins and Losses)
                const winsSum = await prisma.copyTrade.aggregate({
                    where: {
                        configId: { in: configIds },
                        status: 'EXECUTED',
                        realizedPnL: { gt: 0 }
                    },
                    _sum: { realizedPnL: true }
                });

                const lossesSum = await prisma.copyTrade.aggregate({
                    where: {
                        configId: { in: configIds },
                        status: 'EXECUTED',
                        realizedPnL: { lt: 0 }
                    },
                    _sum: { realizedPnL: true }
                });

                tradingPnL = (winsSum._sum.realizedPnL || 0) + (lossesSum._sum.realizedPnL || 0);
                realizedWins = winsSum._sum.realizedPnL || 0;
                realizedLosses = lossesSum._sum.realizedPnL || 0;

                // Calculate Cumulative Investment (Total Buy Volume)
                const allBuys = await prisma.copyTrade.findMany({
                    where: {
                        configId: { in: configIds },
                        originalSide: 'BUY',
                        status: 'EXECUTED'
                    },
                    select: { copySize: true, copyPrice: true }
                });

                cumulativeInvestment = allBuys.reduce((sum, t) => sum + (t.copySize * (t.copyPrice || 0)), 0);

                // Fallback: For trades WITHOUT stored realizedPnL, calculate manually
                const sellTradesWithoutPnL = await prisma.copyTrade.findMany({
                    where: {
                        configId: { in: configIds },
                        originalSide: 'SELL',
                        status: 'EXECUTED',
                        realizedPnL: null
                    },
                    select: { tokenId: true, copySize: true, copyPrice: true }
                });

                if (sellTradesWithoutPnL.length > 0) {
                    // Get BUY trades for cost basis
                    const buyTrades = await prisma.copyTrade.findMany({
                        where: {
                            configId: { in: configIds },
                            originalSide: 'BUY',
                            status: 'EXECUTED'
                        },
                        select: { tokenId: true, copySize: true, copyPrice: true }
                    });

                    // Build cost basis map
                    const costBasisMap = new Map<string, { totalCost: number, totalShares: number }>();
                    buyTrades.forEach(t => {
                        if (!t.tokenId) return;
                        const existing = costBasisMap.get(t.tokenId) || { totalCost: 0, totalShares: 0 };
                        // copySize is SHARES. Cost = Shares * Price
                        existing.totalCost += t.copySize * (t.copyPrice || 0);
                        existing.totalShares += t.copySize;
                        costBasisMap.set(t.tokenId, existing);
                    });

                    // Calculate PnL for sells without stored value
                    sellTradesWithoutPnL.forEach(t => {
                        if (!t.tokenId) return;
                        const costInfo = costBasisMap.get(t.tokenId);
                        if (costInfo && costInfo.totalShares > 0) {
                            const avgBuyPrice = costInfo.totalCost / costInfo.totalShares;
                            const sellPrice = t.copyPrice || 0;
                            const shares = t.copySize; // copySize is SHARES
                            const profit = (sellPrice - avgBuyPrice) * shares;
                            tradingPnL += profit;
                        }
                    });
                }

                realizedPnL = tradingPnL;
            }
        } catch (err) {
            console.warn('Failed to calculate realized PnL:', err);
        }

        return NextResponse.json({
            totalInvested,
            activePositions: positions.length,
            realizedPnL,      // Net realized
            realizedWins,     // Total Wins PnL
            realizedLosses,   // Total Losses PnL
            unrealizedPnL,    // From current market prices (settlement value)
            tradingPnL,       // Same as realized, explicitly named
            totalPnL: unrealizedPnL, // Use unrealized as the "main" PnL
            cumulativeInvestment // Total Volume since start
        });

    } catch (error) {
        console.error('Error fetching metrics:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
