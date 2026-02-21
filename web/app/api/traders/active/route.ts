/**
 * Active Traders API
 * 
 * Returns traders who are actively trading and have current positions.
 * This is optimized for copy trading - only shows traders worth following.
 * 
 * Algorithm:
 * 1. Fetch leaderboard for specified period as candidate pool
 * 2. Filter for traders with active positions AND recent trades
 * 3. Calculate copy score based on multiple factors
 * 4. Return top traders sorted by copy score
 */

import { NextRequest, NextResponse } from 'next/server';
import { polyClient } from '@/lib/polymarket';
import {
    calculateScientificScore,
    Trade,
} from '@/lib/services/trader-scoring-service';
import { createTTLCache } from '@/lib/server-cache';
import {
    getLeaderboardFromCache,
    getCacheMetadata,
    isCacheFresh,
    Period as CachePeriod
} from '@/lib/services/leaderboard-cache-service';
import { isDatabaseEnabled } from '@/lib/prisma';
import {
    ActivityLike,
    fetchTraderActivities,
    normalizeTimestampSeconds,
    resolveActivityMaxItems,
} from '@/lib/services/trader-activity-service';

// ===== Types =====

interface ActiveTrader {
    address: string;
    name: string | null;
    profileImage?: string;

    // Activity metrics
    activePositions: number;
    recentTrades: number;
    lastTradeTime: number;

    // Performance metrics
    pnl: number;
    volume: number;
    winRate: number;

    // Scientific metrics
    profitFactor: number;
    maxDrawdown: number;
    volumeWeightedWinRate: number;
    sharpeRatio: number;
    copyFriendliness: number;
    diversificationScore: number; // NEW: market diversification
    uniqueMarkets: number;        // NEW: number of unique markets traded
    dataQuality: 'full' | 'limited' | 'insufficient';

    // Scoring
    copyScore: number;
    rank: number;
}

interface CachedData {
    traders: ActiveTrader[];
    fetchedAt: number;
}

type ActiveTraderResponse = {
    traders: ActiveTrader[];
    cached: boolean;
    source: 'memory' | 'database' | 'live';
    cachedAt: string;
    algorithm: string;
    ttlRemaining?: number;
    fresh?: boolean;
};

// ===== Cache Settings =====
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in-memory
const DB_CACHE_TTL_MINUTES = 10; // 10 minutes DB cache
const LEADERBOARD_TTL_MS = 60 * 1000; // 1 minute
const TRADER_DETAIL_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TRADER_ERROR_TTL_MS = 30 * 1000; // 30 seconds

// In-memory cache by period
const memoryCache: Record<string, CachedData> = {};
const inFlightRequests: Record<string, Promise<ActiveTraderResponse> | undefined> = {};
type LeaderboardSnapshot = Awaited<ReturnType<typeof polyClient.dataApi.getLeaderboard>>;
const leaderboardCache = createTTLCache<LeaderboardSnapshot>();
const traderDetailCache = createTTLCache<ActiveTrader | null>();

// ===== Score Calculation =====
// Now uses trader-scoring-service for scientific scoring

function convertActivitiesToTrades(activities: ActivityLike[]): Trade[] {
    return activities
        .filter(a => a.type === 'TRADE' && a.side && a.size && a.price)
        .map(a => {
            const size = Number(a.size ?? 0);
            const price = Number(a.price ?? 0);

            return {
                timestamp: normalizeTimestampSeconds(Number(a.timestamp)),
                side: a.side as 'BUY' | 'SELL',
                size,
                price,
                value: Number(a.usdcSize ?? (size * price)),
                pnl: undefined,
                marketId: a.conditionId || a.tokenId || undefined, // Track market for diversification
            };
        });
}

function enrichTradesWithTotalPnL(trades: Trade[], totalPnL: number): Trade[] {
    const sellTrades = trades.filter(t => t.side === 'SELL');

    if (sellTrades.length === 0) return trades;

    // Distribute Total PnL across sell trades proportionally (Average)
    // NOTE: This destroys variance metrics (Sharpe, etc) but preserves Total PnL correctness
    const pnlPerTrade = totalPnL / sellTrades.length;

    return trades.map(t => {
        if (t.side === 'SELL') {
            return { ...t, pnl: pnlPerTrade };
        }
        return t;
    });
}

// ===== Data Fetching =====

type Period = '7d' | '15d' | '30d' | '90d';

