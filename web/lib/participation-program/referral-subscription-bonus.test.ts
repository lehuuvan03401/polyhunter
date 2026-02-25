import { describe, expect, it, vi } from 'vitest';
import { applyOneTimeReferralSubscriptionBonus } from './referral-subscription-bonus';

type MockStore = {
    referral: {
        findUnique: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
    };
    managedMembership: {
        findFirst: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
    };
    managedSubscription: {
        findFirst: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
    };
};

function createMockStore(): MockStore {
    return {
        referral: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        managedMembership: {
            findFirst: vi.fn(),
            update: vi.fn(),
        },
        managedSubscription: {
            findFirst: vi.fn(),
            update: vi.fn(),
        },
    };
}

describe('applyOneTimeReferralSubscriptionBonus', () => {
    it('returns NO_REFERRAL when no referral relation exists', async () => {
        const store = createMockStore();
        store.referral.findUnique.mockResolvedValue(null);

        const result = await applyOneTimeReferralSubscriptionBonus(store, {
            refereeWallet: '0xabc0000000000000000000000000000000000001',
            now: new Date('2026-02-25T00:00:00.000Z'),
        });

        expect(result).toEqual({ applied: false, reason: 'NO_REFERRAL' });
        expect(store.referral.update).not.toHaveBeenCalled();
    });

    it('returns ALREADY_GRANTED when bonus already consumed', async () => {
        const store = createMockStore();
        store.referral.findUnique.mockResolvedValue({
            id: 'ref-1',
            subscriptionBonusGrantedAt: new Date('2026-02-24T00:00:00.000Z'),
            referrer: { walletAddress: '0xabc0000000000000000000000000000000000002' },
        });

        const result = await applyOneTimeReferralSubscriptionBonus(store, {
            refereeWallet: '0xabc0000000000000000000000000000000000001',
            now: new Date('2026-02-25T00:00:00.000Z'),
        });

        expect(result).toEqual({ applied: false, reason: 'ALREADY_GRANTED' });
        expect(store.managedMembership.findFirst).not.toHaveBeenCalled();
        expect(store.managedSubscription.findFirst).not.toHaveBeenCalled();
    });

    it('extends active managed membership by exactly one day', async () => {
        const store = createMockStore();
        const baseEndAt = new Date('2026-03-01T00:00:00.000Z');

        store.referral.findUnique.mockResolvedValue({
            id: 'ref-1',
            subscriptionBonusGrantedAt: null,
            referrer: { walletAddress: '0xabc0000000000000000000000000000000000002' },
        });
        store.managedMembership.findFirst.mockResolvedValue({
            id: 'membership-1',
            endsAt: baseEndAt,
        });

        const now = new Date('2026-02-25T00:00:00.000Z');
        const result = await applyOneTimeReferralSubscriptionBonus(store, {
            refereeWallet: '0xabc0000000000000000000000000000000000001',
            now,
        });

        expect(result).toEqual({
            applied: true,
            target: 'MANAGED_MEMBERSHIP',
            referrerWallet: '0xabc0000000000000000000000000000000000002',
        });
        expect(store.managedMembership.update).toHaveBeenCalledWith({
            where: { id: 'membership-1' },
            data: {
                endsAt: new Date(baseEndAt.getTime() + 24 * 60 * 60 * 1000),
            },
        });
        expect(store.referral.update).toHaveBeenCalledWith({
            where: { id: 'ref-1' },
            data: { subscriptionBonusGrantedAt: now },
        });
        expect(store.managedSubscription.findFirst).not.toHaveBeenCalled();
    });

    it('falls back to managed subscription when membership is absent', async () => {
        const store = createMockStore();
        const baseEndAt = new Date('2026-03-02T00:00:00.000Z');

        store.referral.findUnique.mockResolvedValue({
            id: 'ref-1',
            subscriptionBonusGrantedAt: null,
            referrer: { walletAddress: '0xabc0000000000000000000000000000000000002' },
        });
        store.managedMembership.findFirst.mockResolvedValue(null);
        store.managedSubscription.findFirst.mockResolvedValue({
            id: 'sub-1',
            endAt: baseEndAt,
        });

        const now = new Date('2026-02-25T00:00:00.000Z');
        const result = await applyOneTimeReferralSubscriptionBonus(store, {
            refereeWallet: '0xabc0000000000000000000000000000000000001',
            now,
        });

        expect(result).toEqual({
            applied: true,
            target: 'MANAGED_SUBSCRIPTION',
            referrerWallet: '0xabc0000000000000000000000000000000000002',
        });
        expect(store.managedSubscription.update).toHaveBeenCalledWith({
            where: { id: 'sub-1' },
            data: {
                endAt: new Date(baseEndAt.getTime() + 24 * 60 * 60 * 1000),
            },
        });
        expect(store.referral.update).toHaveBeenCalledWith({
            where: { id: 'ref-1' },
            data: { subscriptionBonusGrantedAt: now },
        });
    });

    it('returns NO_ACTIVE_SUBSCRIPTION when referrer has no active window', async () => {
        const store = createMockStore();
        store.referral.findUnique.mockResolvedValue({
            id: 'ref-1',
            subscriptionBonusGrantedAt: null,
            referrer: { walletAddress: '0xabc0000000000000000000000000000000000002' },
        });
        store.managedMembership.findFirst.mockResolvedValue(null);
        store.managedSubscription.findFirst.mockResolvedValue(null);

        const result = await applyOneTimeReferralSubscriptionBonus(store, {
            refereeWallet: '0xabc0000000000000000000000000000000000001',
            now: new Date('2026-02-25T00:00:00.000Z'),
        });

        expect(result).toEqual({ applied: false, reason: 'NO_ACTIVE_SUBSCRIPTION' });
        expect(store.referral.update).not.toHaveBeenCalled();
    });
});
