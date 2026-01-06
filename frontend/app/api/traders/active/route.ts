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

    // Scoring
    copyScore: number;
    rank: number;
}

interface CachedData {
    traders: ActiveTrader[];
    fetchedAt: number;
}

// ===== Cache =====
// Cache by period
const cache: Record<string, CachedData> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ===== Score Calculation =====

function calculateCopyScore(
    activePositions: number,
    recentTrades: number,
    pnl: number,
    winRate: number,
    periodMultiplier: number = 1
): number {
    // Active Positions: 25 points max (must have positions to score)
    const positionScore = activePositions > 0 ? 25 : 0;

    // Recent Trades: 25 points max
    const tradeScore = Math.min(25, (recentTrades / 5) * 25);

    // PnL: 30 points (profitable in period)
    const pnlScore = pnl > 0 ? 30 : 0;

    // Win Rate: 20 points max
    const winRateScore = winRate * 20;

    return Math.round(positionScore + tradeScore + pnlScore + winRateScore);
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

                // Calculate win rate from positions
                const profitablePositions = positions.filter(p => (p.cashPnl || 0) > 0);
                const winRate = positions.length > 0
                    ? profitablePositions.length / positions.length
                    : 0;

                // Get last trade time
                const lastTradeTime = periodTrades.length > 0
                    ? periodTrades[0].timestamp
                    : 0;

                // If asking for 15d or 90d, we might need to rely on the 'MONTH' or 'ALL' PnL returned by leaderboard
                // as exact 15d PnL isn't easily queryable without full history.
                // However, the Leaderboard 'WEEK'/'MONTH'/'ALL' return that specific PnL.
                // For 15d, using MONTH PnL is "close enough" for candidate sorting, 
                // but ideally we'd filter trades. For MVP, we use the leaderboard's PnL value.
                // Caveat: For '15d', we are identifying traders who are top of 'MONTH' list, so their PnL is 30d PnL.
                // We should probably denote if it's strictly matching.
                // For this implementation, we will use the returned PnL as the display PnL for simplicity/performance.

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
        (t.recentTrades >= 1 || period === '90d') // Relax trade count for longer periods? Or keep strict? Keeping >=1 for activity.
    );

    // Step 4: Calculate copy scores
    const scoredTraders = validTraders.map(trader => ({
        ...trader,
        copyScore: calculateCopyScore(
            trader.activePositions,
            trader.recentTrades,
            trader.pnl,
            trader.winRate
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
    const period = (searchParams.get('period') || '7d') as Period;
    const forceRefresh = searchParams.get('refresh') === 'true';

    try {
        const now = Date.now();
        const cacheKey = `${period}-${limit}`;
        const cached = cache[cacheKey];

        // Check cache validity
        if (!forceRefresh && cached && (now - cached.fetchedAt) < CACHE_TTL) {
            return NextResponse.json({
                traders: cached.traders,
                cached: true,
                cachedAt: new Date(cached.fetchedAt).toISOString(),
                ttlRemaining: Math.round((CACHE_TTL - (now - cached.fetchedAt)) / 1000),
                algorithm: 'active-traders-v2-period',
            });
        }

        // Fetch fresh data
        console.log(`[ActiveTraders] Fetching fresh data for period: ${period}...`);
        const traders = await fetchActiveTraders(Math.max(limit, 20), period);

        // Update cache
        cache[cacheKey] = {
            traders,
            fetchedAt: now,
        };

        console.log(`[ActiveTraders] Found ${traders.length} active traders for ${period}`);

        return NextResponse.json({
            traders: traders.slice(0, limit),
            cached: false,
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

