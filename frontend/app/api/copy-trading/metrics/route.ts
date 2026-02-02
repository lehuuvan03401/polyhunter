
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { polyClient } from '@/lib/polymarket';
import { createTTLCache } from '@/lib/server-cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RESPONSE_TTL_MS = 20000;
const PRICE_TTL_MS = 10000;
const GAMMA_TTL_MS = 30000;
const GAMMA_TIMEOUT_MS = 3000;
const GAMMA_FAILURE_TTL_MS = 10000;

const responseCache = createTTLCache<any>();
const orderbookPriceCache = createTTLCache<number>();
const gammaPriceCache = createTTLCache<number>();
const gammaMarketCache = createTTLCache<any>();

async function fetchWithTimeout(url: string, timeoutMs: number) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Standardize to lowercase for consistent DB matching
    const normalizedWallet = walletAddress.toLowerCase();

    try {
        const cacheKey = `metrics:${normalizedWallet}`;
        const responsePayload = await responseCache.getOrSet(cacheKey, RESPONSE_TTL_MS, async () => {

            // 1. Get All Positions (for Invested Funds & Unrealized PnL)
            const allPositions = await prisma.userPosition.findMany({
                where: {
                    walletAddress: normalizedWallet,
                    balance: { gt: 0 }
                }
            });

            // Filter out synthetic adjustment positions (from ROI/Volume adjustment scripts)
            const positions = allPositions.filter(p =>
                !p.tokenId.startsWith('synth-volume-') &&
                !p.tokenId.startsWith('synthetic-')
            );

            // Note: totalInvested will be calculated AFTER fetching prices to filter out settled positions
            let totalInvested = 0;
            let activePositions = 0;

            // 2. Fetch Current Prices for Unrealized PnL and Status Detection
            let unrealizedPnL = 0;

            if (positions.length > 0) {
                try {
                    // Get unique token IDs
                    const tokenIds = Array.from(new Set(positions.map(p => p.tokenId)));

                    // Fetch orderbooks to get current mid/best price (CLOB)
                    const clobPriceMap = new Map<string, number>();
                    tokenIds.forEach((tid) => {
                        const cached = orderbookPriceCache.get(tid);
                        if (cached !== undefined) {
                            clobPriceMap.set(tid, cached);
                        }
                    });

                    const tokensToFetch = tokenIds.filter((tid) => !clobPriceMap.has(tid));
                    if (tokensToFetch.length > 0) {
                        const orderbooks = await polyClient.markets.getTokenOrderbooks(
                            tokensToFetch.map(id => ({ tokenId: id, side: 'BUY' }))
                        );

                        orderbooks.forEach((book, tid) => {
                            if (book.bids.length > 0) {
                                const price = Number(book.bids[0].price);
                                clobPriceMap.set(tid, price);
                                orderbookPriceCache.set(tid, price, PRICE_TTL_MS);
                            }
                        });
                    }

                    const tokensNeedingGamma = tokenIds.filter((tid) => !clobPriceMap.has(tid) && gammaPriceCache.get(tid) === undefined);

                    // Fallback: Fetch Gamma prices AND market resolution using marketSlug from CopyTrade metadata
                    // For resolution check, we need metadata for ALL positions, not just ones needing Gamma prices
                    const tradeMetadata = await prisma.copyTrade.findMany({
                        where: { tokenId: { in: tokenIds } },
                        select: { tokenId: true, marketSlug: true, outcome: true, conditionId: true },
                        orderBy: { detectedAt: 'desc' },
                        distinct: ['tokenId']
                    });

                    // Build metadata map for quick lookup
                    const metadataMap = new Map<string, typeof tradeMetadata[0]>();
                    tradeMetadata.forEach(t => {
                        if (t.tokenId) metadataMap.set(t.tokenId, t);
                    });

                    const gammaPriceMap = new Map<string, number>();
                    const marketResolutionMap = new Map<string, boolean>(); // tokenId -> isResolved
                    tokenIds.forEach((tid) => {
                        const cached = gammaPriceCache.get(tid);
                        if (cached !== undefined) {
                            gammaPriceMap.set(tid, cached);
                        }
                    });

                    // Collect unique slugs AND conditionIds to query (matching positions API logic)
                    const jobs = new Map<string, { type: 'slug' | 'condition', value: string }>();
                    tokenIds.forEach(tid => {
                        const info = metadataMap.get(tid);
                        if (!info) return;
                        // Prefer slug, fallback to conditionId
                        if (info.marketSlug && !info.marketSlug.includes('unknown')) {
                            jobs.set(info.marketSlug, { type: 'slug', value: info.marketSlug });
                        } else if (info.conditionId && info.conditionId !== '0x0' && info.conditionId.length > 10) {
                            jobs.set(info.conditionId, { type: 'condition', value: info.conditionId });
                        }
                    });
                    const tasks = Array.from(jobs.values());

                    const BATCH_SIZE = 5;
                    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
                        const batch = tasks.slice(i, i + BATCH_SIZE);
                        await Promise.all(batch.map(async (task) => {
                            try {
                                const cacheKey = `${task.type}:${task.value}`;
                                let market = gammaMarketCache.get(cacheKey);
                                if (!market) {
                                    let url = `https://gamma-api.polymarket.com/markets?limit=1`;
                                    if (task.type === 'condition') {
                                        url += `&condition_id=${task.value}`;
                                    } else {
                                        url += `&slug=${task.value}`;
                                    }
                                    const res = await fetchWithTimeout(url, GAMMA_TIMEOUT_MS);
                                    if (!res.ok) {
                                        gammaMarketCache.set(cacheKey, null, GAMMA_FAILURE_TTL_MS);
                                        return;
                                    }
                                    const data = await res.json();
                                    market = data?.[0];
                                    if (market) {
                                        gammaMarketCache.set(cacheKey, market, GAMMA_TTL_MS);
                                    } else {
                                        gammaMarketCache.set(cacheKey, null, GAMMA_FAILURE_TTL_MS);
                                    }
                                }

                                if (market?.outcomePrices && market?.outcomes) {
                                    const outcomePrices = typeof market.outcomePrices === 'string'
                                        ? JSON.parse(market.outcomePrices).map(Number)
                                        : market.outcomePrices.map(Number);
                                    const outcomes = typeof market.outcomes === 'string'
                                        ? JSON.parse(market.outcomes)
                                        : market.outcomes;

                                    // Map prices to tokens (for tokens matching this market)
                                    tradeMetadata.forEach(t => {
                                        if (!t.tokenId) return;
                                        const matchesSlug = task.type === 'slug' && t.marketSlug === task.value;
                                        const matchesCondition = task.type === 'condition' && t.conditionId === task.value;
                                        if (!matchesSlug && !matchesCondition) return;

                                        const idx = outcomes.findIndex((o: string) =>
                                            o.toLowerCase() === t.outcome?.toLowerCase()
                                        );
                                        if (idx >= 0 && outcomePrices[idx] !== undefined) {
                                            const price = outcomePrices[idx];
                                            gammaPriceMap.set(t.tokenId, price);
                                            gammaPriceCache.set(t.tokenId, price, GAMMA_TTL_MS);
                                        }
                                    });
                                }

                                // Check if market is resolved/closed (same logic as positions API)
                                // Resolved if: market.closed = true OR any outcome price is at extremes
                                if (market?.outcomePrices) {
                                    const outcomePrices = typeof market.outcomePrices === 'string'
                                        ? JSON.parse(market.outcomePrices).map(Number)
                                        : market.outcomePrices.map(Number);

                                    const isResolvedState = market?.closed === true ||
                                        outcomePrices.some((p: number) => p >= 0.95 || p <= 0.05);

                                    if (isResolvedState) {
                                        // Mark all tokens from this market as resolved
                                        tradeMetadata.forEach(t => {
                                            if (!t.tokenId) return;
                                            const matchesSlug = task.type === 'slug' && t.marketSlug === task.value;
                                            const matchesCondition = task.type === 'condition' && t.conditionId === task.value;
                                            if (matchesSlug || matchesCondition) {
                                                marketResolutionMap.set(t.tokenId, true);
                                            }
                                        });
                                    }
                                }
                            } catch (e) {
                                console.warn(`Gamma fetch failed for ${task.type}:${task.value}:`, e);
                                const cacheKey = `${task.type}:${task.value}`;
                                gammaMarketCache.set(cacheKey, null, GAMMA_FAILURE_TTL_MS);
                            }
                        }));
                    }

                    // Build a price map for all positions for status detection
                    const positionPriceMap = new Map<string, number>();

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

                        positionPriceMap.set(pos.tokenId, currentPrice);

                        // Value diff = (Current price * Balance) - Total Cost
                        const positionValue = currentPrice * pos.balance;
                        const profit = positionValue - pos.totalCost;
                        unrealizedPnL += profit;
                    });

                    // Calculate totalInvested for OPEN positions only
                    // Settled: price >= 0.95 (WIN) or <= 0.05 (LOSS) OR market resolved via Gamma
                    let openCount = 0;
                    let settledByPrice = 0;
                    let settledByResolution = 0;
                    positions.forEach(pos => {
                        const price = positionPriceMap.get(pos.tokenId) ?? pos.avgEntryPrice;
                        const priceSettled = price >= 0.95 || price <= 0.05;
                        const marketResolved = marketResolutionMap.get(pos.tokenId) === true;
                        const isSettled = priceSettled || marketResolved;
                        if (!isSettled) {
                            totalInvested += pos.totalCost;
                            activePositions += 1;
                            openCount++;
                        } else {
                            if (priceSettled) settledByPrice++;
                            if (marketResolved) settledByResolution++;
                        }
                    });
                    console.log(`[Metrics] Total positions: ${positions.length}, Open: ${openCount}, Settled by price: ${settledByPrice}, Settled by resolution: ${settledByResolution}`);
                } catch (err) {
                    console.warn('Failed to calculate unrealized PnL:', err);
                    // Fallback: count all positions as active if price fetch failed
                    totalInvested = positions.reduce((sum, pos) => sum + pos.totalCost, 0);
                    activePositions = positions.length;
                }
            } else {
                // No positions at all
                totalInvested = 0;
                activePositions = 0;
            }

            // 3. Calculate Realized/Trading PnL from completed trades
            // This represents the execution slippage (buy price vs sell price for closed positions)
            let realizedPnL = 0;
            let tradingPnL = 0; // Separate metric for trading execution cost
            let realizedWins = 0;
            let realizedLosses = 0;
            let settlementWins = 0;
            let settlementLosses = 0;
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

                    // Settlement-only realized PnL (aligns with WON/LOST views)
                    const settlementTrades = await prisma.copyTrade.findMany({
                        where: {
                            configId: { in: configIds },
                            status: 'EXECUTED',
                            OR: [
                                { originalSide: 'REDEEM' },
                                { originalTrader: { in: ['POLYMARKET_SETTLEMENT', 'PROTOCOL'] } }
                            ]
                        },
                        select: { realizedPnL: true }
                    });

                    settlementTrades.forEach(t => {
                        const pnl = t.realizedPnL || 0;
                        if (pnl > 0) settlementWins += pnl;
                        else if (pnl < 0) settlementLosses += pnl;
                    });

                    // Calculate Cumulative Investment (Total Buy Volume)
                    const allBuys = await prisma.copyTrade.findMany({
                        where: {
                            configId: { in: configIds },
                            originalSide: 'BUY',
                            status: 'EXECUTED'
                        },
                        select: { copySize: true }
                    });

                    cumulativeInvestment = allBuys.reduce((sum, t) => sum + (t.copySize || 0), 0);

                    // Fallback: For trades WITHOUT stored realizedPnL, calculate manually
                    const sellTradesWithoutPnL = await prisma.copyTrade.findMany({
                        where: {
                            configId: { in: configIds },
                            originalSide: 'SELL',
                            status: 'EXECUTED',
                            realizedPnL: null
                        },
                        select: { tokenId: true, copySize: true, copyPrice: true, originalPrice: true }
                    });

                    if (sellTradesWithoutPnL.length > 0) {
                        // Get BUY trades for cost basis
                        const buyTrades = await prisma.copyTrade.findMany({
                            where: {
                                configId: { in: configIds },
                                originalSide: 'BUY',
                                status: 'EXECUTED'
                            },
                            select: { tokenId: true, copySize: true, copyPrice: true, originalPrice: true }
                        });

                        // Build cost basis map
                        const costBasisMap = new Map<string, { totalCost: number, totalShares: number }>();
                        buyTrades.forEach(t => {
                            if (!t.tokenId) return;
                            const existing = costBasisMap.get(t.tokenId) || { totalCost: 0, totalShares: 0 };
                            // copySize is USDC amount. Shares = USDC / Price
                            const unitPrice = t.copyPrice ?? t.originalPrice ?? 0;
                            if (unitPrice <= 0) return;
                            existing.totalCost += t.copySize;
                            existing.totalShares += t.copySize / unitPrice;
                            costBasisMap.set(t.tokenId, existing);
                        });

                        // Calculate PnL for sells without stored value
                        sellTradesWithoutPnL.forEach(t => {
                            if (!t.tokenId) return;
                            const costInfo = costBasisMap.get(t.tokenId);
                            if (costInfo && costInfo.totalShares > 0) {
                                const avgBuyPrice = costInfo.totalCost / costInfo.totalShares;
                                const sellPrice = t.copyPrice ?? t.originalPrice ?? 0;
                                if (sellPrice <= 0) return;
                                const shares = t.copySize / sellPrice; // copySize is USDC
                                const profit = (sellPrice - avgBuyPrice) * shares;
                                tradingPnL += profit;

                                // Update Breakdown (W/L)
                                if (profit > 0) realizedWins += profit;
                                else if (profit < 0) realizedLosses += profit;
                            }
                        });
                    }

                    realizedPnL = tradingPnL;
                }
            } catch (err) {
                console.warn('Failed to calculate realized PnL:', err);
            }

            // Enforce Consistency (Fix Rounding Errors)
            // realizedWins + realizedLosses MUST equal realizedPnL/tradingPnL
            realizedPnL = realizedWins + realizedLosses;
            tradingPnL = realizedWins + realizedLosses;
            const settlementPnL = settlementWins + settlementLosses;

            return {
                totalInvested,
                activePositions,
                realizedPnL,      // Net realized
                realizedWins,     // Total Wins PnL
                realizedLosses,   // Total Losses PnL
                settlementPnL,
                settlementWins,
                settlementLosses,
                unrealizedPnL,    // From current market prices (settlement value)
                tradingPnL,       // Same as realized, explicitly named
                totalPnL: unrealizedPnL, // Use unrealized as the "main" PnL
                cumulativeInvestment // Total Volume since start
            };
        });
        return NextResponse.json(responsePayload);

    } catch (error) {
        console.error('Error fetching metrics:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
