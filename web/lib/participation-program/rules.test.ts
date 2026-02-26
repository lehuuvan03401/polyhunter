import { describe, expect, it } from 'vitest';
import {
    PARTICIPATION_STRATEGIES,
    PARTICIPATION_STRATEGY_LABEL_KEYS,
    parseParticipationStrategy,
} from './rules';

describe('participation strategy options', () => {
    it('parses case-insensitive strategy values', () => {
        expect(parseParticipationStrategy('conservative')).toBe('CONSERVATIVE');
        expect(parseParticipationStrategy('Moderate')).toBe('MODERATE');
        expect(parseParticipationStrategy('AGGRESSIVE')).toBe('AGGRESSIVE');
        expect(parseParticipationStrategy('balanced')).toBe('MODERATE');
    });

    it('returns undefined for unsupported strategy', () => {
        expect(parseParticipationStrategy('STEADY')).toBeUndefined();
        expect(parseParticipationStrategy(null)).toBeUndefined();
    });

    it('exposes exactly three formal strategy options', () => {
        expect(PARTICIPATION_STRATEGIES).toEqual(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']);
        expect(PARTICIPATION_STRATEGY_LABEL_KEYS.CONSERVATIVE).toBe('Conservative');
        expect(PARTICIPATION_STRATEGY_LABEL_KEYS.MODERATE).toBe('Moderate');
        expect(PARTICIPATION_STRATEGY_LABEL_KEYS.AGGRESSIVE).toBe('Aggressive');
    });
});
