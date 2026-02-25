import { describe, expect, it } from 'vitest';
import {
    PARTICIPATION_LEVEL_RULES,
    resolveLevelByTeamNetDeposit,
    resolveNextLevel,
    startOfUtcDay,
} from './levels';

describe('participation levels', () => {
    it('resolves NONE below V1 threshold', () => {
        const result = resolveLevelByTeamNetDeposit(99_999.99);
        expect(result.level).toBe('NONE');
        expect(result.dividendRate).toBe(0);
    });

    it('resolves exact V1 threshold', () => {
        const result = resolveLevelByTeamNetDeposit(100_000);
        expect(result.level).toBe('V1');
        expect(result.dividendRate).toBe(0.30);
    });

    it('resolves top level V9', () => {
        const result = resolveLevelByTeamNetDeposit(30_000_000);
        expect(result.level).toBe('V9');
        expect(result.dividendRate).toBe(0.70);
    });

    it('returns next target when below V9', () => {
        const next = resolveNextLevel(4_900_000);
        expect(next.nextLevel).toBe('V6');
        expect(next.nextLevelThresholdUsd).toBe(5_000_000);
        expect(next.remainingToNextUsd).toBe(100_000);
    });

    it('returns no next level at V9+', () => {
        const next = resolveNextLevel(31_000_000);
        expect(next.nextLevel).toBeNull();
        expect(next.nextLevelThresholdUsd).toBeNull();
        expect(next.remainingToNextUsd).toBe(0);
    });

    it('keeps level thresholds sorted ascending', () => {
        const thresholds = PARTICIPATION_LEVEL_RULES.map((rule) => rule.minNetDepositUsd);
        const sorted = [...thresholds].sort((a, b) => a - b);
        expect(thresholds).toEqual(sorted);
    });

    it('normalizes date to start of UTC day', () => {
        const date = new Date('2026-02-25T15:31:00.000Z');
        const normalized = startOfUtcDay(date);
        expect(normalized.toISOString()).toBe('2026-02-25T00:00:00.000Z');
    });
});
