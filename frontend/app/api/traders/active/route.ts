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
import {
    getLeaderboardFromCache,
    getCacheMetadata,
    isCacheFresh,
    Period as CachePeriod
} from '@/lib/services/leaderboard-cache-service';

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
    dataQuality: 'full' | 'limited' | 'insufficient';

    // Scoring
    copyScore: number;
    rank: number;
}

interface CachedData {
    traders: ActiveTrader[];
    fetchedAt: number;
}

// ===== Cache Settings =====
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in-memory
const DB_CACHE_TTL_MINUTES = 10; // 10 minutes DB cache

// In-memory cache by period
const memoryCache: Record<string, CachedData> = {};

// ===== Score Calculation =====
// Now uses trader-scoring-service for scientific scoring

function convertActivitiesToTrades(activities: any[]): Trade[] {
    return activities
        .filter(a => a.type === 'TRADE' && a.side && a.size && a.price)
        .map(a => ({
            timestamp: a.timestamp,
            side: a.side as 'BUY' | 'SELL',
            size: a.size,
            price: a.price,
            value: a.usdcSize || (a.size * a.price),
            pnl: undefined,
        }));
}

function enrichTradesWithPositionPnL(trades: Trade[], positions: any[]): Trade[] {
    // Calculate total realized PnL from positions
    const totalPnL = positions.reduce((sum, p) => sum + (p.cashPnl || 0), 0);
    const sellTrades = trades.filter(t => t.side === 'SELL');

    if (sellTrades.length === 0) return trades;

    // Distribute PnL across sell trades proportionally
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

async function fetchActiveTraders(limit: number, period: Period): Promise<ActiveTrader[]> {
    const timePeriod = mapPeriodToSdk(period);

    // Step 1: Get leaderboard as candidate pool (profitable traders in period)
    const leaderboard = await polyClient.dataApi.getLeaderboard({
        timePeriod,
        orderBy: 'PNL',
        limit: 50, // Fetch more to filter down
    });

    // Step 2: For each candidate, fetch positions and activity in parallel
    // Calculate start time based on actual period for activity filtering
    const nowSeconds = Math.floor(Date.now() / 1000);
    let days = 7;
    if (period === '15d') days = 15;
    if (period === '30d') days = 30;
    if (period === '90d') days = 90;

    const startTime = nowSeconds - days * 24 * 60 * 60;

    const enrichedTraders = await Promise.all(
        leaderboard.entries.map(async (trader) => {
            try {
                const [positions, activities] = await Promise.all([
                    polyClient.dataApi.getPositions(trader.address, { limit: 50 }),
                    polyClient.dataApi.getActivity(trader.address, {
                        limit: 100,
                        start: startTime,
                    }),
                ]);

                // Count recent trades (only TRADE type) in the specific period
                const periodTrades = activities.filter(a => a.type === 'TRADE' && a.timestamp >= startTime);

                // Calculate simple win rate from positions for display
                const profitablePositions = positions.filter(p => (p.cashPnl || 0) > 0);
                const winRate = positions.length > 0
                    ? profitablePositions.length / positions.length
                    : 0;

                // Get last trade time
                const lastTradeTime = periodTrades.length > 0
                    ? periodTrades[0].timestamp
                    : 0;

                // Convert activities to trades and enrich with PnL for scientific scoring
                const trades = convertActivitiesToTrades(activities);
                const enrichedTrades = enrichTradesWithPositionPnL(trades, positions);

                // Calculate scientific metrics
                const metrics = calculateScientificScore(enrichedTrades, { periodDays: days });

                return {
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
                    dataQuality: metrics.dataQuality,

                    copyScore: metrics.scientificScore,
                    rank: 0, // Assigned below
                };
            } catch (error) {
                console.error(`[ActiveTraders] Failed to fetch data for ${trader.address}:`, error);
                return null;
            }
        })
    );

    // Step 3: Filter out failed fetches and inactive traders
    const validTraders = enrichedTraders.filter((t): t is NonNullable<typeof t> =>
        t !== null &&
        t.activePositions > 0 && // Must have current positions
        (t.recentTrades >= 1 || period === '90d') // Relax trade count for longer periods
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

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const period = (searchParams.get('period') || '7d') as Period;
    const forceRefresh = searchParams.get('refresh') === 'true';

    try {
        const now = Date.now();
        const cacheKey = `${period}-${limit}`;

        // Layer 1: In-memory cache check
        const inMemory = memoryCache[cacheKey];
        if (!forceRefresh && inMemory && (now - inMemory.fetchedAt) < CACHE_TTL) {
            return NextResponse.json({
                traders: inMemory.traders,
                cached: true,
                source: 'memory',
                cachedAt: new Date(inMemory.fetchedAt).toISOString(),
                ttlRemaining: Math.round((CACHE_TTL - (now - inMemory.fetchedAt)) / 1000),
                algorithm: 'active-traders-v2-period',
            });
        }

        // Layer 2: Database cache check
        if (!forceRefresh) {
            const dbTraders = await getLeaderboardFromCache(period as CachePeriod, limit);
            const dbMeta = await getCacheMetadata(period as CachePeriod);

            if (dbTraders && dbMeta) {
                const fresh = isCacheFresh(dbMeta.lastUpdateAt, DB_CACHE_TTL_MINUTES);

                // Return DB cache even if slightly stale, as per design
                // If it's very stale (e.g., failed updates for hours), we might want to fetch fresh
                // But for now, returning DB cache is sub-second which is the goal.

                // Update memory cache
                memoryCache[cacheKey] = {
                    traders: dbTraders as any[],
                    fetchedAt: dbMeta.lastUpdateAt.getTime(),
                };

                return NextResponse.json({
                    traders: dbTraders,
                    cached: true,
                    source: 'database',
                    fresh,
                    cachedAt: dbMeta.lastUpdateAt.toISOString(),
                    algorithm: 'active-traders-v2-period',
                });
            }
        }

        // Layer 3: Fetch fresh data from Polymarket (Fallback)
        console.log(`[ActiveTraders] No valid cache found. Fetching fresh data for period: ${period}...`);
        const traders = await fetchActiveTraders(Math.max(limit, 20), period);

        // Update memory cache
        memoryCache[cacheKey] = {
            traders,
            fetchedAt: now,
        };

        console.log(`[ActiveTraders] Found ${traders.length} active traders for ${period} (Live Fetch)`);

        return NextResponse.json({
            traders: traders.slice(0, limit),
            cached: false,
            source: 'live',
            cachedAt: new Date(now).toISOString(),
            algorithm: 'active-traders-v2-period',
        });
    } catch (error) {
        console.error('[ActiveTraders] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch active traders', traders: [] },
            { status: 500 }
        );
    }
}


