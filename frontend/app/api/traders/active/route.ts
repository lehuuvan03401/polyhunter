/**
 * Active Traders API
 * 
 * Returns traders who are actively trading and have current positions.
 * This is optimized for copy trading - only shows traders worth following.
 * 
 * Algorithm:
 * 1. Fetch weekly leaderboard as candidate pool
 * 2. Filter for traders with active positions AND recent trades
 * 3. Calculate copy score based on multiple factors
 * 4. Return top traders sorted by copy score
 */

import { NextRequest, NextResponse } from 'next/server';
import { polyClient } from '@/lib/polymarket';

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
    weeklyPnl: number;
    weeklyVolume: number;
    winRate: number;

    // Scoring
    copyScore: number;
    rank: number;
}

interface CachedData {
    traders: ActiveTrader[];
    fetchedAt: number;
}

// ===== Cache =====

let cachedData: CachedData | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ===== Score Calculation =====

function calculateCopyScore(
    activePositions: number,
    recentTrades: number,
    weeklyPnl: number,
    winRate: number,
    monthlyPnl: number
): number {
    // Active Positions: 25 points max (must have positions to score)
    const positionScore = activePositions > 0 ? 25 : 0;

    // Recent Trades (7d): 25 points max (10 trades = full score)
    const tradeScore = Math.min(25, (recentTrades / 10) * 25);

    // Weekly PnL: 20 points (profitable this week)
    const weeklyPnlScore = weeklyPnl > 0 ? 20 : 0;

    // Win Rate: 20 points max
    const winRateScore = winRate * 20;

    // Monthly PnL: 10 points (profitable this month)
    const monthlyPnlScore = monthlyPnl > 0 ? 10 : 0;

    return Math.round(positionScore + tradeScore + weeklyPnlScore + winRateScore + monthlyPnlScore);
}

// ===== Data Fetching =====

async function fetchActiveTraders(limit: number): Promise<ActiveTrader[]> {
    // Step 1: Get weekly leaderboard as candidate pool (profitable traders this week)
    const weeklyLeaderboard = await polyClient.dataApi.getLeaderboard({
        timePeriod: 'WEEK',
        orderBy: 'PNL',
        limit: 50, // Fetch more to filter down
    });

    // Step 2: For each candidate, fetch positions and activity in parallel
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

    const enrichedTraders = await Promise.all(
        weeklyLeaderboard.entries.map(async (trader) => {
            try {
                const [positions, activities] = await Promise.all([
                    polyClient.dataApi.getPositions(trader.address, { limit: 50 }),
                    polyClient.dataApi.getActivity(trader.address, {
                        limit: 100,
                        start: sevenDaysAgo,
                    }),
                ]);

                // Count recent trades (only TRADE type)
                const recentTrades = activities.filter(a => a.type === 'TRADE');

                // Calculate win rate from positions
                const profitablePositions = positions.filter(p => (p.cashPnl || 0) > 0);
                const winRate = positions.length > 0
                    ? profitablePositions.length / positions.length
                    : 0;

                // Get last trade time
                const lastTradeTime = recentTrades.length > 0
                    ? recentTrades[0].timestamp
                    : 0;

                return {
                    address: trader.address.toLowerCase(),
                    name: trader.userName || null,
                    profileImage: trader.profileImage,

                    activePositions: positions.length,
                    recentTrades: recentTrades.length,
                    lastTradeTime,

                    weeklyPnl: trader.pnl,
                    weeklyVolume: trader.volume,
                    winRate,

                    copyScore: 0, // Calculated below
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
        t.recentTrades >= 3      // Must have at least 3 trades in 7 days
    );

    // Step 4: Calculate copy scores
    // For monthly PnL, we'd need another API call, so we estimate based on weekly
    const scoredTraders = validTraders.map(trader => ({
        ...trader,
        copyScore: calculateCopyScore(
            trader.activePositions,
            trader.recentTrades,
            trader.weeklyPnl,
            trader.winRate,
            trader.weeklyPnl * 4 // Estimate monthly from weekly
        ),
    }));

    // Step 5: Sort by copy score and assign ranks
    const ranked = scoredTraders
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
    const forceRefresh = searchParams.get('refresh') === 'true';

    try {
        const now = Date.now();

        // Check cache validity
        if (!forceRefresh && cachedData && (now - cachedData.fetchedAt) < CACHE_TTL) {
            return NextResponse.json({
                traders: cachedData.traders.slice(0, limit),
                cached: true,
                cachedAt: new Date(cachedData.fetchedAt).toISOString(),
                ttlRemaining: Math.round((CACHE_TTL - (now - cachedData.fetchedAt)) / 1000),
                algorithm: 'active-traders-v1',
            }, {
                headers: {
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
                },
            });
        }

        // Fetch fresh data
        console.log('[ActiveTraders] Fetching fresh data...');
        const traders = await fetchActiveTraders(Math.max(limit, 20));

        // Update cache
        cachedData = {
            traders,
            fetchedAt: now,
        };

        console.log(`[ActiveTraders] Found ${traders.length} active traders`);

        return NextResponse.json({
            traders: traders.slice(0, limit),
            cached: false,
            cachedAt: new Date(now).toISOString(),
            ttlRemaining: Math.round(CACHE_TTL / 1000),
            algorithm: 'active-traders-v1',
        }, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
        });
    } catch (error) {
        console.error('[ActiveTraders] Error:', error);

        // Return cached data if available, even if stale
        if (cachedData && cachedData.traders.length > 0) {
            return NextResponse.json({
                traders: cachedData.traders.slice(0, limit),
                cached: true,
                stale: true,
                error: 'Failed to refresh, returning stale data',
                algorithm: 'active-traders-v1',
            });
        }

        return NextResponse.json(
            { error: 'Failed to fetch active traders', traders: [] },
            { status: 500 }
        );
    }
}
