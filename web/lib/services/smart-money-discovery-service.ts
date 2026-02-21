import { polyClient } from '@/lib/polymarket';
import { createTTLCache } from '@/lib/server-cache';
import { calculateScientificScore, Trade } from './trader-scoring-service';

export interface DiscoveredSmartMoneyTrader {
    address: string;
    name: string | null;
    profileImage?: string;
    pnl: number;
    volume: number;
    score: number;
    rank: number;
    profitFactor: number;
    maxDrawdown: number;
    volumeWeightedWinRate: number;
    copyFriendliness: number;
    dataQuality: 'full' | 'limited' | 'insufficient';
    recentTrades: number;
    activePositions: number;
}

type LeaderboardSource = 'WEEK' | 'MONTH';
type LeaderboardSnapshot = Awaited<ReturnType<typeof polyClient.dataApi.getLeaderboard>>;

type Candidate = {
    address: string;
    name: string | null;
    profileImage?: string;
    weekPnl: number;
    weekVolume: number;
    monthPnl: number;
    monthVolume: number;
};

const DISCOVERY_LOOKBACK_DAYS = 30;
const CANDIDATE_LIMIT_PER_SOURCE = 50;
const MIN_RECENT_TRADES = 3;
const MIN_ACTIVE_POSITIONS = 1;
const LEADERBOARD_TTL_MS = 60 * 1000;
const TRADER_DETAIL_TTL_MS = 5 * 60 * 1000;
const TRADER_ERROR_TTL_MS = 30 * 1000;

type ActivityLike = {
    type?: string;
    side?: 'BUY' | 'SELL';
    size?: number;
    price?: number;
    timestamp?: number;
    usdcSize?: number;
    conditionId?: string;
    tokenId?: string;
};

const leaderboardCache = createTTLCache<LeaderboardSnapshot>();
const traderDetailCache = createTTLCache<DiscoveredSmartMoneyTrader | null>();

