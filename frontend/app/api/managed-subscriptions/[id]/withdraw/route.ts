import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { z } from 'zod';
import { ManagedSettlementStatus, ManagedSubscriptionStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const withdrawSchema = z.object({
    confirm: z.boolean(),
});

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!isDatabaseEnabled) {
            return NextResponse.json(
                { error: 'Database not configured' },
                { status: 503 }
            );
        }

        const body = await request.json();
        const validation = withdrawSchema.safeParse(body);

        if (!validation.success || !validation.data.confirm) {
            return NextResponse.json(
                { error: 'Withdrawal must be confirmed' },
                { status: 400 }
            );
        }

        // 1. Fetch subscription
        const subscription = await prisma.managedSubscription.findUnique({
            where: { id },
            include: {
                term: true,
                product: true,
            }
        });

        if (!subscription) {
            return NextResponse.json(
                { error: 'Subscription not found' },
                { status: 404 }
            );
        }

        // 2. Validate status
        if (subscription.status !== 'RUNNING' && subscription.status !== 'MATURED') {
            return NextResponse.json(
                { error: 'Subscription is not active or eligible for withdrawal' },
                { status: 400 }
            );
        }

        // 3. Process Withdrawal (Simplified Synchronous Flow for MVP)
        // In a real system, this would likely trigger an async job to exit positions.
        // Here we simulate immediate settlement request.

        const now = new Date();

        // 4. Update subscription status
        const updatedSubscription = await prisma.managedSubscription.update({
            where: { id },
            data: {
                status: 'SETTLED', // Or 'PROCESSING' if we had a worker
                endAt: now,
                settledAt: now,
                settlement: {
                    create: {
                        status: ManagedSettlementStatus.COMPLETED,
                        principal: subscription.principal,
                        finalEquity: subscription.currentEquity || subscription.principal, // Use current equity
                        grossPnl: (subscription.currentEquity || subscription.principal) - subscription.principal,
                        highWaterMark: subscription.highWaterMark,
                        hwmEligibleProfit: Math.max(0, (subscription.currentEquity || subscription.principal) - subscription.highWaterMark),
                        performanceFeeRate: subscription.term.performanceFeeRate ?? subscription.product.performanceFeeRate,
                        performanceFee: 0, // Simplified: Calculate actual fee based on profit
                        finalPayout: subscription.currentEquity || subscription.principal, // Simplified: After fees
                        settledAt: now,
                    }
                }
            },
            include: {
                settlement: true
            }
        });

        return NextResponse.json({
            success: true,
            subscription: updatedSubscription,
            message: 'Withdrawal processed successfully'
        });

    } catch (error) {
        console.error('Failed to process withdrawal:', error);
        return NextResponse.json(
            { error: 'Failed to process withdrawal' },
            { status: 500 }
        );
    }
}
