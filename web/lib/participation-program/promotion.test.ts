import { describe, expect, it } from 'vitest';
import { resolvePromotionLevel } from './promotion';

describe('double-zone promotion', () => {
    it('returns NONE below V1 threshold', () => {
        const result = resolvePromotionLevel(1_000);
        expect(result.level).toBe('NONE');
        expect(result.nextLevel).toBe('V1');
        expect(result.nextLevelThresholdUsd).toBe(100_000);
    });

    it('returns V1 at threshold', () => {
        const result = resolvePromotionLevel(100_000);
        expect(result.level).toBe('V1');
        expect(result.nextLevel).toBe('V2');
    });

    it('returns V9 when weak zone reaches top threshold', () => {
        const result = resolvePromotionLevel(30_000_000);
        expect(result.level).toBe('V9');
        expect(result.nextLevel).toBeNull();
        expect(result.nextLevelGapUsd).toBe(0);
    });
});
