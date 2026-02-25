import { describe, expect, it } from 'vitest';
import { PARTICIPATION_STRATEGIES } from '@/lib/participation-program/rules';
import { MANAGED_STRATEGY_THEMES } from './strategy-theme';

describe('managed strategy themes', () => {
    it('defines a theme for every formal strategy option', () => {
        for (const strategy of PARTICIPATION_STRATEGIES) {
            expect(MANAGED_STRATEGY_THEMES[strategy]).toBeDefined();
            expect(MANAGED_STRATEGY_THEMES[strategy].labelKey).toBeTruthy();
        }
    });

    it('keeps conservative/moderate/aggressive visual semantics stable', () => {
        expect(MANAGED_STRATEGY_THEMES.CONSERVATIVE.color).toContain('green');
        expect(MANAGED_STRATEGY_THEMES.MODERATE.color).toContain('blue');
        expect(MANAGED_STRATEGY_THEMES.AGGRESSIVE.color).toContain('purple');
    });
});
