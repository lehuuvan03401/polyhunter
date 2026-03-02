import { describe, expect, it } from 'vitest';
import type { CachedTrader } from '../services/leaderboard-cache-service';
import type { DiscoveredSmartMoneyTrader } from '../services/smart-money-discovery-service';
import {
    buildManagedAllocationCandidates,
    buildManagedAllocationSeed,
    buildManagedAllocationSnapshot,
} from './allocation-service';

function createLeaderboardTrader(
    overrides: Partial<CachedTrader> = {}
): CachedTrader {
    return {
        address: '0xaaa',
        name: 'Leaderboard Trader',
        profileImage: undefined,
        activePositions: 3,
        recentTrades: 12,
        lastTradeTime: 1_700_000_000,
        pnl: 1200,
        volume: 45_000,
        winRate: 0.62,
        profitFactor: 1.8,
        maxDrawdown: 0.12,
        volumeWeightedWinRate: 0.66,
        sharpeRatio: 1.7,
        copyFriendliness: 72,
        dataQuality: 'full',
        copyScore: 81,
        rank: 1,
        ...overrides,
    };
}

function createSmartMoneyTrader(
    overrides: Partial<DiscoveredSmartMoneyTrader> = {}
): DiscoveredSmartMoneyTrader {
    return {
        address: '0xbbb',
        name: 'Smart Money Trader',
        profileImage: undefined,
        pnl: 1800,
        volume: 75_000,
        score: 88,
        rank: 1,
        profitFactor: 2.1,
        maxDrawdown: 0.16,
        volumeWeightedWinRate: 0.71,
        copyFriendliness: 74,
        dataQuality: 'full',
        recentTrades: 8,
        activePositions: 2,
        reconstructionConfidence: 0.93,
        ...overrides,
    };
}

describe('managed allocation service', () => {
    it('builds a strategy-filtered candidate pool and merges duplicate traders', () => {
        const candidates = buildManagedAllocationCandidates({
            strategyProfile: 'CONSERVATIVE',
            leaderboardTraders: [
                createLeaderboardTrader({
                    address: '0xbbb',
                    name: 'Merged Trader',
                    copyScore: 80,
                    copyFriendliness: 70,
                    maxDrawdown: 0.14,
                }),
                createLeaderboardTrader({
                    address: '0xccc',
                    name: 'Too Risky',
                    copyScore: 76,
                    copyFriendliness: 49,
                    maxDrawdown: 0.36,
                }),
                createLeaderboardTrader({
                    address: '0xddd',
                    name: 'Safe Trader',
                    copyScore: 74,
                }),
            ],
            smartMoneyTraders: [
                createSmartMoneyTrader({
                    address: '0xbbb',
                    name: 'Merged Trader',
                    score: 92,
                    copyFriendliness: 76,
                    maxDrawdown: 0.13,
                }),
            ],
        });

        expect(candidates.map((candidate) => candidate.address)).toEqual(['0xbbb', '0xddd']);
        expect(candidates[0].scoreSnapshot.sourceCount).toBe(2);
        expect(candidates[0].compositeScore).toBeGreaterThan(candidates[1].compositeScore);
    });

    it('builds a deterministic seed from subscription context', () => {
        const seed = buildManagedAllocationSeed({
            subscriptionId: 'Sub-1',
            version: 3,
            walletAddress: '0xABC',
            strategyProfile: 'MODERATE',
        });

        expect(seed).toBe('sub-1:0xabc:MODERATE:3');
    });

    it('produces stable weighted selections for the same seed', () => {
        const candidates = buildManagedAllocationCandidates({
            strategyProfile: 'MODERATE',
            leaderboardTraders: [
                createLeaderboardTrader({ address: '0x111', name: 'Alpha', copyScore: 85 }),
                createLeaderboardTrader({ address: '0x222', name: 'Bravo', copyScore: 80 }),
                createLeaderboardTrader({ address: '0x333', name: 'Charlie', copyScore: 78 }),
            ],
            smartMoneyTraders: [
                createSmartMoneyTrader({ address: '0x444', name: 'Delta', score: 91 }),
            ],
        });

        const first = buildManagedAllocationSnapshot({
            strategyProfile: 'MODERATE',
            version: 1,
            seed: 'sub-1:0xabc:MODERATE:1',
            targetCount: 2,
            generatedAt: '2026-03-02T00:00:00.000Z',
            candidates,
        });
        const second = buildManagedAllocationSnapshot({
            strategyProfile: 'MODERATE',
            version: 1,
            seed: 'sub-1:0xabc:MODERATE:1',
            targetCount: 2,
            generatedAt: '2026-03-02T00:00:00.000Z',
            candidates,
        });

        expect(first.selectedWeights).toEqual(second.selectedWeights);
        expect(first.targets.map((target) => target.address)).toEqual(
            second.targets.map((target) => target.address)
        );
        expect(first.selectedWeights.reduce((sum, row) => sum + row.weight, 0)).toBeCloseTo(1, 8);
    });
});
