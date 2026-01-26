import { NextRequest, NextResponse } from 'next/server';
import { polyClient } from '@/lib/polymarket';
import { prisma } from '@/lib/prisma';

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
 * Attempt to get profile data from local DB cache
 */
async function getFromCacheFallback(address: string): Promise<TraderProfileData | null> {
    try {
        // 1. Try Smart Money Cache (High Quality Data)
        // We have to scan entries because we store JSON. 
        // Ideally we should have indexed address, but for now we search.
        // Actually, CachedSmartMoney stores 'traderData' JSON. We can use Prisma raw query or just fetch all for the current page if we knew it.
        // Since we don't know the rank/page, we can try to search by path inside JSON if supported, or just return null for now if too expensive.
        // Prisma JSON filtering:
        const smartMoney = await prisma.cachedSmartMoney.findFirst({
            where: {
                traderData: {
                    path: ['address'],
                    equals: address
                }
            }
        });

        if (smartMoney) {
            const data = smartMoney.traderData as any;
            return {
                address: data.address,
                username: data.name || `User ${data.address.slice(0, 6)}`,
                pnl: data.pnl,
                volume: data.volume,
                score: data.score,
                rank: data.rank,
                winRate: data.winRate || 0,
                totalTrades: data.tradeCount || 0,
                positionCount: 0, // Not in cache
                lastActive: new Date().toISOString(),
                positions: [],
                recentTrades: []
            };
        }

        // 2. Try Leaderboard Cache
        const leaderboard = await prisma.cachedTraderLeaderboard.findFirst({
            where: {
                traderData: {
                    path: ['address'],
                    equals: address
                }
            }
        });

        if (leaderboard) {
            const data = leaderboard.traderData as any;
            return {
                address: data.address,
                username: data.name || `User ${data.address.slice(0, 6)}`,
                pnl: data.pnl, // Might be 'totalPnL' or 'pnl' depending on interface
                volume: data.volume,
                score: 0, // Calc on fly
                rank: data.rank,
                winRate: 0,
                totalTrades: 0,
                positionCount: 0,
                lastActive: new Date().toISOString(),
                positions: [],
                recentTrades: []
            };
        }

    } catch (e) {
        console.warn('[TraderProfile] Fallback lookup failed', e);
    }
    return null;
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
        // We use allSettled to prevent one failure from killing the request
        const [profileResult, positionsResult, activityResult] = await Promise.allSettled([
            polyClient.wallets.getWalletProfile(address),
            polyClient.wallets.getWalletPositions(address),
            polyClient.wallets.getWalletActivity(address, 20),
        ]);

        // Check if primary profile fetch failed completely
        const primaryFetchFailed = profileResult.status === 'rejected'; // || !profileResult.value

        // Extract profile data (cast to any for flexible property access)
        let profile = profileResult.status === 'fulfilled' ? profileResult.value as unknown as Record<string, unknown> : null;
        let positions = positionsResult.status === 'fulfilled' ? positionsResult.value : [];
        let activity = activityResult.status === 'fulfilled' ? activityResult.value : { activities: [] };

        // Fallback Trigger:
        // If profile is null, or if it looks empty (pnl=0, volume=0) AND we have no positions/activity,
        // then try to hydrate from our DB cache.
        const isEmptyProfile = !profile || (Number(profile.totalPnL || 0) === 0 && Number(profile.volume || 0) === 0 && positions.length === 0);

        if (primaryFetchFailed || isEmptyProfile) {
            console.warn(`[TraderProfile] Live fetch weak/failed for ${address}, attempting DB fallback...`);
            const fallbackProfile = await getFromCacheFallback(normalizedAddress);

            if (fallbackProfile) {
                // Return the fallback immediately, merging any live data we MIGHT have found (e.g. maybe positions worked but profile didn't)
                // For simplicity, just return the fallback structure.

                // Update cache
                profileCache.set(cacheKey, {
                    data: fallbackProfile,
                    timestamp: now,
                });

                return NextResponse.json({
                    profile: fallbackProfile,
                    cached: true,
                    source: 'database_fallback',
                    cachedAt: new Date(now).toISOString(),
                });
            }
        }

        // --- Standard Processing Logic (Only runs if we have decent live data) ---

        // Calculate derived stats
        const trades = activity.activities ? activity.activities.filter(a => a.type === 'TRADE') : [];
        const totalTrades = trades.length;

        // Improved Win Rate Calculation:
        let winningValue = 0;
        let totalValue = 0;
        let hasValidData = false;

        // Method 1: Check positions for PnL
        if (positions && positions.length > 0) {
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
        }

        // Method 2: If no position data, analyze trades
        if (!hasValidData && trades.length > 0) {
            const pnl = typeof profile?.totalPnL === 'number' ? profile.totalPnL : (typeof profile?.pnl === 'number' ? profile.pnl : 0);
            const volume = typeof profile?.volume === 'number' ? profile.volume : 0;

            if (volume > 0 && pnl !== 0) {
                hasValidData = true;
                const profitRatio = pnl / volume;
                const estimatedWinRate = Math.min(80, Math.max(20, 50 + (profitRatio * 200)));
                winningValue = estimatedWinRate;
                totalValue = 100;
            }
        }

        // Win Rate = % of value that is profitable
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
            rank: null,
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
                const timestampMs = t.timestamp > 9999999999 ? t.timestamp : t.timestamp * 1000;
                const tradeDate = new Date(timestampMs);
                const usdcAmount = t.usdcSize || (t.size * t.price);
                return {
                    action: t.side === 'BUY' ? 'Bought' : 'Sold',
                    market: t.title,
                    date: tradeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    time: tradeDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
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

        // Ultimate fallback if even the main logic crashes
        const fallbackProfile = await getFromCacheFallback(normalizedAddress);
        if (fallbackProfile) {
            return NextResponse.json({
                profile: fallbackProfile,
                cached: true,
                source: 'database_fallback_error',
            });
        }

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
