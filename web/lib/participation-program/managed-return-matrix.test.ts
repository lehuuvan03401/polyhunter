import { describe, expect, it } from 'vitest';
import { lookupManagedReturnMatrixRow } from './managed-return-matrix';
import { DEFAULT_MANAGED_RETURN_MATRIX } from './rules';

describe('managed return matrix lookup', () => {
    it('matches band A by principal + cycle + strategy', () => {
        const result = lookupManagedReturnMatrixRow(DEFAULT_MANAGED_RETURN_MATRIX, {
            principalUsd: 1200,
            cycleDays: 30,
            strategyProfile: 'MODERATE',
        });

        expect(result.principalBand).toBe('A');
        expect(result.row?.returnMin).toBe(23);
        expect(result.row?.returnMax).toBe(30);
        expect(result.displayRange).toBe('23%-30%');
    });

    it('matches multiplier row for band B', () => {
        const result = lookupManagedReturnMatrixRow(DEFAULT_MANAGED_RETURN_MATRIX, {
            principalUsd: 8000,
            cycleDays: 180,
            strategyProfile: 'AGGRESSIVE',
        });

        expect(result.principalBand).toBe('B');
        expect(result.row?.returnUnit).toBe('MULTIPLIER');
        expect(result.displayRange).toBe('1.76x-2.40x');
    });

    it('returns null when principal is outside matrix bands', () => {
        const result = lookupManagedReturnMatrixRow(DEFAULT_MANAGED_RETURN_MATRIX, {
            principalUsd: 300,
            cycleDays: 30,
            strategyProfile: 'CONSERVATIVE',
        });

        expect(result.principalBand).toBeNull();
        expect(result.row).toBeNull();
        expect(result.displayRange).toBeNull();
    });

    it('returns band with null row when cycle has no configured entry', () => {
        const result = lookupManagedReturnMatrixRow(DEFAULT_MANAGED_RETURN_MATRIX, {
            principalUsd: 1500,
            cycleDays: 15,
            strategyProfile: 'CONSERVATIVE',
        });

        expect(result.principalBand).toBe('A');
        expect(result.row).toBeNull();
        expect(result.displayRange).toBeNull();
    });
});
