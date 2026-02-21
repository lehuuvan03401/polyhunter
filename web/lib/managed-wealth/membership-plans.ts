export type ManagedMembershipPlanType = 'MONTHLY' | 'QUARTERLY';
export type ManagedMembershipPaymentToken = 'USDC' | 'MCN';

export const MANAGED_MEMBERSHIP_PLANS: Record<
    ManagedMembershipPlanType,
    { label: string; durationDays: number; basePriceUsd: number }
> = {
    MONTHLY: {
        label: 'Monthly',
        durationDays: 30,
        basePriceUsd: 88,
    },
    QUARTERLY: {
        label: 'Quarterly',
        durationDays: 90,
        basePriceUsd: 228,
    },
};

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
