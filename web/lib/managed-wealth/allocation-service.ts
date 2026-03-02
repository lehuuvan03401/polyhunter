import type { StrategyProfile } from '@prisma/client';
import type { CachedTrader } from '../services/leaderboard-cache-service';
import type { DiscoveredSmartMoneyTrader } from '../services/smart-money-discovery-service';

type TraderDataQuality = 'full' | 'limited' | 'insufficient';
type AllocationSource = 'LEADERBOARD' | 'SMART_MONEY' | 'PRODUCT_TEMPLATE';

type StrategyRules = {
    minScore: number;
    minCopyFriendliness: number;
    maxDrawdownRatio: number;
    minRecentTrades: number;
};

type SourceSnapshot = {
    source: AllocationSource;
    sourceScore: number;
    copyFriendliness: number;
    drawdownRatio: number;
    recentTrades: number;
    activePositions: number;
    dataQuality: TraderDataQuality;
};

type MergedCandidate = {
    address: string;
    name: string | null;
    profileImage?: string;
    snapshots: SourceSnapshot[];
};

export type ManagedAllocationCandidate = {
    address: string;
    name: string | null;
    profileImage?: string;
    compositeScore: number;
    weightScore: number;
    scoreSnapshot: {
        strategyProfile: StrategyProfile;
        baseScore: number;
        drawdownRatio: number;
        copyFriendliness: number;
        dataQualityWeight: number;
        activityWeight: number;
        sourceBonus: number;
        sourceCount: number;
        sourceSnapshots: SourceSnapshot[];
    };
};

export type ManagedAllocationTarget = {
    address: string;
    name: string | null;
    profileImage?: string;
    weight: number;
    weightScore: number;
    compositeScore: number;
    scoreSnapshot: ManagedAllocationCandidate['scoreSnapshot'];
};

export type ManagedAllocationSnapshot = {
    seed: string;
    version: number;
    reason: string | null;
    scoreSnapshot: {
        generatedAt: string;
        strategyProfile: StrategyProfile;
        candidateCount: number;
        candidates: Array<{
            address: string;
            compositeScore: number;
            sourceCount: number;
            baseScore: number;
            drawdownRatio: number;
            copyFriendliness: number;
        }>;
    };
    selectedWeights: Array<{
        address: string;
        weight: number;
        weightScore: number;
        compositeScore: number;
        sourceCount: number;
    }>;
    targets: ManagedAllocationTarget[];
};

const STRATEGY_RULES: Record<StrategyProfile, StrategyRules> = {
    CONSERVATIVE: {
        minScore: 65,
        minCopyFriendliness: 60,
        maxDrawdownRatio: 0.22,
        minRecentTrades: 4,
    },
    MODERATE: {
        minScore: 55,
        minCopyFriendliness: 50,
        maxDrawdownRatio: 0.38,
        minRecentTrades: 3,
    },
    AGGRESSIVE: {
        minScore: 45,
        minCopyFriendliness: 40,
        maxDrawdownRatio: 0.6,
        minRecentTrades: 1,
    },
};

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function normalizeScore100(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (value <= 1) return clamp(value * 100, 0, 100);
    return clamp(value, 0, 100);
}

function normalizeRatio(value: number): number {
    if (!Number.isFinite(value)) return 1;
    if (value <= 1) return clamp(value, 0, 1);
    return clamp(value / 100, 0, 1);
}

function dataQualityWeight(dataQuality: TraderDataQuality): number {
    if (dataQuality === 'full') return 1;
    if (dataQuality === 'limited') return 0.88;
    return 0;
}

function normalizeLeaderboardSnapshot(trader: CachedTrader): SourceSnapshot {
    return {
        source: 'LEADERBOARD',
        sourceScore: normalizeScore100(trader.copyScore),
        copyFriendliness: normalizeScore100(trader.copyFriendliness),
        drawdownRatio: normalizeRatio(trader.maxDrawdown),
        recentTrades: Math.max(0, Math.round(trader.recentTrades ?? 0)),
        activePositions: Math.max(0, Math.round(trader.activePositions ?? 0)),
        dataQuality: trader.dataQuality,
    };
}

