import { describe, expect, it } from 'vitest';
import { normalizeManagedAllocationWeights } from './allocation-weights';

describe('normalizeManagedAllocationWeights', () => {
    it('returns empty array for null input', () => {
        expect(normalizeManagedAllocationWeights(null)).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
        expect(normalizeManagedAllocationWeights(undefined)).toEqual([]);
    });

    it('returns empty array for non-array primitive', () => {
        expect(normalizeManagedAllocationWeights('string')).toEqual([]);
        expect(normalizeManagedAllocationWeights(42)).toEqual([]);
    });

    it('returns empty array for empty array input', () => {
        expect(normalizeManagedAllocationWeights([])).toEqual([]);
    });

    it('normalizes address to lowercase', () => {
        const input = [{ address: '0xABCDEF', weight: 1 }];
        const [result] = normalizeManagedAllocationWeights(input);
        expect(result.address).toBe('0xabcdef');
    });

    it('parses weight as number', () => {
        const input = [{ address: '0xA', weight: 0.75 }];
        const [result] = normalizeManagedAllocationWeights(input);
        expect(result.weight).toBe(0.75);
    });

    it('defaults missing weight to 0', () => {
        const input = [{ address: '0xA' }];
        const [result] = normalizeManagedAllocationWeights(input);
        expect(result.weight).toBe(0);
    });

    it('parses weightScore when present', () => {
        const input = [{ address: '0xA', weight: 1, weightScore: 0.85 }];
        const [result] = normalizeManagedAllocationWeights(input);
        expect(result.weightScore).toBe(0.85);
    });

    it('sets weightScore to null when not present', () => {
        const input = [{ address: '0xA', weight: 1 }];
        const [result] = normalizeManagedAllocationWeights(input);
        expect(result.weightScore).toBeNull();
    });

    it('filters out entries without address', () => {
        const input = [
            { address: '0xA', weight: 1 },
            { weight: 0.5 }, // missing address
        ];
        const result = normalizeManagedAllocationWeights(input);
        expect(result).toHaveLength(1);
        expect(result[0].address).toBe('0xa');
    });

    it('filters out null/non-object entries', () => {
        const input = [null, undefined, 42, { address: '0xA', weight: 1 }];
        const result = normalizeManagedAllocationWeights(input);
        expect(result).toHaveLength(1);
    });

    it('handles multiple valid entries', () => {
        const input = [
            { address: '0xA', weight: 0.6 },
            { address: '0xB', weight: 0.4 },
        ];
        const result = normalizeManagedAllocationWeights(input);
        expect(result).toHaveLength(2);
        expect(result.map(r => r.address)).toEqual(['0xa', '0xb']);
    });
});