function mapPeriodToSdk(period: Period): 'WEEK' | 'MONTH' | 'ALL' {
    switch (period) {
        case '7d': return 'WEEK';
        case '15d': return 'MONTH'; // Approximation: 15d not native, using MONTH for candidate pool
        case '30d': return 'MONTH';
        case '90d': return 'ALL';   // Approximation: 90d not native, using ALL for pool
        default: return 'WEEK';
    }
}

function mapPeriodToDays(period: Period): number {
    switch (period) {
        case '7d': return 7;
        case '15d': return 15;
        case '30d': return 30;
        case '90d': return 90;
        default: return 7;
    }
}

async function fetchActiveTraders(limit: number, period: Period): Promise<ActiveTrader[]> {
    const timePeriod = mapPeriodToSdk(period);

    // Step 1: Get leaderboard as candidate pool (profitable traders in period)
    const leaderboardKey = `leaderboard:${timePeriod}`;
    let leaderboard = leaderboardCache.get(leaderboardKey);
    if (!leaderboard) {
        leaderboard = await polyClient.dataApi.getLeaderboard({
            timePeriod,
            orderBy: 'PNL',
            limit: 50, // Fetch more to filter down
        });
        leaderboardCache.set(leaderboardKey, leaderboard, LEADERBOARD_TTL_MS);
    }

    // Step 2: For each candidate, fetch positions and activity in parallel
    // Calculate start time based on actual period for activity filtering
    const nowSeconds = Math.floor(Date.now() / 1000);
    const days = mapPeriodToDays(period);
    const startTime = nowSeconds - days * 24 * 60 * 60;
    const activityMaxItems = resolveActivityMaxItems(days);

    const results: Array<ActiveTrader | null> = [];
    const batchSize = 5;

    type LeaderboardEntry = (typeof leaderboard.entries)[number];

    for (let i = 0; i < leaderboard.entries.length; i += batchSize) {
        const batch = leaderboard.entries.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(async (trader: LeaderboardEntry) => {
            const cacheKey = `detail:${period}:${trader.address.toLowerCase()}`;
            const cached = traderDetailCache.get(cacheKey);
            if (cached !== undefined) return cached;

            try {
                const [positions, activities] = await Promise.all([
                    polyClient.dataApi.getPositions(trader.address, { limit: 50 }),
                    fetchTraderActivities(trader.address, {
                        startSec: startTime,
                        maxItems: activityMaxItems,
                        type: 'TRADE',
                    }),
                ]);

                // Count recent trades (only TRADE type) in the specific period
                const periodTrades = activities.filter(
                    a => normalizeTimestampSeconds(Number(a.timestamp)) >= startTime
                );

                // Calculate simple win rate from positions for display
                const profitablePositions = positions.filter(p => (p.cashPnl || 0) > 0);
                const winRate = positions.length > 0
                    ? profitablePositions.length / positions.length
                    : 0;

                // Get last trade time
                const lastTradeTime = periodTrades.length > 0
                    ? Math.max(...periodTrades.map(a => normalizeTimestampSeconds(Number(a.timestamp))))
                    : 0;

                // Convert activities to trades and enrich with PnL for scientific scoring
                const trades = convertActivitiesToTrades(activities);
                const enrichedTrades = enrichTradesWithTotalPnL(trades, trader.pnl || 0);

                // Calculate scientific metrics
                const metrics = calculateScientificScore(enrichedTrades, { periodDays: days });

                const enriched: ActiveTrader = {
                    address: trader.address.toLowerCase(),
                    name: trader.userName || null,
                    profileImage: trader.profileImage,

                    activePositions: positions.length,
                    recentTrades: periodTrades.length,
                    lastTradeTime,

                    pnl: trader.pnl,
                    volume: trader.volume,
                    winRate,

                    // Scientific metrics
                    profitFactor: metrics.profitFactor,
                    maxDrawdown: metrics.maxDrawdown,
                    volumeWeightedWinRate: metrics.volumeWeightedWinRate,
                    sharpeRatio: metrics.sharpeRatio,
                    copyFriendliness: metrics.copyFriendliness,
                    diversificationScore: metrics.diversificationScore,
                    uniqueMarkets: metrics.uniqueMarkets,
                    dataQuality: metrics.dataQuality,

                    copyScore: metrics.scientificScore,
                    rank: 0, // Assigned below
                };

                traderDetailCache.set(cacheKey, enriched, TRADER_DETAIL_TTL_MS);
                return enriched;
            } catch (error) {
                console.error(`[ActiveTraders] Failed to fetch data for ${trader.address}:`, error);
                traderDetailCache.set(cacheKey, null, TRADER_ERROR_TTL_MS);
                return null;
            }
        }));
        results.push(...batchResults);
    }

    const enrichedTraders = results;

    // Step 3: Filter out failed fetches and inactive traders
    // Stricter filtering: require minimum trades and positions
    const MIN_TRADES_FOR_COPY = 3; // At least 3 trades to be considered
    const validTraders = enrichedTraders.filter((t): t is NonNullable<typeof t> =>
        t !== null &&
        t.activePositions > 0 && // Must have current positions
        t.recentTrades >= MIN_TRADES_FOR_COPY && // Require minimum trades
        t.dataQuality !== 'insufficient' // Must have sufficient data quality
    );

    // Step 4: Sort by scientific score and assign ranks
    const ranked = validTraders
        .sort((a, b) => b.copyScore - a.copyScore)
        .slice(0, limit)
        .map((trader, index) => ({
            ...trader,
            rank: index + 1,
        }));

    return ranked;
}

