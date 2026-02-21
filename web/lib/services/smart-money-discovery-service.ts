import { polyClient } from '@/lib/polymarket';
import { createTTLCache } from '@/lib/server-cache';
import { calculateScientificScore, Trade } from './trader-scoring-service';
import { fetchTraderActivities, resolveActivityMaxItems } from './trader-activity-service';

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
    reconstructionConfidence: number;
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
const CANDIDATE_EVAL_MULTIPLIER = 4;
const MIN_CANDIDATES_TO_EVAL = 30;
const MAX_CANDIDATES_TO_EVAL = 45;
const MIN_RECENT_TRADES = 3;
const MIN_ACTIVE_POSITIONS = 1;
const MIN_SCORE = 55;
const MIN_COPY_FRIENDLINESS = 45;
const MAX_DRAWDOWN = 55;
const MIN_PROFIT_FACTOR = 1.05;
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
    asset?: string;
    conditionId?: string;
    tokenId?: string;
};

type TradeWithToken = Trade & {
    tokenKey: string;
};

const leaderboardCache = createTTLCache<LeaderboardSnapshot>();
const traderDetailCache = createTTLCache<DiscoveredSmartMoneyTrader | null>();
const FIFO_WARMUP_DAYS = clamp(
    Number(process.env.SMART_MONEY_FIFO_WARMUP_DAYS || '60'),
    0,
    180
);
const DEFAULT_DISCOVERY_ACTIVITY_MAX_ITEMS = resolveActivityMaxItems(
    DISCOVERY_LOOKBACK_DAYS + FIFO_WARMUP_DAYS
);
const ACTIVITY_MAX_ITEMS = clamp(
    Number(process.env.SMART_MONEY_ACTIVITY_MAX_ITEMS || String(DEFAULT_DISCOVERY_ACTIVITY_MAX_ITEMS)),
    500,
    10000
);
const MIN_RECONSTRUCTION_CONFIDENCE = clamp(
    Number(process.env.SMART_MONEY_MIN_RECON_CONFIDENCE || '0.35'),
    0,
    1
);
const EPSILON = 1e-9;

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

function convertActivitiesToTrades(activities: ActivityLike[]): TradeWithToken[] {
    return activities
        .filter((a) => a.type === 'TRADE' && a.side && a.size && a.price)
        .map((a) => {
            const size = Number(a.size ?? 0);
            const price = Number(a.price ?? 0);
            const usdcValue = Number(a.usdcSize ?? (size * price));
            const tokenKey = String(a.asset || a.tokenId || a.conditionId || 'unknown');

            return {
                timestamp: normalizeTimestampSeconds(Number(a.timestamp)),
                side: a.side as 'BUY' | 'SELL',
                size,
                price,
                value: usdcValue,
                pnl: undefined,
                marketId: a.conditionId || a.tokenId || undefined,
                tokenKey,
            };
        });
}

function reconstructTradesWithFifoPnl(
    trades: TradeWithToken[],
    periodStartSec: number
): { periodTrades: Trade[]; reconstructionConfidence: number } {
    const lotsByToken = new Map<string, Array<{ remaining: number; costPerShare: number }>>();
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);

    let totalSellSizeInPeriod = 0;
    let matchedSellSizeInPeriod = 0;
    const periodTrades: Trade[] = [];

    for (const trade of sortedTrades) {
        const isInPeriod = trade.timestamp >= periodStartSec;
        const effectivePrice = trade.size > EPSILON ? trade.value / trade.size : trade.price;
        const lots = lotsByToken.get(trade.tokenKey) || [];

        if (trade.side === 'BUY') {
            lots.push({
                remaining: trade.size,
                costPerShare: effectivePrice,
            });
            lotsByToken.set(trade.tokenKey, lots);
            if (isInPeriod) {
                periodTrades.push({
                    ...trade,
                    pnl: undefined,
                });
            }
            continue;
        }

        // SELL path: match with FIFO BUY lots to reconstruct realized PnL.
        let remainingToMatch = trade.size;
        let matchedSize = 0;
        let realizedPnl = 0;

        while (remainingToMatch > EPSILON && lots.length > 0) {
            const lot = lots[0];
            const consumed = Math.min(lot.remaining, remainingToMatch);
            realizedPnl += consumed * (effectivePrice - lot.costPerShare);
            lot.remaining -= consumed;
            remainingToMatch -= consumed;
            matchedSize += consumed;

            if (lot.remaining <= EPSILON) {
                lots.shift();
            }
        }
        lotsByToken.set(trade.tokenKey, lots);

        if (isInPeriod) {
            totalSellSizeInPeriod += trade.size;
            matchedSellSizeInPeriod += matchedSize;

            // If a sell is only partially matchable, only matched notional contributes to scored close-trade metrics.
            const scoredValue = matchedSize > EPSILON ? matchedSize * effectivePrice : trade.value;
            periodTrades.push({
                ...trade,
                value: scoredValue,
                pnl: matchedSize > EPSILON ? realizedPnl : undefined,
            });
        }
    }

    const reconstructionConfidence =
        totalSellSizeInPeriod > EPSILON
            ? clamp(matchedSellSizeInPeriod / totalSellSizeInPeriod, 0, 1)
            : 1;

    return { periodTrades, reconstructionConfidence };
}

