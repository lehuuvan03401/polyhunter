
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { polyClient } from '@/lib/polymarket';
import { parseMarketSlug, parseOutcome } from '@/lib/utils';

const GAMMA_API_BASE = process.env.GAMMA_API_URL || 'https://gamma-api.polymarket.com';
// Force recompile

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

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

        // 1. Batch Fetch Metadata
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

        // 2. Batch Fetch Prices (Orderbook)
        let priceMap = new Map<string, number>();
        try {
            const orderbooks = await polyClient.markets.getTokenOrderbooks(
                uniqueTokenIds.map(id => ({ tokenId: id, side: 'BUY' as const }))
            );

            orderbooks.forEach((book, tokenId) => {
                if (book.bids.length > 0) {
                    priceMap.set(tokenId, book.bids[0].price);
                }
                // Note: If no bids, we DON'T set to 0. This allows fallback to entry price later.
            });
        } catch (err) {
            console.error("Failed to batch fetch prices", err);
        }

        // 3. Batch Fetch Resolution Status (Gamma Direct HTTP)
        const marketResolutionMap = new Map<string, { resolved: boolean, winner: boolean }>();
        const gammaPriceMap = new Map<string, number>(); // Secondary price source
        try {
            const tasks: { type: 'condition' | 'slug', value: string }[] = [];
            const processedKeys = new Set<string>();

            uniqueTokenIds.forEach(id => {
                const info = metadataMap.get(id);
                if (info) {
                    // Check if conditionId is valid (not '0x0' or empty)
                    const hasValidConditionId = info.conditionId &&
                        info.conditionId !== '0x0' &&
                        info.conditionId.length > 10;

                    if (hasValidConditionId && !processedKeys.has(info.conditionId!)) {
                        tasks.push({ type: 'condition', value: info.conditionId! });
                        processedKeys.add(info.conditionId!);
                    } else if (info.marketSlug && !processedKeys.has(info.marketSlug)) {
                        // Fallback to slug if conditionId is invalid or missing
                        tasks.push({ type: 'slug', value: info.marketSlug });
                        processedKeys.add(info.marketSlug);
                    }
                }
            });

            // Concurrency Control
            const BATCH_SIZE = 5;
            for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
                const batch = tasks.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(async (task) => {
                    try {
                        let url = `${GAMMA_API_BASE}/markets?limit=1`;
                        if (task.type === 'condition') {
                            url += `&condition_id=${task.value}`;
                        } else {
                            url += `&slug=${task.value}`;
                        }

                        const response = await fetch(url);
                        if (!response.ok) return;

                        const data = await response.json();
                        if (Array.isArray(data) && data.length > 0) {
                            const market = data[0];

                            // Parse Outcome Prices
                            let outcomePrices: number[] = [];
                            if (market.outcomePrices) {
                                try {
                                    outcomePrices = typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices).map(Number) : market.outcomePrices.map(Number);
                                } catch {
                                    if (Array.isArray(market.outcomePrices)) outcomePrices = market.outcomePrices.map(Number);
                                }
                            }

                            // Store Gamma Prices for Fallback
                            if (Array.isArray(market.tokens)) {
                                market.tokens.forEach((t: any) => {
                                    if (t.token_id && t.price !== undefined) {
                                        // If we have token specific price
                                        gammaPriceMap.set(t.token_id, Number(t.price));
                                    } else if (t.token_id && t.outcome) {
                                        // Try to map via outcome index
                                        // This is tricky without index but usually they are ordered.
                                        // Let's rely on outcome name matching if possible or simple index if outcomes match
                                    }
                                });
                            }

                            // Map outcome prices to tokens via outcome name
                            if (outcomePrices.length > 0 && market.outcomes) {
                                let outcomes: string[] = [];
                                try { outcomes = typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : market.outcomes; } catch { if (Array.isArray(market.outcomes)) outcomes = market.outcomes; }

                                outcomes.forEach((outcomeName, idx) => {
                                    const price = outcomePrices[idx] || 0;

                                    uniqueTokenIds.forEach(tid => {
                                        const meta = metadataMap.get(tid);
                                        // Match by Condition ID or Slug, and Outcome Name
                                        if (meta) {
                                            const conditionMatch = meta.conditionId === market.conditionId;
                                            const slugMatch = meta.marketSlug === market.slug;
                                            // Relaxed check: Allow match if either conditionId OR slug matches (fixes simulated trades)
                                            if ((conditionMatch || slugMatch) && parseOutcome(meta.outcome) === parseOutcome(outcomeName)) {
                                                if (!gammaPriceMap.has(tid)) {
                                                    gammaPriceMap.set(tid, price);
                                                }
                                            }
                                        }
                                    });
                                });
                            }

                            const isResolvedState = market.closed || (outcomePrices.some(p => p >= 0.95 || p <= 0.05));

                            if (isResolvedState) {
                                const tokens = market.tokens;
                                if (Array.isArray(tokens)) {
                                    tokens.forEach((t: any) => {
                                        if (t.token_id && (t.winner || t.price !== undefined)) {
                                            const tid = t.token_id;
                                            const price = Number(t.price || 0); // or look at outcomePrices
                                            // Fallback winner check
                                            let isWinner = t.winner;
                                            if (isWinner === undefined) {
                                                isWinner = price >= 0.95;
                                            }

                                            // Check if price indicates resolution
                                            if (price >= 0.95 || price <= 0.05 || t.winner !== undefined) {
                                                marketResolutionMap.set(tid, {
                                                    resolved: true,
                                                    winner: !!isWinner
                                                });
                                            }
                                        }
                                    });
                                }

                                // Fallback: Match by outcome string if we have outcomePrices but no tokens details
                                if (outcomePrices.length > 0 && market.outcomes) {
                                    let outcomes: string[] = [];
                                    try { outcomes = typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : market.outcomes; } catch { if (Array.isArray(market.outcomes)) outcomes = market.outcomes; }

                                    outcomes.forEach((outcomeName, idx) => {
                                        const price = outcomePrices[idx] || 0;
                                        if (price >= 0.95 || price <= 0.05) {
                                            const isWin = price >= 0.95;
                                            uniqueTokenIds.forEach(tid => {
                                                const meta = metadataMap.get(tid);
                                                if (meta) {
                                                    const outcomeMatch = parseOutcome(meta.outcome) === parseOutcome(outcomeName);
                                                    const conditionMatch = meta.conditionId === market.conditionId;
                                                    const slugMatch = meta.marketSlug === market.slug;

                                                    if (outcomeMatch && (conditionMatch || slugMatch)) {
                                                        marketResolutionMap.set(tid, { resolved: true, winner: isWin });
                                                    }
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                        }
                    } catch (e) {
                        console.error(`Failed to fetch/parse market ${task.value}`, e);
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

            // Default to avgEntryPrice if no live data
            let curPrice = rawPrice !== undefined ? rawPrice : pos.avgEntryPrice;

            // OVERRIDE: Check resolution status
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

            // Determine status
            let status: 'OPEN' | 'SETTLED_WIN' | 'SETTLED_LOSS' = 'OPEN';
            if (rawPrice !== undefined) {
                if (rawPrice >= 0.95) status = 'SETTLED_WIN';
                else if (rawPrice <= 0.05) status = 'SETTLED_LOSS';
            }
            if (resolution && resolution.resolved) {
                status = resolution.winner ? 'SETTLED_WIN' : 'SETTLED_LOSS';
            }

            // Fallback: If price is 0 but we have Gamma metadata, try to find current price from metadata map (outcomePrices)
            // This fixes the issue where Simulation shows Entry Price == Current Price because CLOB failed
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

        return NextResponse.json(enrichedPositions);

    } catch (error) {
        console.error('Error fetching positions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
