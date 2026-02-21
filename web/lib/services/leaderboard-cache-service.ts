/**
 * Leaderboard Cache Service
 * 
 * Manages caching of trader leaderboard data in the database.
 * Used by background scripts to update cache and by API routes to read cached data.
 */

import type { Prisma } from '@prisma/client';
import { prisma, isDatabaseEnabled } from '../prisma';
import { polyClient } from '@/lib/polymarket';
import {
    calculateScientificScore,
    Trade,
} from './trader-scoring-service';
import { discoverSmartMoneyTraders } from './smart-money-discovery-service';

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
type ActivityLike = {
    type?: string;
    side?: 'BUY' | 'SELL';
    size?: number;
    price?: number;
    usdcSize?: number;
    timestamp?: number;
};

function normalizeTimestampSeconds(timestamp: number): number {
    if (!Number.isFinite(timestamp)) return 0;
    return timestamp > 1e12 ? Math.floor(timestamp / 1000) : Math.floor(timestamp);
}

function convertActivitiesToTrades(activities: ActivityLike[]): Trade[] {
    return activities
        .filter(a => a.type === 'TRADE' && a.side && a.size && a.price)
        .map(a => {
            const size = Number(a.size ?? 0);
            const price = Number(a.price ?? 0);
            const usdcValue = Number(a.usdcSize ?? (size * price));

            return {
                timestamp: normalizeTimestampSeconds(Number(a.timestamp)),
                side: a.side as 'BUY' | 'SELL',
                size,
                price,
                value: usdcValue,
                pnl: undefined,
            };
        });
}

function enrichTradesWithTotalPnL(trades: Trade[], totalPnL: number): Trade[] {
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

const dbEnabled = isDatabaseEnabled;
let dbWarningLogged = false;

function ensureDatabaseEnabled(action: string): boolean {
    if (dbEnabled) return true;
    if (!dbWarningLogged) {
        console.warn(`[LeaderboardCache] Skipping ${action} because DATABASE_URL is missing or invalid.`);
        dbWarningLogged = true;
    }
    return false;
}

/**
 * Update leaderboard cache for a specific period
 */
export async function updateLeaderboardCache(
    period: Period,
    limit: number = 20
): Promise<{ success: boolean; traderCount: number; error?: string }> {
    if (!ensureDatabaseEnabled('leaderboard cache update')) {
        return { success: false, traderCount: 0, error: 'Database not configured' };
    }
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
        // Fetch larger pool to ensure we have enough active traders after filtering
        const leaderboard = await polyClient.dataApi.getLeaderboard({
            timePeriod,
            orderBy: 'PNL',
            limit: 200, // Increased from 50 to 200
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

                    const periodTrades = activities.filter(
                        a => a.type === 'TRADE' && normalizeTimestampSeconds(Number(a.timestamp)) >= startTime
                    );

                    const profitablePositions = positions.filter(p => (p.cashPnl || 0) > 0);
                    const winRate = positions.length > 0
                        ? profitablePositions.length / positions.length
                        : 0;

                    const lastTradeTime = periodTrades.length > 0
                        ? periodTrades[0].timestamp
                        : 0;

                    const trades = convertActivitiesToTrades(activities);
                    const enrichedTrades = enrichTradesWithTotalPnL(trades, trader.pnl || 0);

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
                traderData: trader as unknown as Prisma.InputJsonValue,
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
    if (!ensureDatabaseEnabled('leaderboard cache read')) return null;
    try {
        const cached = await prisma.cachedTraderLeaderboard.findMany({
            where: { period },
            orderBy: { rank: 'asc' },
            take: limit,
        });

        if (cached.length === 0) {
            return null;
        }

        return cached.map(entry => entry.traderData as unknown as CachedTrader);
    } catch (error) {
        console.error(`[LeaderboardCache] Failed to read cache for ${period}:`, error);
        return null;
    }
}

/**
 * Get cache metadata for a period
 */
export async function getCacheMetadata(period: Period): Promise<CacheMetadata | null> {
    if (!ensureDatabaseEnabled('leaderboard cache metadata')) return null;
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
    if (!ensureDatabaseEnabled('smart money cache update')) {
        return { success: false, traderCount: 0, error: 'Database not configured' };
    }
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

        const allSmartMoney = await discoverSmartMoneyTraders(limit);
        const ITEMS_PER_PAGE = 20;

        await prisma.cachedSmartMoney.deleteMany({});

        if (allSmartMoney.length > 0) {
            await prisma.cachedSmartMoney.createMany({
                data: allSmartMoney.map((trader, index) => ({
                    page: Math.floor(index / ITEMS_PER_PAGE) + 1,
                    rank: index + 1,
                    traderData: trader as unknown as Prisma.InputJsonValue,
                })),
            });
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
): Promise<unknown[] | null> {
    if (!ensureDatabaseEnabled('smart money cache read')) return null;
    try {
        const skip = (page - 1) * limit;
        const cached = await prisma.cachedSmartMoney.findMany({
            orderBy: { rank: 'asc' },
            skip,
            take: limit,
        });

        if (cached.length === 0) {
            return null;
        }

        return cached.map(entry => entry.traderData as unknown);
    } catch (error) {
        console.error(`[SmartMoneyCache] Failed to read cache for page ${page}:`, error);
        return null;
    }
}

/**
 * Get Smart Money cache metadata
 */
export async function getSmartMoneyCacheMetadata(): Promise<SmartMoneyCacheMetadata | null> {
    if (!ensureDatabaseEnabled('smart money cache metadata')) return null;
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