async function fetchActivityWindow(address: string, startSec: number): Promise<ActivityLike[]> {
    const activities = await fetchTraderActivities(address, {
        startSec,
        maxItems: ACTIVITY_MAX_ITEMS,
        type: 'TRADE',
    });
    return activities as ActivityLike[];
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

function computeCandidatePriority(candidate: Candidate): number {
    const recentPnl = computeRecentMetric(candidate.weekPnl, candidate.monthPnl);
    const recentVolume = computeRecentMetric(candidate.weekVolume, candidate.monthVolume);
    const pnlScore = normalizeLogScore(recentPnl, 1_000, 2_000_000);
    const volumeScore = normalizeLogScore(recentVolume, 10_000, 20_000_000);
    return pnlScore * 0.7 + volumeScore * 0.3;
}

function calculateFinalScore(input: {
    scientificScore: number;
    recentPnl: number;
    recentVolume: number;
    maxDrawdown: number;
    tradeCount: number;
    dataQuality: 'full' | 'limited' | 'insufficient';
}): number {
    const pnlScore = normalizeLogScore(input.recentPnl, 1_000, 2_000_000);
    const volumeScore = normalizeLogScore(input.recentVolume, 10_000, 20_000_000);
    const drawdownStability = 100 - clamp(input.maxDrawdown, 0, 100);
    const confidence = clamp(Math.sqrt(Math.max(input.tradeCount, 0) / 30), 0.35, 1);

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

    return clamp(Math.round(weighted * confidence), 0, 100);
}

async function evaluateCandidate(candidate: Candidate): Promise<DiscoveredSmartMoneyTrader | null> {
    const periodStartSec = Math.floor(Date.now() / 1000) - DISCOVERY_LOOKBACK_DAYS * 24 * 60 * 60;
    const warmupStartSec = periodStartSec - FIFO_WARMUP_DAYS * 24 * 60 * 60;
    const cacheKey = `smart-money:detail:${candidate.address}:${periodStartSec}`;

    const cached = traderDetailCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    try {
        const [positions, activities] = await Promise.all([
            polyClient.dataApi.getPositions(candidate.address, { limit: 100 }),
            fetchActivityWindow(candidate.address, warmupStartSec),
        ]);

        const periodTradeActivities = activities.filter(
            (activity) =>
                activity.type === 'TRADE' &&
                normalizeTimestampSeconds(Number(activity.timestamp)) >= periodStartSec
        );

        const allTrades = convertActivitiesToTrades(activities);
        const recentPnl = computeRecentMetric(candidate.weekPnl, candidate.monthPnl);
        const recentVolume = computeRecentMetric(candidate.weekVolume, candidate.monthVolume);
        const { periodTrades, reconstructionConfidence } = reconstructTradesWithFifoPnl(allTrades, periodStartSec);
        const metrics = calculateScientificScore(periodTrades, { periodDays: DISCOVERY_LOOKBACK_DAYS });

        if (
            positions.length < MIN_ACTIVE_POSITIONS ||
            periodTradeActivities.length < MIN_RECENT_TRADES ||
            metrics.dataQuality === 'insufficient' ||
            recentPnl <= 0 ||
            reconstructionConfidence < MIN_RECONSTRUCTION_CONFIDENCE
        ) {
            traderDetailCache.set(cacheKey, null, TRADER_DETAIL_TTL_MS);
            return null;
        }

        const score = calculateFinalScore({
            scientificScore: metrics.scientificScore,
            recentPnl,
            recentVolume,
            maxDrawdown: metrics.maxDrawdown,
            tradeCount: periodTradeActivities.length,
            dataQuality: metrics.dataQuality,
        });

        if (
            score < MIN_SCORE ||
            metrics.copyFriendliness < MIN_COPY_FRIENDLINESS ||
            metrics.maxDrawdown > MAX_DRAWDOWN ||
            metrics.profitFactor < MIN_PROFIT_FACTOR
        ) {
            traderDetailCache.set(cacheKey, null, TRADER_DETAIL_TTL_MS);
            return null;
        }

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
            recentTrades: periodTradeActivities.length,
            activePositions: positions.length,
            reconstructionConfidence: Math.round(reconstructionConfidence * 1000) / 1000,
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
    const evalLimit = clamp(
        limit * CANDIDATE_EVAL_MULTIPLIER,
        MIN_CANDIDATES_TO_EVAL,
        MAX_CANDIDATES_TO_EVAL
    );
    const prioritizedCandidates = [...candidates]
        .sort((a, b) => computeCandidatePriority(b) - computeCandidatePriority(a))
        .slice(0, evalLimit);

    const results: Array<DiscoveredSmartMoneyTrader | null> = [];
    const batchSize = 5;

    for (let i = 0; i < prioritizedCandidates.length; i += batchSize) {
        const batch = prioritizedCandidates.slice(i, i + batchSize);
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