function normalizeSmartMoneySnapshot(trader: DiscoveredSmartMoneyTrader): SourceSnapshot {
    return {
        source: 'SMART_MONEY',
        sourceScore: normalizeScore100(trader.score),
        copyFriendliness: normalizeScore100(trader.copyFriendliness),
        drawdownRatio: normalizeRatio(trader.maxDrawdown),
        recentTrades: Math.max(0, Math.round(trader.recentTrades ?? 0)),
        activePositions: Math.max(0, Math.round(trader.activePositions ?? 0)),
        dataQuality: trader.dataQuality,
    };
}

function weightedAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getStrategyRules(strategyProfile: StrategyProfile): StrategyRules {
    return STRATEGY_RULES[strategyProfile];
}

function createSeededRandom(seed: string): () => number {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
        hash ^= seed.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    let state = (hash >>> 0) || 1;

    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let output = state;
        output = Math.imul(output ^ (output >>> 15), output | 1);
        output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
        return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
    };
}

function mergeCandidates(
    leaderboardTraders: CachedTrader[],
    smartMoneyTraders: DiscoveredSmartMoneyTrader[]
): MergedCandidate[] {
    const merged = new Map<string, MergedCandidate>();

    for (const trader of leaderboardTraders) {
        const address = trader.address.toLowerCase();
        const entry = merged.get(address) ?? {
            address,
            name: trader.name,
            profileImage: trader.profileImage,
            snapshots: [],
        };
        entry.name = entry.name ?? trader.name ?? null;
        entry.profileImage = entry.profileImage ?? trader.profileImage;
        entry.snapshots.push(normalizeLeaderboardSnapshot(trader));
        merged.set(address, entry);
    }

    for (const trader of smartMoneyTraders) {
        const address = trader.address.toLowerCase();
        const entry = merged.get(address) ?? {
            address,
            name: trader.name,
            profileImage: trader.profileImage,
            snapshots: [],
        };
        entry.name = entry.name ?? trader.name ?? null;
        entry.profileImage = entry.profileImage ?? trader.profileImage;
        entry.snapshots.push(normalizeSmartMoneySnapshot(trader));
        merged.set(address, entry);
    }

    return [...merged.values()];
}

export function buildManagedAllocationSeed(input: {
    subscriptionId: string;
    version: number;
    walletAddress: string;
    strategyProfile: StrategyProfile;
}): string {
    return [
        input.subscriptionId.trim().toLowerCase(),
        input.walletAddress.trim().toLowerCase(),
        input.strategyProfile,
        String(input.version),
    ].join(':');
}

export function buildManagedTemplateCandidates(input: {
    strategyProfile: StrategyProfile;
    templates: Array<{
        traderAddress: string;
        name?: string | null;
        traderName?: string | null;
        profileImage?: string | null;
        weight?: number | null;
        isPrimary?: boolean;
    }>;
}): ManagedAllocationCandidate[] {
    return input.templates
        .map<ManagedAllocationCandidate | null>((template) => {
            const normalizedWeight = Math.max(0, Number(template.weight ?? 0));
            if (normalizedWeight <= 0) return null;

            const sourceScore = normalizedWeight * 100 * (template.isPrimary ? 1.1 : 1);
            const compositeScore = Number(sourceScore.toFixed(8));

            return {
                address: template.traderAddress.toLowerCase(),
                name: template.traderName ?? template.name ?? null,
                profileImage: template.profileImage ?? undefined,
                compositeScore,
                weightScore: Math.max(compositeScore, 0.0001),
                scoreSnapshot: {
                    strategyProfile: input.strategyProfile,
                    baseScore: compositeScore,
                    drawdownRatio: 0,
                    copyFriendliness: 100,
                    dataQualityWeight: 1,
                    activityWeight: 1,
                    sourceBonus: template.isPrimary ? 1.1 : 1,
                    sourceCount: 1,
                    sourceSnapshots: [
                        {
                            source: 'PRODUCT_TEMPLATE',
                            sourceScore: compositeScore,
                            copyFriendliness: 100,
                            drawdownRatio: 0,
                            recentTrades: 1,
                            activePositions: 1,
                            dataQuality: 'limited',
                        },
                    ],
                },
            };
        })
        .filter((candidate): candidate is ManagedAllocationCandidate => candidate !== null)
        .sort((left, right) => right.compositeScore - left.compositeScore);
}

