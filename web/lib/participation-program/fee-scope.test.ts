import { describe, expect, it } from 'vitest';
import {
    PARTICIPATION_PROFIT_FEE_RATE,
    resolveParticipationProfitFeeScope,
} from './fee-scope';

describe('participation fee scope', () => {
    it('keeps fixed 20% participation profit fee rate', () => {
        expect(PARTICIPATION_PROFIT_FEE_RATE).toBe(0.2);
    });

    it('resolves managed withdrawal scope from namespaced trade id', () => {
        expect(resolveParticipationProfitFeeScope('managed-withdraw:sub-1:settlement-1')).toBe('MANAGED_WITHDRAWAL');
    });

    it('returns null for out-of-scope trade id without explicit scope', () => {
        expect(resolveParticipationProfitFeeScope('proxy-fee:tx-1')).toBeNull();
    });

    it('uses explicit scope when provided', () => {
        expect(
            resolveParticipationProfitFeeScope('any-trade-id', 'PARTICIPATION_WITHDRAWAL')
        ).toBe('PARTICIPATION_WITHDRAWAL');
    });
});
