import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { z } from 'zod';
import { releaseManagedPrincipalReservation } from '@/lib/managed-wealth/principal-reservation';

export const dynamic = 'force-dynamic';

const cancelSchema = z.object({
    reason: z.string().min(1).max(500).optional().default('Admin cancellation'),
});

/**
 * POST /api/managed-subscriptions/[id]/cancel
 *
 * Cancel a PENDING subscription and release its reserved principal.
 * Only PENDING subscriptions can be cancelled (RUNNING subscriptions
 * must go through the withdraw flow instead).
 */
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

        const body = await request.json().catch(() => ({}));
        const validation = cancelSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.format() },
                { status: 400 }
            );
        }

        const now = new Date();

        const result = await prisma.$transaction(async (tx) => {
            const subscription = await tx.managedSubscription.findUnique({
                where: { id },
                include: {
                    settlement: { select: { status: true } },
                },
            });

            if (!subscription) {
                throw Object.assign(new Error('Subscription not found'), { status: 404 });
            }

            if (subscription.status !== 'PENDING') {
                throw Object.assign(
                    new Error(`Only PENDING subscriptions can be cancelled (current: ${subscription.status})`),
                    { status: 400 }
                );
            }

            if (subscription.settlement?.status === 'COMPLETED') {
                throw Object.assign(
                    new Error('Subscription already settled'),
                    { status: 409 }
                );
            }

            // Release reserved principal
            await releaseManagedPrincipalReservation(tx, {
                subscriptionId: subscription.id,
                walletAddress: subscription.walletAddress,
                amount: subscription.principal,
                note: `MANAGED_SUBSCRIPTION_CANCELLED:${validation.data.reason}`,
            });

            // Mark as cancelled
            const updated = await tx.managedSubscription.update({
                where: { id },
                data: {
                    status: 'CANCELLED',
                    settledAt: now,
                },
            });

            return updated;
        });

        return NextResponse.json({
            success: true,
            subscription: result,
            message: 'Subscription cancelled and principal released',
        });
    } catch (error) {
        const status = (error as { status?: number }).status;
        if (status && status >= 400 && status < 500) {
            return NextResponse.json(
                { error: (error as Error).message },
                { status }
            );
        }

        console.error('Failed to cancel subscription:', error);
        return NextResponse.json(
            { error: 'Failed to cancel subscription' },
            { status: 500 }
        );
    }
}
