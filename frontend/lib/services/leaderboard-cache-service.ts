/**
 * Leaderboard Cache Service
 * 
 * Manages caching of trader leaderboard data in the database.
 * Used by background scripts to update cache and by API routes to read cached data.
 */

import { prisma } from '../prisma';
import { polyClient } from '@/lib/polymarket';
import {
    calculateScientificScore,
    Trade,
} from './trader-scoring-service';

// Type definitions matching /api/traders/active
export interface CachedTrader {
    address: string;
    name: string | null;
    profileImage?: string;
    activePositions: number;
    recentTrades: number;
    lastTradeTime: number;
    pnl: number;
    volume: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    volumeWeightedWinRate: number;
    sharpeRatio: number;
    copyFriendliness: number;
    dataQuality: 'full' | 'limited' | 'insufficient';
    copyScore: number;
    rank: number;
}

export interface CacheMetadata {
    period: string;
    lastUpdateAt: Date;
    status: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS';
    traderCount: number | null;
    errorMessage: string | null;
}

export interface SmartMoneyCacheMetadata {
    lastUpdateAt: Date;
    status: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS';
    traderCount: number | null;
    errorMessage: string | null;
}

// Helper functions from /api/traders/active
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
    const totalPnL = positions.reduce((sum, p) => sum + (p.cashPnl || 0), 0);
    const sellTrades = trades.filter(t => t.side === 'SELL');

    if (sellTrades.length === 0) return trades;

    const pnlPerTrade = totalPnL / sellTrades.length;

    return trades.map(t => {
        if (t.side === 'SELL') {
            return { ...t, pnl: pnlPerTrade };
        }
        return t;
    });
}

export type Period = '7d' | '15d' | '30d' | '90d';

function mapPeriodToSdk(period: Period): 'WEEK' | 'MONTH' | 'ALL' {
    switch (period) {
        case '7d': return 'WEEK';
        case '15d': return 'MONTH';
        case '30d': return 'MONTH';
        case '90d': return 'ALL';
        default: return 'WEEK';
    }
}

/**
 * Update leaderboard cache for a specific period
 */
