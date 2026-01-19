/**
 * Trader Profile API
 * 
 * Cached endpoint for fetching individual trader profile
 * Combines multiple data sources with caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { polyClient } from '@/lib/polymarket';

// Simple in-memory cache
const profileCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

interface TraderProfileData {
    address: string;
    username: string;
    pnl: number;
    volume: number;
    score: number;
    rank: number | null;
    winRate: number;
    totalTrades: number;
    positionCount: number;
    lastActive: string;
    positions: Array<{
        question: string;
        outcome: string;
        pnl: string;
        pnlPositive: boolean;
        size: string;
        conditionId?: string;
    }>;
    recentTrades: Array<{
        action: string;
        market?: string;
        date: string;
        time: string;
        amount: string;
        shares: string;
        price: string;
        type: string;
    }>;
}

/**
 * GET /api/traders/[address]
 * Get cached trader profile with all data
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ address: string }> }
) {
    const { address } = await params;

    if (!address || !address.startsWith('0x')) {
        return NextResponse.json(
            { error: 'Invalid address' },
            { status: 400 }
        );
    }

    const normalizedAddress = address.toLowerCase();
    const cacheKey = `profile:${normalizedAddress}`;
    const now = Date.now();

    // Check cache
    const cached = profileCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
        return NextResponse.json({
            profile: cached.data,
            cached: true,
            cachedAt: new Date(cached.timestamp).toISOString(),
        }, {
            headers: {
                'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
            },
        });
    }

    try {
        // Fetch all data in parallel for speed
        const [profileResult, positionsResult, activityResult] = await Promise.allSettled([
            polyClient.wallets.getWalletProfile(address),
            polyClient.wallets.getWalletPositions(address),
            polyClient.wallets.getWalletActivity(address, 20),
        ]);

        // Extract profile data (cast to any for flexible property access)
        const profile = profileResult.status === 'fulfilled' ? profileResult.value as unknown as Record<string, unknown> : null;
        const positions = positionsResult.status === 'fulfilled' ? positionsResult.value : [];
        const activity = activityResult.status === 'fulfilled' ? activityResult.value : { activities: [] };

        // Calculate derived stats
        const trades = activity.activities.filter(a => a.type === 'TRADE');
        const totalTrades = trades.length;

        // Win Rate: Calculate based on positions with positive PnL
        // A "win" is a position that is currently profitable
        let profitablePositions = 0;
        let totalPositionsWithPnl = 0;

        positions.forEach((pos: { cashPnl?: number }) => {
            if (pos.cashPnl !== undefined && pos.cashPnl !== null) {
                totalPositionsWithPnl++;
                if (pos.cashPnl > 0) {
                    profitablePositions++;
                }
            }
        });

        // Win Rate = % of positions that are profitable
        const winRate = totalPositionsWithPnl > 0
            ? Math.round((profitablePositions / totalPositionsWithPnl) * 100)
            : 0;

        // Type-safe property access with defaults
        const pnl = typeof profile?.totalPnL === 'number' ? profile.totalPnL : (typeof profile?.pnl === 'number' ? profile.pnl : 0);
        const volume = typeof profile?.volume === 'number' ? profile.volume : 0;
        const userName = typeof profile?.userName === 'string' ? profile.userName : null;
        const positionCount = typeof profile?.positionCount === 'number' ? profile.positionCount : positions.length;
        const lastActiveAt = profile?.lastActiveAt instanceof Date ? profile.lastActiveAt : null;

        // Build profile response
        const profileData: TraderProfileData = {
            address: normalizedAddress,
            username: userName || `User ${address.slice(0, 6)}`,
            pnl: pnl,
            volume: volume,
            score: Math.min(100, Math.round((pnl / 100000) * 50 + (volume / 1000000) * 50)),
            rank: null, // Would need leaderboard lookup
            winRate: winRate,
            totalTrades: totalTrades,
            positionCount: positionCount,
            lastActive: lastActiveAt
                ? new Date(lastActiveAt).toISOString()
                : new Date().toISOString(),
            positions: positions.slice(0, 10).map(pos => ({
                question: pos.title || 'Unknown Market',
                outcome: pos.outcome || 'Unknown',
                pnl: (pos.cashPnl || 0) >= 0
                    ? `+$${(pos.cashPnl || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                    : `-$${Math.abs(pos.cashPnl || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                pnlPositive: (pos.cashPnl || 0) >= 0,
                size: `$${(pos.currentValue || (pos.size * pos.avgPrice)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                conditionId: pos.conditionId,
            })),
            recentTrades: trades.slice(0, 10).map(t => {
                // Auto-detect timestamp format: if > 10 digits, it's milliseconds
                const timestampMs = t.timestamp > 9999999999 ? t.timestamp : t.timestamp * 1000;
                const tradeDate = new Date(timestampMs);
                const usdcAmount = t.usdcSize || (t.size * t.price);
                return {
                    action: t.side === 'BUY' ? 'Bought' : 'Sold',
                    market: t.title,
                    date: tradeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    time: tradeDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                    amount: `$${usdcAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                    shares: `${t.size.toLocaleString(undefined, { maximumFractionDigits: 2 })} shares`,
                    price: `$${t.price.toFixed(4)}`,
                    type: t.side.toLowerCase(),
                };
            }),
        };

        // Update cache
        profileCache.set(cacheKey, {
            data: profileData,
            timestamp: now,
        });

        return NextResponse.json({
            profile: profileData,
            cached: false,
            cachedAt: new Date(now).toISOString(),
        }, {
            headers: {
                'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
            },
        });
    } catch (error) {
        console.error('[TraderProfile] Error:', error);

        // Return cached data if available
        if (cached) {
            return NextResponse.json({
                profile: cached.data,
                cached: true,
                stale: true,
                error: 'Failed to refresh, returning stale data',
            });
        }

        return NextResponse.json(
            { error: 'Failed to fetch trader profile' },
            { status: 500 }
        );
    }
}
