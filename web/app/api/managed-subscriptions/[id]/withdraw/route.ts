import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { z } from 'zod';
import { resolveWalletContext } from '@/lib/managed-wealth/request-wallet';
import { affiliateEngine } from '@/lib/services/affiliate-engine';
import {
    applyManagedSettlementMutation,
    calculateSettlementForSubscription,
    settleManagedProfitFeeIfNeeded,
    transitionSubscriptionToLiquidatingIfNeeded,
} from '@/lib/managed-wealth/managed-settlement-service';

export const dynamic = 'force-dynamic';

const withdrawSchema = z.object({
    confirm: z.literal(true),
    walletAddress: z.string().min(3),
    acknowledgeEarlyWithdrawalFee: z.boolean().optional(),
});

const ONE_HOUR_MS = 60 * 60 * 1000;
const WITHDRAW_COOLDOWN_HOURS = resolveNumberEnv('MANAGED_WITHDRAW_COOLDOWN_HOURS', 6, 0, 168);
const EARLY_WITHDRAWAL_FEE_RATE = resolveNumberEnv('MANAGED_EARLY_WITHDRAW_FEE_RATE', 0.01, 0, 0.5);
const DRAWDOWN_ALERT_THRESHOLD = resolveNumberEnv('MANAGED_WITHDRAW_DRAWDOWN_ALERT_THRESHOLD', 0.35, 0, 1);

class ApiError extends Error {
    status: number;
    code?: string;
    details?: Record<string, unknown>;

    constructor(
        status: number,
        message: string,
        options?: {
            code?: string;
            details?: Record<string, unknown>;
        }
    ) {
        super(message);
        this.status = status;
        this.code = options?.code;
        this.details = options?.details;
    }
}

