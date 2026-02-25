import { describe, expect, it } from 'vitest';
import { calculateSameLevelBonus, getSameLevelBonusRate } from './bonuses';

describe('same-level bonuses', () => {
    it('returns 4% for generation 1', () => {
        expect(getSameLevelBonusRate(1)).toBe(0.04);
    });

    it('returns 1% for generation 2', () => {
        expect(getSameLevelBonusRate(2)).toBe(0.01);
    });

    it('returns 0 for unsupported generation', () => {
        expect(getSameLevelBonusRate(3)).toBe(0);
    });

    it('calculates bonus on realized profit', () => {
        const result = calculateSameLevelBonus(100, 1);
        expect(result.rate).toBe(0.04);
        expect(result.amount).toBe(4);
    });

    it('returns zero amount when profit <= 0', () => {
        const result = calculateSameLevelBonus(0, 1);
        expect(result.amount).toBe(0);
    });
});
