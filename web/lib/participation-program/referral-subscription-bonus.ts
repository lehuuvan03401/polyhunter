const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type ReferralBonusTarget = 'MANAGED_MEMBERSHIP' | 'MANAGED_SUBSCRIPTION';
export type ReferralBonusSkipReason =
    | 'NO_REFERRAL'
    | 'ALREADY_GRANTED'
    | 'NO_ACTIVE_SUBSCRIPTION';

export type ReferralBonusResult =
    | {
        applied: true;
        target: ReferralBonusTarget;
        referrerWallet: string;
      }
    | {
        applied: false;
        reason: ReferralBonusSkipReason;
      };

type ReferralRow = {
    id: string;
    subscriptionBonusGrantedAt: Date | null;
    referrer: {
        walletAddress: string;
    };
};

type ActiveMembershipRow = {
    id: string;
    endsAt: Date;
};

type ActiveManagedSubscriptionRow = {
    id: string;
    endAt: Date;
};

type ReferralBonusStore = {
    referral: {
        findUnique(args: unknown): Promise<unknown>;
        update(args: unknown): Promise<unknown>;
    };
    managedMembership: {
        findFirst(args: unknown): Promise<unknown>;
        update(args: unknown): Promise<unknown>;
    };
    managedSubscription: {
        findFirst(args: unknown): Promise<unknown>;
        update(args: unknown): Promise<unknown>;
    };
};

export async function applyOneTimeReferralSubscriptionBonus(
    store: ReferralBonusStore,
    params: {
        refereeWallet: string;
        now: Date;
    }
): Promise<ReferralBonusResult> {
    const refereeWallet = params.refereeWallet.trim().toLowerCase();
    const now = params.now;

    const referral = await store.referral.findUnique({
        where: { refereeAddress: refereeWallet },
        include: {
            referrer: {
                select: { walletAddress: true },
            },
        },
    }) as ReferralRow | null;

    if (!referral) {
        return { applied: false, reason: 'NO_REFERRAL' };
    }
    if (referral.subscriptionBonusGrantedAt) {
        return { applied: false, reason: 'ALREADY_GRANTED' };
    }

    const referrerWallet = referral.referrer.walletAddress.trim().toLowerCase();

    const activeMembership = await store.managedMembership.findFirst({
        where: {
            walletAddress: referrerWallet,
            status: 'ACTIVE',
            endsAt: { gt: now },
        },
        orderBy: { endsAt: 'asc' },
        select: {
            id: true,
            endsAt: true,
        },
    }) as ActiveMembershipRow | null;

    if (activeMembership?.endsAt) {
        await store.managedMembership.update({
            where: { id: activeMembership.id },
            data: {
                endsAt: new Date(activeMembership.endsAt.getTime() + ONE_DAY_MS),
            },
        });

        await store.referral.update({
            where: { id: referral.id },
            data: { subscriptionBonusGrantedAt: now },
        });

        return {
            applied: true,
            target: 'MANAGED_MEMBERSHIP',
            referrerWallet,
        };
    }

    const activeManagedSubscription = await store.managedSubscription.findFirst({
        where: {
            walletAddress: referrerWallet,
            status: 'RUNNING',
            endAt: { gt: now },
        },
        orderBy: { endAt: 'asc' },
        select: {
            id: true,
            endAt: true,
        },
    }) as ActiveManagedSubscriptionRow | null;

    if (activeManagedSubscription?.endAt) {
        await store.managedSubscription.update({
            where: { id: activeManagedSubscription.id },
            data: {
                endAt: new Date(activeManagedSubscription.endAt.getTime() + ONE_DAY_MS),
            },
        });

        await store.referral.update({
            where: { id: referral.id },
            data: { subscriptionBonusGrantedAt: now },
        });

        return {
            applied: true,
            target: 'MANAGED_SUBSCRIPTION',
            referrerWallet,
        };
    }

    return { applied: false, reason: 'NO_ACTIVE_SUBSCRIPTION' };
}
