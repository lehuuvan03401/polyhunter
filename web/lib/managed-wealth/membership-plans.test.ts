import { describe, expect, it } from 'vitest';
import {
    calculateManagedMembershipPrice,
    getMembershipTermCap,
    getMembershipActiveSubLimit,
    MANAGED_MEMBERSHIP_PLANS,
} from './membership-plans';

describe('managed membership plans', () => {
    it('keeps official base pricing for all 4 tiers', () => {
        expect(MANAGED_MEMBERSHIP_PLANS.MONTHLY.basePriceUsd).toBe(88);
        expect(MANAGED_MEMBERSHIP_PLANS.QUARTERLY.basePriceUsd).toBe(228);
        expect(MANAGED_MEMBERSHIP_PLANS.SEMI_ANNUAL.basePriceUsd).toBe(358);
        expect(MANAGED_MEMBERSHIP_PLANS.ANNUAL.basePriceUsd).toBe(558);
    });

    it('applies no discount for USDC payments', () => {
        const monthly = calculateManagedMembershipPrice('MONTHLY', 'USDC');
        const quarterly = calculateManagedMembershipPrice('QUARTERLY', 'USDC');
        const semiAnnual = calculateManagedMembershipPrice('SEMI_ANNUAL', 'USDC');
        const annual = calculateManagedMembershipPrice('ANNUAL', 'USDC');

        expect(monthly.discountRate).toBe(0);
        expect(monthly.finalPriceUsd).toBe(88);
        expect(quarterly.discountRate).toBe(0);
        expect(quarterly.finalPriceUsd).toBe(228);
        expect(semiAnnual.discountRate).toBe(0);
        expect(semiAnnual.finalPriceUsd).toBe(358);
        expect(annual.discountRate).toBe(0);
        expect(annual.finalPriceUsd).toBe(558);
    });

    it('applies 50% discount for MCN payments', () => {
        const monthly = calculateManagedMembershipPrice('MONTHLY', 'MCN');
        const quarterly = calculateManagedMembershipPrice('QUARTERLY', 'MCN');
        const semiAnnual = calculateManagedMembershipPrice('SEMI_ANNUAL', 'MCN');
        const annual = calculateManagedMembershipPrice('ANNUAL', 'MCN');

        expect(monthly.discountRate).toBe(0.5);
        expect(monthly.finalPriceUsd).toBe(44);
        expect(quarterly.discountRate).toBe(0.5);
        expect(quarterly.finalPriceUsd).toBe(114);
        expect(semiAnnual.discountRate).toBe(0.5);
        expect(semiAnnual.finalPriceUsd).toBe(179);
        expect(annual.discountRate).toBe(0.5);
        expect(annual.finalPriceUsd).toBe(279);
    });

    it('returns correct term caps per tier', () => {
        expect(getMembershipTermCap('MONTHLY')).toBe(30);
        expect(getMembershipTermCap('QUARTERLY')).toBe(90);
        expect(getMembershipTermCap('SEMI_ANNUAL')).toBe(180);
        expect(getMembershipTermCap('ANNUAL')).toBe(360);
    });

    it('returns correct active subscription limits per tier', () => {
        expect(getMembershipActiveSubLimit('MONTHLY')).toBe(2);
        expect(getMembershipActiveSubLimit('QUARTERLY')).toBe(5);
        expect(getMembershipActiveSubLimit('SEMI_ANNUAL')).toBe(10);
        expect(getMembershipActiveSubLimit('ANNUAL')).toBe(20);
    });

    it('has correct duration days per tier', () => {
        expect(MANAGED_MEMBERSHIP_PLANS.MONTHLY.durationDays).toBe(30);
        expect(MANAGED_MEMBERSHIP_PLANS.QUARTERLY.durationDays).toBe(90);
        expect(MANAGED_MEMBERSHIP_PLANS.SEMI_ANNUAL.durationDays).toBe(180);
        expect(MANAGED_MEMBERSHIP_PLANS.ANNUAL.durationDays).toBe(360);
    });
});
