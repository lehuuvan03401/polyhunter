import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { z } from 'zod';
import { calculateManagedSettlement, calculateReserveBalance } from '@/lib/managed-wealth/settlement-math';
import { resolveWalletContext } from '@/lib/managed-wealth/request-wallet';

export const dynamic = 'force-dynamic';

const withdrawSchema = z.object({
    confirm: z.literal(true),
    walletAddress: z.string().min(3),
});

class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

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

        const body = await request.json().catch(() => null);
        const validation = withdrawSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Withdrawal must be confirmed with walletAddress', details: validation.error.format() },
                { status: 400 }
            );
        }

        const walletContext = resolveWalletContext(request, {
            bodyWallet: validation.data.walletAddress,
            requireHeader: true,
        });
        if (!walletContext.ok) {
            return NextResponse.json(
                { error: walletContext.error },
                { status: walletContext.status }
            );
        }

        const now = new Date();

        const result = await prisma.$transaction(async (tx) => {
            const subscription = await tx.managedSubscription.findUnique({
                where: { id },
                include: {
                    term: true,
                    product: true,
                    settlement: {
                        select: { status: true },
                    },
                },
            });

            if (!subscription) {
                throw new ApiError(404, 'Subscription not found');
            }
            if (subscription.walletAddress !== walletContext.wallet) {
                throw new ApiError(403, 'Subscription does not belong to wallet');
            }
            if (subscription.status !== 'RUNNING' && subscription.status !== 'MATURED') {
                throw new ApiError(400, 'Subscription is not active or eligible for withdrawal');
            }
            if (subscription.settlement?.status === 'COMPLETED') {
                throw new ApiError(409, 'Subscription already settled');
            }

            const maturedByTime = Boolean(subscription.endAt && subscription.endAt <= now);
            const guaranteeEligible = subscription.product.isGuaranteed
                && (subscription.status === 'MATURED' || maturedByTime);

            const settlementCalc = calculateManagedSettlement({
                principal: subscription.principal,
                finalEquity: Number(subscription.currentEquity ?? subscription.principal),
                highWaterMark: subscription.highWaterMark,
                performanceFeeRate: Number(subscription.term.performanceFeeRate ?? subscription.product.performanceFeeRate),
                isGuaranteed: guaranteeEligible,
                minYieldRate: guaranteeEligible ? subscription.term.minYieldRate : null,
            });

            if (settlementCalc.reserveTopup > 0) {
                const reserveRows = await tx.reserveFundLedger.findMany({
                    select: { entryType: true, amount: true },
                });
                const reserveBalance = calculateReserveBalance(reserveRows);
                const nextBalance = reserveBalance - settlementCalc.reserveTopup;

                await tx.reserveFundLedger.create({
                    data: {
                        entryType: 'GUARANTEE_TOPUP',
                        amount: settlementCalc.reserveTopup,
                        balanceAfter: nextBalance,
                        subscriptionId: subscription.id,
                        note: 'MANUAL_WITHDRAW_GUARANTEE_TOPUP',
                    },
                });
            }

            const settlement = await tx.managedSettlement.upsert({
                where: { subscriptionId: subscription.id },
                update: {
                    status: 'COMPLETED',
                    principal: settlementCalc.principal,
                    finalEquity: settlementCalc.finalEquity,
                    grossPnl: settlementCalc.grossPnl,
                    highWaterMark: settlementCalc.highWaterMark,
                    hwmEligibleProfit: settlementCalc.hwmEligibleProfit,
                    performanceFeeRate: settlementCalc.performanceFeeRate,
                    performanceFee: settlementCalc.performanceFee,
                    guaranteedPayout: settlementCalc.guaranteedPayout,
                    reserveTopup: settlementCalc.reserveTopup,
                    finalPayout: settlementCalc.finalPayout,
                    settledAt: now,
                    errorMessage: null,
                },
                create: {
                    subscriptionId: subscription.id,
                    status: 'COMPLETED',
                    principal: settlementCalc.principal,
                    finalEquity: settlementCalc.finalEquity,
                    grossPnl: settlementCalc.grossPnl,
                    highWaterMark: settlementCalc.highWaterMark,
                    hwmEligibleProfit: settlementCalc.hwmEligibleProfit,
                    performanceFeeRate: settlementCalc.performanceFeeRate,
                    performanceFee: settlementCalc.performanceFee,
                    guaranteedPayout: settlementCalc.guaranteedPayout,
                    reserveTopup: settlementCalc.reserveTopup,
                    finalPayout: settlementCalc.finalPayout,
                    settledAt: now,
                },
            });

            const updatedSubscription = await tx.managedSubscription.update({
                where: { id: subscription.id },
                data: {
                    status: 'SETTLED',
                    currentEquity: settlementCalc.finalEquity,
                    highWaterMark: Math.max(subscription.highWaterMark, settlementCalc.finalEquity),
                    maturedAt: guaranteeEligible ? (subscription.maturedAt ?? now) : subscription.maturedAt,
                    settledAt: now,
                    endAt: now,
                },
            });

            return {
                updatedSubscription,
                settlement,
                guaranteeEligible,
            };
        });

        return NextResponse.json({
            success: true,
            subscription: result.updatedSubscription,
            settlement: result.settlement,
            earlyRedeemed: !result.guaranteeEligible,
            message: 'Withdrawal processed successfully',
        });
    } catch (error) {
        if (error instanceof ApiError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status }
            );
        }

        console.error('Failed to process withdrawal:', error);
        return NextResponse.json(
            { error: 'Failed to process withdrawal' },
            { status: 500 }
        );
    }
}
