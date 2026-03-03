import { describe, expect, it } from 'vitest';
import { resolveManagedSubscriptionTrial } from './subscription-trial';

// A helper to build a "mature" account (30 days old) so age check passes by default
const MATURE_ACCOUNT_DATE = new Date('2026-01-25T00:00:00.000Z');

describe('resolveManagedSubscriptionTrial', () => {
    it('applies 1-day trial for newcomer with one-day term', () => {
        const now = new Date('2026-02-25T00:00:00.000Z');

        const result = resolveManagedSubscriptionTrial({
            existingSubscriptionCount: 0,
            priorTrialCount: 0,
            termDurationDays: 1,
            accountCreatedAt: MATURE_ACCOUNT_DATE,
            now,
        });

        expect(result.trialApplied).toBe(true);
        expect(result.trialEndsAt?.toISOString()).toBe('2026-02-26T00:00:00.000Z');
        expect(result.trialDeniedReason).toBeNull();
    });

    it('does not apply trial for non-newcomer', () => {
        const result = resolveManagedSubscriptionTrial({
            existingSubscriptionCount: 2,
            priorTrialCount: 0,
            termDurationDays: 1,
            accountCreatedAt: MATURE_ACCOUNT_DATE,
            now: new Date('2026-02-25T00:00:00.000Z'),
        });

        expect(result.trialApplied).toBe(false);
        expect(result.trialEndsAt).toBeNull();
    });

    it('does not apply trial for multi-day term', () => {
        const result = resolveManagedSubscriptionTrial({
            existingSubscriptionCount: 0,
            priorTrialCount: 0,
            termDurationDays: 30,
            accountCreatedAt: MATURE_ACCOUNT_DATE,
            now: new Date('2026-02-25T00:00:00.000Z'),
        });

        expect(result.trialApplied).toBe(false);
        expect(result.trialEndsAt).toBeNull();
    });

    it('does not apply trial if wallet already used a trial (anti-abuse guard 1)', () => {
        const result = resolveManagedSubscriptionTrial({
            existingSubscriptionCount: 0,
            priorTrialCount: 1,
            termDurationDays: 1,
            accountCreatedAt: MATURE_ACCOUNT_DATE,
            now: new Date('2026-02-25T00:00:00.000Z'),
        });

        expect(result.trialApplied).toBe(false);
        expect(result.trialDeniedReason).toContain('Trial already used');
    });

    it('does not apply trial for brand-new account below minimum age (anti-abuse guard 2)', () => {
        const now = new Date('2026-02-25T00:00:00.000Z');
        // Account created 30 minutes ago
        const newAccountDate = new Date(now.getTime() - 30 * 60 * 1000);

        const result = resolveManagedSubscriptionTrial({
            existingSubscriptionCount: 0,
            priorTrialCount: 0,
            termDurationDays: 1,
            accountCreatedAt: newAccountDate,
            now,
        });

        expect(result.trialApplied).toBe(false);
        expect(result.trialDeniedReason).toContain('day(s) old');
    });
});