function normalizeTimestampSeconds(timestamp: number): number {
    if (!Number.isFinite(timestamp)) return 0;
    return timestamp > 1e12 ? Math.floor(timestamp / 1000) : Math.floor(timestamp);
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function normalizeLogScore(value: number, min: number, max: number): number {
    if (value <= 0) return 0;
    const bounded = clamp(value, min, max);
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const score = ((Math.log10(bounded) - logMin) / (logMax - logMin)) * 100;
    return clamp(score, 0, 100);
}

function convertActivitiesToTrades(activities: ActivityLike[]): Trade[] {
    return activities
        .filter((a) => a.type === 'TRADE' && a.side && a.size && a.price)
        .map((a) => ({
            timestamp: normalizeTimestampSeconds(Number(a.timestamp)),
            side: a.side as 'BUY' | 'SELL',
            size: Number(a.size),
            price: Number(a.price),
            value: Number(a.usdcSize || (a.size * a.price)),
            pnl: undefined,
            marketId: a.conditionId || a.tokenId || undefined,
        }));
}

function enrichTradesWithTotalPnL(trades: Trade[], totalPnl: number): Trade[] {
    const sellTrades = trades.filter((t) => t.side === 'SELL');
    if (sellTrades.length === 0) return trades;

    const pnlPerTrade = totalPnl / sellTrades.length;

    return trades.map((t) => {
        if (t.side === 'SELL') {
            return { ...t, pnl: pnlPerTrade };
        }
        return t;
    });
}

async function getLeaderboardBySource(source: LeaderboardSource) {
    const key = `smart-money:leaderboard:${source}`;
    return leaderboardCache.getOrSet(key, LEADERBOARD_TTL_MS, () =>
        polyClient.dataApi.getLeaderboard({
            timePeriod: source,
            orderBy: 'PNL',
            limit: CANDIDATE_LIMIT_PER_SOURCE,
        })
    );
}

async function buildCandidatePool(): Promise<Candidate[]> {
    const [weekBoard, monthBoard] = await Promise.all([
        getLeaderboardBySource('WEEK'),
        getLeaderboardBySource('MONTH'),
    ]);

    const candidateMap = new Map<string, Candidate>();

    for (const entry of weekBoard.entries) {
        const address = entry.address.toLowerCase();
        candidateMap.set(address, {
            address,
            name: entry.userName || null,
            profileImage: entry.profileImage,
            weekPnl: Number(entry.pnl || 0),
            weekVolume: Number(entry.volume || 0),
            monthPnl: 0,
            monthVolume: 0,
        });
    }

    for (const entry of monthBoard.entries) {
        const address = entry.address.toLowerCase();
        const existing = candidateMap.get(address);

        if (existing) {
            existing.monthPnl = Number(entry.pnl || 0);
            existing.monthVolume = Number(entry.volume || 0);
            if (!existing.name && entry.userName) {
                existing.name = entry.userName;
            }
            if (!existing.profileImage && entry.profileImage) {
                existing.profileImage = entry.profileImage;
            }
        } else {
            candidateMap.set(address, {
                address,
                name: entry.userName || null,
                profileImage: entry.profileImage,
                weekPnl: 0,
                weekVolume: 0,
                monthPnl: Number(entry.pnl || 0),
                monthVolume: Number(entry.volume || 0),
            });
        }
    }

    return Array.from(candidateMap.values());
}

function computeRecentMetric(weekValue: number, monthValue: number): number {
    if (weekValue > 0 && monthValue > 0) {
        return monthValue * 0.6 + weekValue * 0.4;
    }
    return Math.max(weekValue, monthValue, 0);
}

function calculateFinalScore(input: {
    scientificScore: number;
    recentPnl: number;
    recentVolume: number;
    maxDrawdown: number;
    dataQuality: 'full' | 'limited' | 'insufficient';
}): number {
    const pnlScore = normalizeLogScore(input.recentPnl, 1_000, 2_000_000);
    const volumeScore = normalizeLogScore(input.recentVolume, 10_000, 20_000_000);
    const drawdownStability = 100 - clamp(input.maxDrawdown, 0, 100);

    const qualityBonus =
        input.dataQuality === 'full'
            ? 8
            : input.dataQuality === 'limited'
                ? 2
                : -15;

    const weighted =
        input.scientificScore * 0.65 +
        pnlScore * 0.2 +
        volumeScore * 0.1 +
        drawdownStability * 0.05 +
        qualityBonus;

    return clamp(Math.round(weighted), 0, 100);
}

async function evaluateCandidate(candidate: Candidate): Promise<DiscoveredSmartMoneyTrader | null> {
    const startTimeSec = Math.floor(Date.now() / 1000) - DISCOVERY_LOOKBACK_DAYS * 24 * 60 * 60;
    const cacheKey = `smart-money:detail:${candidate.address}:${startTimeSec}`;

    const cached = traderDetailCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    try {
        const [positions, activities] = await Promise.all([
            polyClient.dataApi.getPositions(candidate.address, { limit: 100 }),
            polyClient.dataApi.getActivity(candidate.address, {
                limit: 200,
                start: startTimeSec,
            }),
        ]);

        const periodTrades = activities.filter(
            (activity) =>
                activity.type === 'TRADE' &&
                normalizeTimestampSeconds(Number(activity.timestamp)) >= startTimeSec
        );

        const trades = convertActivitiesToTrades(activities);
        const recentPnl = computeRecentMetric(candidate.weekPnl, candidate.monthPnl);
        const recentVolume = computeRecentMetric(candidate.weekVolume, candidate.monthVolume);

        const enrichedTrades = enrichTradesWithTotalPnL(trades, recentPnl);
        const metrics = calculateScientificScore(enrichedTrades, { periodDays: DISCOVERY_LOOKBACK_DAYS });

        if (
            positions.length < MIN_ACTIVE_POSITIONS ||
            periodTrades.length < MIN_RECENT_TRADES ||
            metrics.dataQuality === 'insufficient' ||
            recentPnl <= 0
        ) {
            traderDetailCache.set(cacheKey, null, TRADER_DETAIL_TTL_MS);
            return null;
        }

        const score = calculateFinalScore({
            scientificScore: metrics.scientificScore,
            recentPnl,
            recentVolume,
            maxDrawdown: metrics.maxDrawdown,
            dataQuality: metrics.dataQuality,
        });

        const trader: DiscoveredSmartMoneyTrader = {
            address: candidate.address,
            name: candidate.name,
            profileImage: candidate.profileImage,
            pnl: Math.round(recentPnl),
            volume: Math.round(recentVolume),
            score,
            rank: 0,
            profitFactor: metrics.profitFactor,
            maxDrawdown: metrics.maxDrawdown,
            volumeWeightedWinRate: metrics.volumeWeightedWinRate,
            copyFriendliness: metrics.copyFriendliness,
            dataQuality: metrics.dataQuality,
            recentTrades: periodTrades.length,
            activePositions: positions.length,
        };

        traderDetailCache.set(cacheKey, trader, TRADER_DETAIL_TTL_MS);
        return trader;
    } catch (error) {
        console.error(`[SmartMoneyDiscovery] Candidate evaluation failed: ${candidate.address}`, error);
        traderDetailCache.set(cacheKey, null, TRADER_ERROR_TTL_MS);
        return null;
    }
}

export async function discoverSmartMoneyTraders(limit: number): Promise<DiscoveredSmartMoneyTrader[]> {
    const candidates = await buildCandidatePool();

    const results: Array<DiscoveredSmartMoneyTrader | null> = [];
    const batchSize = 5;

    for (let i = 0; i < candidates.length; i += batchSize) {
        const batch = candidates.slice(i, i + batchSize);
        const evaluated = await Promise.all(batch.map((candidate) => evaluateCandidate(candidate)));
        results.push(...evaluated);
    }

    const ranked = results
        .filter((trader): trader is DiscoveredSmartMoneyTrader => trader !== null)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.pnl !== a.pnl) return b.pnl - a.pnl;
            return b.volume - a.volume;
        })
        .slice(0, limit)
        .map((trader, index) => ({
            ...trader,
            rank: index + 1,
        }));

    return ranked;
}
