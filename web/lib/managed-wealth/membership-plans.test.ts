import { describe, expect, it } from 'vitest';
import {
    calculateManagedMembershipPrice,
    MANAGED_MEMBERSHIP_PLANS,
} from './membership-plans';

describe('managed membership plans', () => {
    it('keeps official base pricing', () => {
        expect(MANAGED_MEMBERSHIP_PLANS.MONTHLY.basePriceUsd).toBe(88);
        expect(MANAGED_MEMBERSHIP_PLANS.QUARTERLY.basePriceUsd).toBe(228);
    });

    it('applies no discount for USDC payments', () => {
        const monthly = calculateManagedMembershipPrice('MONTHLY', 'USDC');
        const quarterly = calculateManagedMembershipPrice('QUARTERLY', 'USDC');

        expect(monthly.discountRate).toBe(0);
        expect(monthly.finalPriceUsd).toBe(88);
        expect(quarterly.discountRate).toBe(0);
        expect(quarterly.finalPriceUsd).toBe(228);
    });

    it('applies 50% discount for MCN payments', () => {
        const monthly = calculateManagedMembershipPrice('MONTHLY', 'MCN');
        const quarterly = calculateManagedMembershipPrice('QUARTERLY', 'MCN');

        expect(monthly.discountRate).toBe(0.5);
        expect(monthly.finalPriceUsd).toBe(44);
        expect(quarterly.discountRate).toBe(0.5);
        expect(quarterly.finalPriceUsd).toBe(114);
    });
});
