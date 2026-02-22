
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { polyClient } from '@/lib/polymarket';
import { createTTLCache } from '@/lib/server-cache';
import { resolveCopyTradingWalletContext } from '@/lib/copy-trading/request-wallet';

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

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const walletCheck = resolveCopyTradingWalletContext(request, {
        queryWallet: searchParams.get('wallet'),
    });
    if (!walletCheck.ok) {
        return NextResponse.json({ error: walletCheck.error }, { status: walletCheck.status });
    }
    // Standardize to lowercase for consistent DB matching
    const normalizedWallet = walletCheck.wallet;

    try {
        const cacheKey = `metrics:${normalizedWallet}`;
        const responsePayload = await responseCache.getOrSet(cacheKey, RESPONSE_TTL_MS, async () => {

            // 1) 读取当前持仓，用于计算未实现盈亏和活跃仓位。
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

            // totalInvested 在拿到价格/结算状态后再计算：
            // 只统计 OPEN 仓位，避免把已结算仓位重复计入“当前投入”。
            let totalInvested = 0;
            let activePositions = 0;

            // 2) 拉当前价格（CLOB 优先，Gamma 回退），计算未实现盈亏。
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

                    // Gamma 兼顾两件事：
                    // - 为缺盘口 token 提供回退价格
                    // - 判断市场是否已结算（用于 activePositions 与 totalInvested 口径）
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

                    // 查询键与 positions 接口保持一致：slug 优先，conditionId 回退。
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

                    // 单仓价格优先级：CLOB -> Gamma -> Entry。
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

                    // totalInvested 只累计 OPEN 仓位成本：
                    // settled 判定 = 价格极值(>=0.95/<=0.05) 或 Gamma 标记已结算。
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

            // 3) 计算已实现盈亏：
            // - 优先使用 copyTrade.realizedPnL
            // - 对缺失 realizedPnL 的 SELL 再做回补估算
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

                    // settlementPnL 单独统计，用于对齐 WON/LOST 视图。
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

                    // 回补口径：
                    // 用 BUY 成本基准 + SELL 成交价估算 profit，减少历史数据缺字段的影响。
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

                    // 构建 token 维度成本基准（总成本/总份额）。
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

            // 统一收敛口径：防止浮点与路径差异导致字段不一致。
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
