import { NextResponse } from 'next/server';
import {
    MANAGED_MEMBERSHIP_PLANS,
    calculateManagedMembershipPrice,
} from '@/lib/managed-wealth/membership-plans';

export const dynamic = 'force-dynamic';

export async function GET() {
    const plans = Object.entries(MANAGED_MEMBERSHIP_PLANS).map(([planType, plan]) => {
        const usdc = calculateManagedMembershipPrice(planType as 'MONTHLY' | 'QUARTERLY', 'USDC');
        const mcn = calculateManagedMembershipPrice(planType as 'MONTHLY' | 'QUARTERLY', 'MCN');

        return {
            planType,
            label: plan.label,
            durationDays: plan.durationDays,
            basePriceUsd: plan.basePriceUsd,
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
                'Membership is currently an off-chain service entitlement record.',
                'One active membership per wallet is allowed.',
            ],
        },
    });
}
