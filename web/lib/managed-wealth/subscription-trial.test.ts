import { describe, expect, it } from 'vitest';
import { resolveManagedSubscriptionTrial } from './subscription-trial';

describe('resolveManagedSubscriptionTrial', () => {
    it('applies 1-day trial for newcomer with one-day term', () => {
        const now = new Date('2026-02-25T00:00:00.000Z');

        const result = resolveManagedSubscriptionTrial({
            existingSubscriptionCount: 0,
            termDurationDays: 1,
            now,
        });

        expect(result.trialApplied).toBe(true);
        expect(result.trialEndsAt?.toISOString()).toBe('2026-02-26T00:00:00.000Z');
    });

    it('does not apply trial for non-newcomer', () => {
        const result = resolveManagedSubscriptionTrial({
            existingSubscriptionCount: 2,
            termDurationDays: 1,
            now: new Date('2026-02-25T00:00:00.000Z'),
        });

        expect(result.trialApplied).toBe(false);
        expect(result.trialEndsAt).toBeNull();
    });

    it('does not apply trial for multi-day term', () => {
        const result = resolveManagedSubscriptionTrial({
            existingSubscriptionCount: 0,
            termDurationDays: 30,
            now: new Date('2026-02-25T00:00:00.000Z'),
        });

        expect(result.trialApplied).toBe(false);
        expect(result.trialEndsAt).toBeNull();
    });
});