export function buildManagedAllocationCandidates(input: {
    strategyProfile: StrategyProfile;
    leaderboardTraders?: CachedTrader[];
    smartMoneyTraders?: DiscoveredSmartMoneyTrader[];
    limit?: number;
}): ManagedAllocationCandidate[] {
    const rules = getStrategyRules(input.strategyProfile);
    const merged = mergeCandidates(
        input.leaderboardTraders ?? [],
        input.smartMoneyTraders ?? []
    );

    const candidates = merged
        .map<ManagedAllocationCandidate | null>((candidate) => {
            const usableSnapshots = candidate.snapshots.filter(
                (snapshot) =>
                    snapshot.activePositions > 0 &&
                    snapshot.recentTrades >= rules.minRecentTrades &&
                    snapshot.dataQuality !== 'insufficient'
            );
            if (usableSnapshots.length === 0) return null;

            const baseScore = weightedAverage(
                usableSnapshots.map((snapshot) => snapshot.sourceScore)
            );
            const copyFriendliness = weightedAverage(
                usableSnapshots.map((snapshot) => snapshot.copyFriendliness)
            );
            const drawdownRatio = weightedAverage(
                usableSnapshots.map((snapshot) => snapshot.drawdownRatio)
            );
            const qualityWeight = Math.max(
                ...usableSnapshots.map((snapshot) => dataQualityWeight(snapshot.dataQuality))
            );
            const maxRecentTrades = Math.max(
                ...usableSnapshots.map((snapshot) => snapshot.recentTrades)
            );

            if (
                baseScore < rules.minScore ||
                copyFriendliness < rules.minCopyFriendliness ||
                drawdownRatio > rules.maxDrawdownRatio
            ) {
                return null;
            }

            const activityWeight = clamp(
                0.9 + maxRecentTrades / Math.max(8, rules.minRecentTrades * 4),
                0.9,
                1.2
            );
            const drawdownWeight = clamp(
                1 - drawdownRatio / Math.max(rules.maxDrawdownRatio * 1.5, 0.01),
                0.3,
                1
            );
            const sourceBonus = usableSnapshots.length > 1 ? 1.05 : 1;
            const compositeScore = Number(
                (baseScore * qualityWeight * activityWeight * drawdownWeight * sourceBonus).toFixed(8)
            );

            return {
                address: candidate.address,
                name: candidate.name,
                profileImage: candidate.profileImage,
                compositeScore,
                weightScore: Math.max(compositeScore, 0.0001),
                scoreSnapshot: {
                    strategyProfile: input.strategyProfile,
                    baseScore: Number(baseScore.toFixed(8)),
                    drawdownRatio: Number(drawdownRatio.toFixed(8)),
                    copyFriendliness: Number(copyFriendliness.toFixed(8)),
                    dataQualityWeight: Number(qualityWeight.toFixed(8)),
                    activityWeight: Number(activityWeight.toFixed(8)),
                    sourceBonus,
                    sourceCount: usableSnapshots.length,
                    sourceSnapshots: usableSnapshots,
                },
            };
        })
        .filter((candidate): candidate is ManagedAllocationCandidate => candidate !== null)
        .sort((left, right) => right.compositeScore - left.compositeScore);

    return candidates.slice(0, Math.max(1, input.limit ?? candidates.length));
}

