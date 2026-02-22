
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { polyClient } from '@/lib/polymarket';
import { parseMarketSlug, parseOutcome } from '@/lib/utils';
import { createTTLCache } from '@/lib/server-cache';
import { resolveCopyTradingWalletContext } from '@/lib/copy-trading/request-wallet';

const GAMMA_API_BASE = process.env.GAMMA_API_URL || 'https://gamma-api.polymarket.com';
// Force recompile

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RESPONSE_TTL_MS = 20000;
const PRICE_TTL_MS = 10000;
const GAMMA_TTL_MS = 30000;
const RESOLUTION_TTL_MS = 30000;
const GAMMA_TIMEOUT_MS = 3000;
const GAMMA_FAILURE_TTL_MS = 10000;

const responseCache = createTTLCache<any>();
const orderbookPriceCache = createTTLCache<number>();
const gammaPriceCache = createTTLCache<number>();
const resolutionCache = createTTLCache<{ resolved: boolean; winner: boolean }>();
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

const applyGammaMarket = (
    market: any,
    uniqueTokenIds: string[],
    metadataMap: Map<string, any>,
    gammaPriceMap: Map<string, number>,
    marketResolutionMap: Map<string, { resolved: boolean; winner: boolean }>
) => {
    // Parse Outcome Prices
    let outcomePrices: number[] = [];
    if (market?.outcomePrices) {
        try {
            outcomePrices = typeof market.outcomePrices === 'string'
                ? JSON.parse(market.outcomePrices).map(Number)
                : market.outcomePrices.map(Number);
        } catch {
            if (Array.isArray(market.outcomePrices)) outcomePrices = market.outcomePrices.map(Number);
        }
    }

    // Store Gamma Prices for Fallback
    if (Array.isArray(market?.tokens)) {
        market.tokens.forEach((t: any) => {
            if (t.token_id && t.price !== undefined) {
                gammaPriceMap.set(t.token_id, Number(t.price));
                gammaPriceCache.set(t.token_id, Number(t.price), GAMMA_TTL_MS);
            }
        });
    }

    // Map outcome prices to tokens via outcome name
    if (outcomePrices.length > 0 && market?.outcomes) {
        let outcomes: string[] = [];
        try {
            outcomes = typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : market.outcomes;
        } catch {
            if (Array.isArray(market.outcomes)) outcomes = market.outcomes;
        }

        outcomes.forEach((outcomeName, idx) => {
            const price = outcomePrices[idx] || 0;
            uniqueTokenIds.forEach(tid => {
                const meta = metadataMap.get(tid);
                if (!meta) return;
                const conditionMatch = meta.conditionId === market.conditionId;
                const slugMatch = meta.marketSlug === market.slug;
                if ((conditionMatch || slugMatch) && parseOutcome(meta.outcome) === parseOutcome(outcomeName)) {
                    if (!gammaPriceMap.has(tid)) {
                        gammaPriceMap.set(tid, price);
                        gammaPriceCache.set(tid, price, GAMMA_TTL_MS);
                    }
                }
            });
        });
    }

    const isResolvedState = market?.closed || (outcomePrices.some(p => p >= 0.95 || p <= 0.05));

    if (isResolvedState) {
        if (Array.isArray(market?.tokens)) {
            market.tokens.forEach((t: any) => {
                if (t.token_id && (t.winner || t.price !== undefined)) {
                    const tid = t.token_id;
                    const price = Number(t.price || 0);
                    let isWinner = t.winner;
                    if (isWinner === undefined) {
                        isWinner = price >= 0.95;
                    }
                    if (price >= 0.95 || price <= 0.05 || t.winner !== undefined) {
                        const resolution = { resolved: true, winner: !!isWinner };
                        marketResolutionMap.set(tid, resolution);
                        resolutionCache.set(tid, resolution, RESOLUTION_TTL_MS);
                    }
                }
            });
        }

        if (outcomePrices.length > 0 && market?.outcomes) {
            let outcomes: string[] = [];
            try { outcomes = typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : market.outcomes; } catch { if (Array.isArray(market.outcomes)) outcomes = market.outcomes; }

            outcomes.forEach((outcomeName, idx) => {
                const price = outcomePrices[idx] || 0;
                if (price >= 0.95 || price <= 0.05) {
                    const isWin = price >= 0.95;
                    uniqueTokenIds.forEach(tid => {
                        const meta = metadataMap.get(tid);
                        if (!meta) return;
                        const outcomeMatch = parseOutcome(meta.outcome) === parseOutcome(outcomeName);
                        const conditionMatch = meta.conditionId === market.conditionId;
                        const slugMatch = meta.marketSlug === market.slug;
                        if (outcomeMatch && (conditionMatch || slugMatch)) {
                            const resolution = { resolved: true, winner: isWin };
                            marketResolutionMap.set(tid, resolution);
                            resolutionCache.set(tid, resolution, RESOLUTION_TTL_MS);
                        }
                    });
                }
            });
        }
    }
};

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const walletCheck = resolveCopyTradingWalletContext(request, {
        queryWallet: searchParams.get('wallet'),
    });
    if (!walletCheck.ok) {
        return NextResponse.json({ error: walletCheck.error }, { status: walletCheck.status });
    }
    const normalizedWallet = walletCheck.wallet;

    try {
        const cacheKey = `positions:${normalizedWallet}`;
        const responsePayload = await responseCache.getOrSet(cacheKey, RESPONSE_TTL_MS, async () => {

            // Fetch local DB positions (filter out synthetic adjustment tokens)
            const allPositions = await prisma.userPosition.findMany({
                where: {
                    walletAddress: normalizedWallet,
                    balance: { gt: 0 }
                },
                orderBy: { totalCost: 'desc' }
            });

            // Filter out synthetic adjustment positions (from ROI/Volume adjustment scripts)
            const positions = allPositions.filter(p =>
                !p.tokenId.startsWith('synth-volume-') &&
                !p.tokenId.startsWith('synthetic-')
            );

            const tokenIds = positions.map(p => p.tokenId).filter((id): id is string => !!id);
            const uniqueTokenIds = Array.from(new Set(tokenIds));

            // 1) 批量补元数据（slug/outcome/conditionId），用于展示与 Gamma 对齐。
            const tradeMetadata = await prisma.copyTrade.findMany({
                where: { tokenId: { in: uniqueTokenIds } },
                select: { tokenId: true, marketSlug: true, outcome: true, detectedAt: true, conditionId: true },
                orderBy: { detectedAt: 'desc' }
            });

            // Map metadata for O(1) lookup
            const metadataMap = new Map<string, typeof tradeMetadata[0]>();

            const tradesByToken: Record<string, typeof tradeMetadata> = {};
            tradeMetadata.forEach(t => {
                if (t.tokenId) {
                    if (!tradesByToken[t.tokenId]) tradesByToken[t.tokenId] = [];
                    tradesByToken[t.tokenId].push(t);
                }
            });

            uniqueTokenIds.forEach(tokenId => {
                const trades = tradesByToken[tokenId];
                if (trades && trades.length > 0) {
                    const withSlug = trades.find(t => t.marketSlug !== null && t.marketSlug !== '');
                    const withOutcome = trades.find(t => t.outcome !== null && t.outcome !== '');
                    const latest = trades[0];

                    metadataMap.set(tokenId, {
                        ...latest,
                        marketSlug: withSlug?.marketSlug || latest.marketSlug,
                        outcome: withOutcome?.outcome || latest.outcome,
                        conditionId: latest.conditionId
                    });
                }
            });

            // 2) 先取 CLOB 盘口价格（主价格源）。
            let priceMap = new Map<string, number>();
            uniqueTokenIds.forEach((tid) => {
                const cached = orderbookPriceCache.get(tid);
                if (cached !== undefined) {
                    priceMap.set(tid, cached);
                }
            });
            try {
                const tokensToFetch = uniqueTokenIds.filter((id) => !priceMap.has(id));
                if (tokensToFetch.length > 0) {
                    const orderbooks = await polyClient.markets.getTokenOrderbooks(
                        tokensToFetch.map(id => ({ tokenId: id, side: 'BUY' as const }))
                    );

                    orderbooks.forEach((book, tokenId) => {
                        if (book.bids.length > 0) {
                            const price = book.bids[0].price;
                            priceMap.set(tokenId, price);
                            orderbookPriceCache.set(tokenId, price, PRICE_TTL_MS);
                        }
                        // 没有 bids 时不强行写 0，后续允许回退到 entry/gamma，避免伪造爆亏。
                    });
                }
            } catch (err) {
                console.error("Failed to batch fetch prices", err);
            }

            // 3) 再从 Gamma 拉“补价格 + 是否已结算”状态（次级源 + 结算源）。
            const marketResolutionMap = new Map<string, { resolved: boolean, winner: boolean }>();
            const gammaPriceMap = new Map<string, number>(); // Secondary price source
            uniqueTokenIds.forEach((tid) => {
                const cachedGamma = gammaPriceCache.get(tid);
                if (cachedGamma !== undefined) {
                    gammaPriceMap.set(tid, cachedGamma);
                }
                const cachedResolution = resolutionCache.get(tid);
                if (cachedResolution) {
                    marketResolutionMap.set(tid, cachedResolution);
                }
            });
            try {
                // 优先按 slug 查询（贴合前端链路），缺失时回退 conditionId。
                const jobs = new Map<string, { type: 'slug' | 'condition', value: string }>();

                uniqueTokenIds.forEach(id => {
                    const info = metadataMap.get(id);
                    if (!info) return;
                    const hasGamma = gammaPriceMap.has(id);
                    const hasResolution = marketResolutionMap.has(id);
                    if (hasGamma && hasResolution) return;
                    // Start with slug (preferred for resolution logic alignment with metrics)
                    if (info.marketSlug && !info.marketSlug.includes('unknown')) {
                        jobs.set(info.marketSlug, { type: 'slug', value: info.marketSlug });
                    }
                    // Fallback to ConditionID if slug is missing/unknown and ConditionID is valid
                    else if (info.conditionId && info.conditionId !== '0x0' && info.conditionId.length > 10) {
                        jobs.set(info.conditionId, { type: 'condition', value: info.conditionId });
                    }
                });

                const tasks = Array.from(jobs.values());

                // 小批并发，防止请求风暴打穿 Gamma。
                const BATCH_SIZE = 5;
                for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
                    const batch = tasks.slice(i, i + BATCH_SIZE);
                    await Promise.all(batch.map(async (task) => {
                        try {
                            const cacheKey = `${task.type}:${task.value}`;
                            const cachedMarket = gammaMarketCache.get(cacheKey);
                            if (cachedMarket) {
                                applyGammaMarket(cachedMarket, uniqueTokenIds, metadataMap, gammaPriceMap, marketResolutionMap);
                                return;
                            }

                            let url = `${GAMMA_API_BASE}/markets?limit=1`;
                            if (task.type === 'condition') {
                                url += `&condition_id=${task.value}`;
                            } else {
                                url += `&slug=${task.value}`;
                            }

                            const response = await fetchWithTimeout(url, GAMMA_TIMEOUT_MS);
                            if (!response.ok) {
                                gammaMarketCache.set(cacheKey, null, GAMMA_FAILURE_TTL_MS);
                                return;
                            }

                            const data = await response.json();
                            if (Array.isArray(data) && data.length > 0) {
                                const market = data[0];
                                gammaMarketCache.set(cacheKey, market, GAMMA_TTL_MS);
                                applyGammaMarket(market, uniqueTokenIds, metadataMap, gammaPriceMap, marketResolutionMap);
                            } else {
                                gammaMarketCache.set(cacheKey, null, GAMMA_FAILURE_TTL_MS);
                            }
                        } catch (e) {
                            console.error(`Failed to fetch/parse market ${task.value}`, e);
                            const cacheKey = `${task.type}:${task.value}`;
                            gammaMarketCache.set(cacheKey, null, GAMMA_FAILURE_TTL_MS);
                        }
                    }));
                }

            } catch (err) {
                console.error("Failed to fetch resolution status", err);
            }

            console.log(`Debug: Fetched ${priceMap.size} prices. Resolution Update Count: ${marketResolutionMap.size}`);

            const enrichedPositions = positions.map((pos) => {
                const tradeInfo = metadataMap.get(pos.tokenId);
                const rawPrice = priceMap.get(pos.tokenId);

                // 价格优先级：
                // 1) CLOB 盘口价
                // 2) Gamma 价格
                // 3) avgEntryPrice（兜底）
                let curPrice = rawPrice !== undefined ? rawPrice : pos.avgEntryPrice;

                // 若市场已明确结算，价格强制改写为 1/0，确保持仓价值与最终结果一致。
                const resolution = marketResolutionMap.get(pos.tokenId);
                if (resolution && resolution.resolved) {
                    curPrice = resolution.winner ? 1.0 : 0.0;
                }

                // Safe PnL calculation
                let percentPnl = 0;
                if (pos.avgEntryPrice > 0 && curPrice !== null) {
                    percentPnl = (curPrice - pos.avgEntryPrice) / pos.avgEntryPrice;
                    if (percentPnl < -1) percentPnl = -1;
                    // if (percentPnl > 10) percentPnl = 10; // Cap visual PnL? Maybe not.
                }

                const estValue = pos.balance * (curPrice || 0);

                // 状态口径：
                // - OPEN：未结算
                // - SETTLED_WIN / SETTLED_LOSS：按结算或极值价格判定
                let status: 'OPEN' | 'SETTLED_WIN' | 'SETTLED_LOSS' = 'OPEN';
                if (rawPrice !== undefined) {
                    if (rawPrice >= 0.95) status = 'SETTLED_WIN';
                    else if (rawPrice <= 0.05) status = 'SETTLED_LOSS';
                }
                if (resolution && resolution.resolved) {
                    status = resolution.winner ? 'SETTLED_WIN' : 'SETTLED_LOSS';
                }

                // 若 CLOB 缺失/异常且未结算，尝试用 Gamma 价格修正，避免 UI 长时间卡在 entry price。
                if ((curPrice === pos.avgEntryPrice || curPrice === 0) && !resolution?.resolved) {
                    const bestGammaPrice = gammaPriceMap.get(pos.tokenId);
                    if (bestGammaPrice !== undefined) {
                        curPrice = bestGammaPrice;
                    }
                }

                // Re-calculate PnL with finalized curPrice
                if (pos.avgEntryPrice > 0 && curPrice !== null) {
                    percentPnl = (curPrice - pos.avgEntryPrice) / pos.avgEntryPrice;
                    if (percentPnl < -1) percentPnl = -1;
                }

                return {
                    tokenId: pos.tokenId,
                    slug: tradeInfo?.marketSlug || null,
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

            return enrichedPositions;
        });
        return NextResponse.json(responsePayload);

    } catch (error) {
        console.error('Error fetching positions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
