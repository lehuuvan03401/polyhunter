import { NextResponse } from 'next/server';
import {
    MANAGED_MEMBERSHIP_PLANS,
    calculateManagedMembershipPrice,
} from '@/lib/managed-wealth/membership-plans';

export const dynamic = 'force-dynamic';

export async function GET() {
    const plans = Object.entries(MANAGED_MEMBERSHIP_PLANS).map(([planType, plan]) => {
        const usdc = calculateManagedMembershipPrice(planType as 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL', 'USDC');
        const mcn = calculateManagedMembershipPrice(planType as 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL', 'MCN');

        return {
            planType,
            label: plan.label,
            durationDays: plan.durationDays,
            basePriceUsd: plan.basePriceUsd,
            maxSubscriptionTermDays: plan.maxSubscriptionTermDays,
            maxActiveSubscriptions: plan.maxActiveSubscriptions,
            prices: {
                USDC: usdc.finalPriceUsd,
                MCN: mcn.finalPriceUsd,
            },
            mcnDiscountRate: mcn.discountRate,
        };
    });

    return NextResponse.json({
        plans,
        rules: {
            onlyProfitFee: true,
            notes: [
                'Membership is required to create managed subscriptions.',
                'Each tier limits the maximum subscription term and concurrent active subscriptions.',
                'One active membership per wallet is allowed. Renewal starts after current expiry.',
            ],
        },
    });
}