export async function loadManagedAllocationCandidates(input: {
    strategyProfile: StrategyProfile;
    leaderboardPeriod?: '7d' | '15d' | '30d' | '90d';
    leaderboardLimit?: number;
    smartMoneyLimit?: number;
    includeSmartMoney?: boolean;
    limit?: number;
}): Promise<ManagedAllocationCandidate[]> {
    const leaderboardModule = await import('../services/leaderboard-cache-service');
    const smartMoneyModule = input.includeSmartMoney === false
        ? null
        : await import('../services/smart-money-discovery-service');

    const [leaderboardTraders, smartMoneyTraders] = await Promise.all([
        leaderboardModule.getLeaderboardFromCache(
            input.leaderboardPeriod ?? '30d',
            input.leaderboardLimit ?? 24
        ),
        smartMoneyModule
            ? smartMoneyModule.discoverSmartMoneyTraders(input.smartMoneyLimit ?? 12)
            : Promise.resolve([]),
    ]);

    return buildManagedAllocationCandidates({
        strategyProfile: input.strategyProfile,
        leaderboardTraders: leaderboardTraders ?? [],
        smartMoneyTraders,
        limit: input.limit,
    });
}

export function selectManagedAllocationTargets(input: {
    candidates: ManagedAllocationCandidate[];
    targetCount: number;
    seed: string;
}): ManagedAllocationTarget[] {
    if (input.candidates.length === 0 || input.targetCount <= 0) {
        return [];
    }

    const rng = createSeededRandom(input.seed);
    const remaining = [...input.candidates];
    const targetCount = Math.min(Math.max(1, Math.floor(input.targetCount)), remaining.length);
    const selected: ManagedAllocationCandidate[] = [];

    while (selected.length < targetCount && remaining.length > 0) {
        const totalWeight = remaining.reduce((sum, candidate) => sum + candidate.weightScore, 0);
        let ticket = rng() * totalWeight;
        let selectedIndex = remaining.length - 1;

        for (let index = 0; index < remaining.length; index += 1) {
            ticket -= remaining[index].weightScore;
            if (ticket <= 0) {
                selectedIndex = index;
                break;
            }
        }

        const [picked] = remaining.splice(selectedIndex, 1);
        selected.push(picked);
    }

    const totalSelectedWeight = selected.reduce(
        (sum, candidate) => sum + candidate.weightScore,
        0
    );

    return selected.map((candidate, index) => {
        const rawWeight = candidate.weightScore / totalSelectedWeight;
        const roundedWeight = Number(rawWeight.toFixed(8));
        const consumedWeight = selected
            .slice(0, index)
            .reduce((sum, item) => sum + Number((item.weightScore / totalSelectedWeight).toFixed(8)), 0);
        const weight = index === selected.length - 1
            ? Number((1 - consumedWeight).toFixed(8))
            : roundedWeight;

        return {
            address: candidate.address,
            name: candidate.name,
            profileImage: candidate.profileImage,
            weight,
            weightScore: candidate.weightScore,
            compositeScore: candidate.compositeScore,
            scoreSnapshot: candidate.scoreSnapshot,
        };
    });
}

export function buildManagedAllocationSnapshot(input: {
    strategyProfile: StrategyProfile;
    version: number;
    seed: string;
    targetCount: number;
    reason?: string | null;
    generatedAt?: string;
    candidates: ManagedAllocationCandidate[];
}): ManagedAllocationSnapshot {
    const targets = selectManagedAllocationTargets({
        candidates: input.candidates,
        targetCount: input.targetCount,
        seed: input.seed,
    });

    return {
        seed: input.seed,
        version: input.version,
        reason: input.reason ?? null,
        scoreSnapshot: {
            generatedAt: input.generatedAt ?? new Date().toISOString(),
            strategyProfile: input.strategyProfile,
            candidateCount: input.candidates.length,
            candidates: input.candidates.map((candidate) => ({
                address: candidate.address,
                compositeScore: candidate.compositeScore,
                sourceCount: candidate.scoreSnapshot.sourceCount,
                baseScore: candidate.scoreSnapshot.baseScore,
                drawdownRatio: candidate.scoreSnapshot.drawdownRatio,
                copyFriendliness: candidate.scoreSnapshot.copyFriendliness,
            })),
        },
        selectedWeights: targets.map((target) => ({
            address: target.address,
            weight: target.weight,
            weightScore: target.weightScore,
            compositeScore: target.compositeScore,
            sourceCount: target.scoreSnapshot.sourceCount,
        })),
        targets,
    };
}