function resolveNumberEnv(name: string, fallback: number, min: number, max: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
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
        const acknowledgeEarlyWithdrawalFee = Boolean(validation.data.acknowledgeEarlyWithdrawalFee);

        const walletContext = resolveWalletContext(request, {
            bodyWallet: validation.data.walletAddress,
            requireHeader: true,
            requireSignature: true,
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
            if (subscription.status !== 'RUNNING' && subscription.status !== 'MATURED' && subscription.status !== 'LIQUIDATING') {
                throw new ApiError(400, 'Subscription is not active or eligible for withdrawal');
            }
            if (subscription.settlement?.status === 'COMPLETED') {
                throw new ApiError(409, 'Subscription already settled');
            }

            const maturedByTime = Boolean(subscription.endAt && subscription.endAt <= now);
            const guaranteeEligible = subscription.product.isGuaranteed
                && (subscription.status === 'MATURED' || maturedByTime);
            const isEarlyWithdrawal = Boolean(subscription.status === 'RUNNING' && subscription.endAt && subscription.endAt > now);
            const withdrawStartAt = subscription.startAt ?? subscription.createdAt;
            const cooldownEndsAt = new Date(withdrawStartAt.getTime() + WITHDRAW_COOLDOWN_HOURS * ONE_HOUR_MS);

            if (isEarlyWithdrawal && WITHDRAW_COOLDOWN_HOURS > 0 && now < cooldownEndsAt) {
                const remainingMinutes = Math.max(
                    1,
                    Math.ceil((cooldownEndsAt.getTime() - now.getTime()) / (60 * 1000))
                );
                throw new ApiError(409, 'Early withdrawal cooling period is active', {
                    code: 'WITHDRAW_COOLDOWN_ACTIVE',
                    details: {
                        cooldownHours: WITHDRAW_COOLDOWN_HOURS,
                        cooldownEndsAt,
                        remainingMinutes,
                    },
                });
            }

            const openPositionsCount = await tx.managedSubscriptionPosition.count({
                where: {
                    subscriptionId: subscription.id,
                    balance: { gt: 0 }
                }
            });

            if (openPositionsCount > 0) {
                let updatedSubscription = subscription;
                const transitioned = await transitionSubscriptionToLiquidatingIfNeeded(tx, {
                    subscriptionId: subscription.id,
                    currentStatus: subscription.status,
                    copyConfigId: subscription.copyConfigId,
                });
                if (transitioned) {
                    updatedSubscription = await tx.managedSubscription.findUniqueOrThrow({
                        where: { id: subscription.id },
                        include: {
                            term: true,
                            product: true,
                            settlement: { select: { status: true } }
                        }
                    });
                }

                return {
                    action: 'LIQUIDATE' as const,
                    updatedSubscription,
                };
            }

            const { settlementCalc } = calculateSettlementForSubscription(
                subscription,
                now,
                guaranteeEligible
            );
            const earlyWithdrawalFeeRate = isEarlyWithdrawal ? EARLY_WITHDRAWAL_FEE_RATE : 0;
            const earlyWithdrawalFee = isEarlyWithdrawal
                ? Number((settlementCalc.finalPayout * earlyWithdrawalFeeRate).toFixed(6))
                : 0;
            const finalPayoutAfterFee = Math.max(0, Number((settlementCalc.finalPayout - earlyWithdrawalFee).toFixed(6)));

            if (isEarlyWithdrawal && earlyWithdrawalFee > 0 && !acknowledgeEarlyWithdrawalFee) {
                throw new ApiError(409, 'Early withdrawal fee acknowledgement required', {
                    code: 'EARLY_WITHDRAWAL_FEE_ACK_REQUIRED',
                    details: {
                        earlyWithdrawalFeeRate,
                        earlyWithdrawalFee,
                        estimatedPayoutAfterFee: finalPayoutAfterFee,
                    },
                });
            }

            const settlementResult = await applyManagedSettlementMutation(tx, {
                subscriptionId: subscription.id,
                now,
                guaranteeEligibleOverride: guaranteeEligible,
                finalPayoutOverride: finalPayoutAfterFee,
                reserveTopupNote: 'MANUAL_WITHDRAW_GUARANTEE_TOPUP',
                endAtNow: true,
                preserveUnmaturedOnNonGuaranteed: true,
            });
            if (settlementResult.status === 'NOT_FOUND') {
                throw new ApiError(404, 'Subscription not found');
            }
            if (settlementResult.status === 'SKIPPED_ALREADY_SETTLED') {
                throw new ApiError(409, 'Subscription already settled');
            }

            const drawdownRatio = subscription.principal > 0
                ? Math.max(0, (subscription.principal - settlementCalc.finalEquity) / subscription.principal)
                : 0;
            if (isEarlyWithdrawal && drawdownRatio >= DRAWDOWN_ALERT_THRESHOLD) {
                await tx.managedRiskEvent.create({
                    data: {
                        subscriptionId: subscription.id,
                        severity: 'WARN',
                        metric: 'EARLY_WITHDRAW_DRAWDOWN',
                        threshold: DRAWDOWN_ALERT_THRESHOLD,
                        observedValue: drawdownRatio,
                        action: 'DELEVERAGE',
                        description: 'Early withdrawal requested under elevated drawdown ratio',
                    },
                });
            }

            return {
                action: 'SETTLE' as const,
                updatedSubscription: settlementResult.subscription,
                settlement: settlementResult.settlement,
                guaranteeEligible: settlementResult.guaranteeEligible,
                guardrails: {
                    isEarlyWithdrawal,
                    cooldownHours: WITHDRAW_COOLDOWN_HOURS,
                    earlyWithdrawalFeeRate,
                    earlyWithdrawalFee,
                    finalPayoutBeforeFee: settlementCalc.finalPayout,
                    finalPayoutAfterFee,
                },
            };
        });

        if (result.action === 'LIQUIDATE') {
            return NextResponse.json({
                success: true,
                subscription: result.updatedSubscription,
                message: 'Liquidation process started. Please wait for open positions to be closed.',
                status: 'LIQUIDATING'
            }, { status: 202 });
        }

        const settledResult = result;
        // Do not fail user withdrawal if affiliate distribution path is temporarily unavailable.
        try {
            await settleManagedProfitFeeIfNeeded({
                distributor: async (walletAddress, realizedProfit, tradeId, options) =>
                    affiliateEngine.distributeProfitFee(walletAddress, realizedProfit, tradeId, options),
                walletAddress: walletContext.wallet,
                subscriptionId: settledResult.updatedSubscription.id,
                settlementId: settledResult.settlement.id,
                grossPnl: settledResult.settlement.grossPnl,
                scope: 'MANAGED_WITHDRAWAL',
                sourcePrefix: 'managed-withdraw',
            });
        } catch (affiliateError) {
            console.error('[ManagedWithdraw] Profit fee distribution failed:', affiliateError);
        }

        return NextResponse.json({
            success: true,
            subscription: settledResult.updatedSubscription,
            settlement: settledResult.settlement,
            earlyRedeemed: !settledResult.guaranteeEligible,
            guardrails: settledResult.guardrails,
            message: 'Withdrawal processed successfully',
        });
    } catch (error) {
        if (error instanceof ApiError) {
            return NextResponse.json(
                {
                    error: error.message,
                    ...(error.code ? { code: error.code } : {}),
                    ...(error.details ?? {}),
                },
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