// ===== API Handler =====

async function buildResponsePayload(
    limit: number,
    period: Period,
    forceRefresh: boolean
): Promise<ActiveTraderResponse> {
    const now = Date.now();
    const cacheKey = `${period}-${limit}`;

    // Layer 1: In-memory cache check
    const inMemory = memoryCache[cacheKey];
    if (!forceRefresh && inMemory && (now - inMemory.fetchedAt) < CACHE_TTL) {
        return {
            traders: inMemory.traders,
            cached: true,
            source: 'memory',
            cachedAt: new Date(inMemory.fetchedAt).toISOString(),
            ttlRemaining: Math.round((CACHE_TTL - (now - inMemory.fetchedAt)) / 1000),
            algorithm: 'active-traders-v2-period',
        };
    }

    // Layer 2: Database cache check
    if (!forceRefresh && isDatabaseEnabled && process.env.USE_LEADERBOARD_CACHE !== 'false') {
        const dbTraders = await getLeaderboardFromCache(period as CachePeriod, limit);
        const dbMeta = await getCacheMetadata(period as CachePeriod);

        if (dbTraders && dbMeta) {
            const fresh = isCacheFresh(dbMeta.lastUpdateAt, DB_CACHE_TTL_MINUTES);

            memoryCache[cacheKey] = {
                traders: dbTraders as any[],
                fetchedAt: dbMeta.lastUpdateAt.getTime(),
            };

            return {
                traders: dbTraders as any[], // Cast for compatibility with older cached data
                cached: true,
                source: 'database',
                fresh,
                cachedAt: dbMeta.lastUpdateAt.toISOString(),
                algorithm: 'active-traders-v2-period',
            };
        }
    }

    // Layer 3: Fetch fresh data from Polymarket (Fallback)
    console.log(`[ActiveTraders] No valid cache found. Fetching fresh data for period: ${period}...`);
    const traders = await fetchActiveTraders(Math.max(limit, 20), period);

    memoryCache[cacheKey] = {
        traders,
        fetchedAt: now,
    };

    console.log(`[ActiveTraders] Found ${traders.length} active traders for ${period} (Live Fetch)`);

    return {
        traders: traders.slice(0, limit),
        cached: false,
        source: 'live',
        cachedAt: new Date(now).toISOString(),
        algorithm: 'active-traders-v2-period',
    };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const period = (searchParams.get('period') || '7d') as Period;
    const forceRefresh = searchParams.get('refresh') === 'true';

    try {
        const cacheKey = `${period}-${limit}`;

        if (!forceRefresh && inFlightRequests[cacheKey]) {
            const sharedPayload = await inFlightRequests[cacheKey];
            return NextResponse.json(sharedPayload);
        }

        const requestPromise = buildResponsePayload(limit, period, forceRefresh);
        inFlightRequests[cacheKey] = requestPromise;

        try {
            const payload = await requestPromise;
            return NextResponse.json(payload);
        } finally {
            delete inFlightRequests[cacheKey];
        }
    } catch (error) {
        console.error('[ActiveTraders] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch active traders', traders: [] },
            { status: 500 }
        );
    }
}
