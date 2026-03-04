export type ManagedMembershipPlanType = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
export type ManagedMembershipPaymentToken = 'USDC' | 'MCN';

export interface ManagedMembershipPlanConfig {
    label: string;
    durationDays: number;
    basePriceUsd: number;
    maxSubscriptionTermDays: number;
    maxActiveSubscriptions: number;
}

export const MANAGED_MEMBERSHIP_PLANS: Record<
    ManagedMembershipPlanType,
    ManagedMembershipPlanConfig
> = {
    MONTHLY: {
        label: 'Monthly',
        durationDays: 30,
        basePriceUsd: 88,
        maxSubscriptionTermDays: 30,
        maxActiveSubscriptions: 2,
    },
    QUARTERLY: {
        label: 'Quarterly',
        durationDays: 90,
        basePriceUsd: 228,
        maxSubscriptionTermDays: 90,
        maxActiveSubscriptions: 5,
    },
    SEMI_ANNUAL: {
        label: 'Semi-Annual',
        durationDays: 180,
        basePriceUsd: 358,
        maxSubscriptionTermDays: 180,
        maxActiveSubscriptions: 10,
    },
    ANNUAL: {
        label: 'Annual',
        durationDays: 360,
        basePriceUsd: 558,
        maxSubscriptionTermDays: 360,
        maxActiveSubscriptions: 20,
    },
};

export function getMembershipTermCap(planType: ManagedMembershipPlanType): number {
    return MANAGED_MEMBERSHIP_PLANS[planType].maxSubscriptionTermDays;
}

export function getMembershipActiveSubLimit(planType: ManagedMembershipPlanType): number {
    return MANAGED_MEMBERSHIP_PLANS[planType].maxActiveSubscriptions;
}

export function calculateManagedMembershipPrice(
    planType: ManagedMembershipPlanType,
    paymentToken: ManagedMembershipPaymentToken
): {
    basePriceUsd: number;
    discountRate: number;
    finalPriceUsd: number;
    durationDays: number;
} {
    const plan = MANAGED_MEMBERSHIP_PLANS[planType];
    const discountRate = paymentToken === 'MCN' ? 0.5 : 0;
    const finalPriceUsd = Number((plan.basePriceUsd * (1 - discountRate)).toFixed(2));

    return {
        basePriceUsd: plan.basePriceUsd,
        discountRate,
        finalPriceUsd,
        durationDays: plan.durationDays,
    };
}
