/**
 * Top Traders API
 * 
 * Cached endpoint for fetching top traders leaderboard
 * This reduces API calls by caching results for 5 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { polyClient } from '@/lib/polymarket';

// Simple in-memory cache
let cachedTraders: unknown[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/traders/top
 * Get cached top traders list
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const forceRefresh = searchParams.get('refresh') === 'true';

    try {
        const now = Date.now();

        // Check cache validity
        if (!forceRefresh && cachedTraders.length > 0 && (now - lastFetchTime) < CACHE_TTL) {
            return NextResponse.json({
                traders: cachedTraders.slice(0, limit),
                cached: true,
                cachedAt: new Date(lastFetchTime).toISOString(),
                ttlRemaining: Math.round((CACHE_TTL - (now - lastFetchTime)) / 1000),
            }, {
                headers: {
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
                },
            });
        }

        // Fetch fresh data
        // Use getLeaderboard directly for speed (skip profile verification)
        const leaderboardPage = await polyClient.wallets.getLeaderboard(0, Math.max(limit, 20));
        const entries = leaderboardPage.entries;

        // Transform to simpler format for frontend
        const traders = entries
            .filter(trader => trader.pnl > 0) // Only profitable traders
            .slice(0, limit)
            .map((trader, index) => ({
                address: trader.address.toLowerCase(),
                name: trader.userName || null,
                pnl: trader.pnl,
                volume: trader.volume,
                score: Math.min(100, Math.round((trader.pnl / 100000) * 50 + (trader.volume / 1000000) * 50)),
                rank: trader.rank || index + 1,
            }));

        // Update cache
        cachedTraders = traders;
        lastFetchTime = now;

        return NextResponse.json({
            traders,
            cached: false,
            cachedAt: new Date(now).toISOString(),
            ttlRemaining: Math.round(CACHE_TTL / 1000),
        }, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
        });
    } catch (error) {
        console.error('[TopTraders] Error:', error);

        // Return cached data if available, even if stale
        if (cachedTraders.length > 0) {
            return NextResponse.json({
                traders: cachedTraders.slice(0, limit),
                cached: true,
                stale: true,
                error: 'Failed to refresh, returning stale data',
            });
        }

        return NextResponse.json(
            { error: 'Failed to fetch top traders', traders: [] },
            { status: 500 }
        );
    }
}