export async function updateLeaderboardCache(
    period: Period,
    limit: number = 20
): Promise<{ success: boolean; traderCount: number; error?: string }> {
    console.log(`[LeaderboardCache] Updating cache for period: ${period}, limit: ${limit}`);

    try {
        // Mark update as in progress
        await prisma.leaderboardCacheMeta.upsert({
            where: { period },
            create: {
                period,
                lastUpdateAt: new Date(),
                status: 'IN_PROGRESS',
                traderCount: null,
                errorMessage: null,
            },
            update: {
                status: 'IN_PROGRESS',
                errorMessage: null,
            },
        });

        // Fetch trader data using existing logic
        const timePeriod = mapPeriodToSdk(period);
        const leaderboard = await polyClient.dataApi.getLeaderboard({
            timePeriod,
            orderBy: 'PNL',
            limit: 50,
        });

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

                    const periodTrades = activities.filter(a => a.type === 'TRADE' && a.timestamp >= startTime);

                    const profitablePositions = positions.filter(p => (p.cashPnl || 0) > 0);
                    const winRate = positions.length > 0
                        ? profitablePositions.length / positions.length
                        : 0;

                    const lastTradeTime = periodTrades.length > 0
                        ? periodTrades[0].timestamp
                        : 0;

                    const trades = convertActivitiesToTrades(activities);
                    const enrichedTrades = enrichTradesWithPositionPnL(trades, positions);

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
                        profitFactor: metrics.profitFactor,
                        maxDrawdown: metrics.maxDrawdown,
                        volumeWeightedWinRate: metrics.volumeWeightedWinRate,
                        sharpeRatio: metrics.sharpeRatio,
                        copyFriendliness: metrics.copyFriendliness,
                        dataQuality: metrics.dataQuality,
                        copyScore: metrics.scientificScore,
                        rank: 0,
                    };
                } catch (error) {
                    console.error(`[LeaderboardCache] Failed to fetch data for ${trader.address}:`, error);
                    return null;
                }
            })
        );

        // Filter and rank
        const validTraders = enrichedTraders.filter((t): t is NonNullable<typeof t> =>
            t !== null &&
            t.activePositions > 0 &&
            (t.recentTrades >= 1 || period === '90d')
        );

        const ranked = validTraders
            .sort((a, b) => b.copyScore - a.copyScore)
            .slice(0, limit)
            .map((trader, index) => ({
                ...trader,
                rank: index + 1,
            }));

        // Clear old cache entries for this period
        await prisma.cachedTraderLeaderboard.deleteMany({
            where: { period },
        });

        // Insert new cache entries
        await prisma.cachedTraderLeaderboard.createMany({
            data: ranked.map(trader => ({
                period,
                rank: trader.rank,
                traderData: trader as any,
            })),
        });

        // Update metadata
        await prisma.leaderboardCacheMeta.update({
            where: { period },
            data: {
                lastUpdateAt: new Date(),
                status: 'SUCCESS',
                traderCount: ranked.length,
                errorMessage: null,
            },
        });

        console.log(`[LeaderboardCache] Successfully cached ${ranked.length} traders for ${period}`);

        return { success: true, traderCount: ranked.length };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[LeaderboardCache] Update failed for ${period}:`, errorMessage);

        // Update metadata with failure
        await prisma.leaderboardCacheMeta.upsert({
            where: { period },
            create: {
                period,
                lastUpdateAt: new Date(),
                status: 'FAILED',
                traderCount: null,
                errorMessage,
            },
            update: {
                status: 'FAILED',
                errorMessage,
            },
        });

        return { success: false, traderCount: 0, error: errorMessage };
    }
}

/**
 * Get leaderboard data from cache
 */
export async function getLeaderboardFromCache(
    period: Period,
    limit: number = 10
): Promise<CachedTrader[] | null> {
    try {
        const cached = await prisma.cachedTraderLeaderboard.findMany({
            where: { period },
            orderBy: { rank: 'asc' },
            take: limit,
        });

        if (cached.length === 0) {
            return null;
        }

        return cached.map(entry => entry.traderData as any as CachedTrader);
    } catch (error) {
        console.error(`[LeaderboardCache] Failed to read cache for ${period}:`, error);
        return null;
    }
}

/**
 * Get cache metadata for a period
 */
export async function getCacheMetadata(period: Period): Promise<CacheMetadata | null> {
    try {
        const meta = await prisma.leaderboardCacheMeta.findUnique({
            where: { period },
        });

        if (!meta) return null;

        return {
            period: meta.period,
            lastUpdateAt: meta.lastUpdateAt,
            status: meta.status as 'SUCCESS' | 'FAILED' | 'IN_PROGRESS',
            traderCount: meta.traderCount,
            errorMessage: meta.errorMessage,
        };
    } catch (error) {
        console.error(`[LeaderboardCache] Failed to get metadata for ${period}:`, error);
        return null;
    }
}

/**
 * Check if cache is fresh (within TTL)
 */
export function isCacheFresh(lastUpdateAt: Date, ttlMinutes: number = 10): boolean {
    const ageMs = Date.now() - lastUpdateAt.getTime();
    const ageMinutes = ageMs / (60 * 1000);
    return ageMinutes < ttlMinutes;
}

/**
 * Update Smart Money cache (Top Performers)
 */
export async function updateSmartMoneyCache(
    limit: number = 100
): Promise<{ success: boolean; traderCount: number; error?: string }> {
    console.log(`[SmartMoneyCache] Updating cache, limit: ${limit}`);

    try {
        // Mark update as in progress (only one row for smart money meta)
        await prisma.smartMoneyCacheMeta.upsert({
            where: { id: 'singleton' },
            create: {
                id: 'singleton',
                lastUpdateAt: new Date(),
                status: 'IN_PROGRESS',
                traderCount: null,
                errorMessage: null,
            },
            update: {
                status: 'IN_PROGRESS',
                errorMessage: null,
            },
        });

        // SmartMoneyService uses a page-based approach to build its cache.
        // We will fetch multiple pages to populate our database cache.
        const ITEMS_PER_PAGE = 20;
        const totalPages = Math.ceil(limit / ITEMS_PER_PAGE);
        let allSmartMoney: any[] = [];

        for (let page = 1; page <= totalPages; page++) {
            console.log(`[SmartMoneyCache] Fetching page ${page}...`);
            // We use the SDK directly to fetch smart money list
            const smartMoneyList = await polyClient.smartMoney.getSmartMoneyList({ page, limit: ITEMS_PER_PAGE });

            if (smartMoneyList && smartMoneyList.length > 0) {
                // Save this page to database
                await prisma.cachedSmartMoney.deleteMany({
                    where: { page },
                });

                await prisma.cachedSmartMoney.createMany({
                    data: smartMoneyList.map((trader, index) => ({
                        page,
                        rank: (page - 1) * ITEMS_PER_PAGE + index + 1,
                        traderData: trader as any,
                    })),
                });

                allSmartMoney = [...allSmartMoney, ...smartMoneyList];
            } else {
                console.log(`[SmartMoneyCache] No more traders found at page ${page}`);
                break;
            }
        }

        // Update metadata
        await prisma.smartMoneyCacheMeta.update({
            where: { id: 'singleton' },
            data: {
                lastUpdateAt: new Date(),
                status: 'SUCCESS',
                traderCount: allSmartMoney.length,
                errorMessage: null,
            },
        });

        console.log(`[SmartMoneyCache] Successfully cached ${allSmartMoney.length} smart money traders`);
        return { success: true, traderCount: allSmartMoney.length };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[SmartMoneyCache] Update failed:`, errorMessage);

        await prisma.smartMoneyCacheMeta.upsert({
            where: { id: 'singleton' },
            create: {
                id: 'singleton',
                lastUpdateAt: new Date(),
                status: 'FAILED',
                errorMessage,
            },
            update: {
                status: 'FAILED',
                errorMessage,
            },
        });

        return { success: false, traderCount: 0, error: errorMessage };
    }
}

/**
 * Get Smart Money data from cache
 */
export async function getSmartMoneyFromCache(
    page: number = 1,
    limit: number = 20
): Promise<any[] | null> {
    try {
        const cached = await prisma.cachedSmartMoney.findMany({
            where: { page },
            orderBy: { rank: 'asc' },
            take: limit,
        });

        if (cached.length === 0) {
            return null;
        }

        return cached.map(entry => entry.traderData as any);
    } catch (error) {
        console.error(`[SmartMoneyCache] Failed to read cache for page ${page}:`, error);
        return null;
    }
}

/**
 * Get Smart Money cache metadata
 */
export async function getSmartMoneyCacheMetadata(): Promise<SmartMoneyCacheMetadata | null> {
    try {
        const meta = await prisma.smartMoneyCacheMeta.findUnique({
            where: { id: 'singleton' },
        });

        if (!meta) return null;

        return {
            lastUpdateAt: meta.lastUpdateAt,
            status: meta.status as 'SUCCESS' | 'FAILED' | 'IN_PROGRESS',
            traderCount: meta.traderCount,
            errorMessage: meta.errorMessage,
        };
    } catch (error) {
        console.error(`[SmartMoneyCache] Failed to get metadata:`, error);
        return null;
    }
}
