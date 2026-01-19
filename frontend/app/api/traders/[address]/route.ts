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

        // Improved Win Rate Calculation:
        // Strategy: Use volume-weighted approach considering multiple sources:
        // 1. Positions with realized PnL (cashPnl defined and != 0)
        // 2. Positions with positive current value vs avg price (for unrealized)
        // 3. Fall back to trade-level analysis if no position PnL available

        let winningValue = 0;
        let totalValue = 0;
        let hasValidData = false;

        // Method 1: Check positions for PnL
        positions.forEach((pos: { cashPnl?: number; size?: number; avgPrice?: number; currentValue?: number }) => {
            const positionValue = pos.currentValue || ((pos.size || 0) * (pos.avgPrice || 0));

            if (pos.cashPnl !== undefined && pos.cashPnl !== null && pos.cashPnl !== 0) {
                // Has realized PnL
                hasValidData = true;
                totalValue += positionValue;
                if (pos.cashPnl > 0) {
                    winningValue += positionValue;
                }
            } else if (pos.currentValue && pos.size && pos.avgPrice) {
                // Calculate unrealized based on current value vs cost basis
                hasValidData = true;
                totalValue += positionValue;
                const costBasis = pos.size * pos.avgPrice;
                if (pos.currentValue > costBasis) {
                    winningValue += positionValue;
                }
            }
        });

        // Method 2: If no position data, analyze trades for profitable patterns
        if (!hasValidData && trades.length > 0) {
            // Heuristic: If total PnL is positive, estimate win rate from PnL/volume ratio
            const pnl = typeof profile?.totalPnL === 'number' ? profile.totalPnL : (typeof profile?.pnl === 'number' ? profile.pnl : 0);
            const volume = typeof profile?.volume === 'number' ? profile.volume : 0;

            if (volume > 0 && pnl !== 0) {
                hasValidData = true;
                // Estimate: If PnL/Volume ratio is positive, estimate win rate
                // This is a rough approximation when detailed position data isn't available
                const profitRatio = pnl / volume;
                // A profitRatio of 0.1 (10% profit on volume) suggests ~55% win rate
                // A profitRatio of 0.2+ suggests ~65%+ win rate
                const estimatedWinRate = Math.min(80, Math.max(20, 50 + (profitRatio * 200)));
                winningValue = estimatedWinRate;
                totalValue = 100;
            }
        }

        // Win Rate = % of value that is profitable (volume-weighted)
        const winRate = hasValidData && totalValue > 0
            ? Math.round((winningValue / totalValue) * 100)
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
