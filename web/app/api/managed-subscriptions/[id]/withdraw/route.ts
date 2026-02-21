import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { z } from 'zod';
import { calculateManagedSettlement, calculateReserveBalance } from '@/lib/managed-wealth/settlement-math';
import { resolveWalletContext } from '@/lib/managed-wealth/request-wallet';

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

function resolveEffectivePerformanceFeeRate(input: {
    baseRate: number;
    isTrial: boolean;
    trialEndsAt?: Date | null;
    endAt?: Date | null;
}): number {
    if (!input.isTrial) return input.baseRate;
    if (!input.trialEndsAt || !input.endAt) return input.baseRate;
    return input.endAt.getTime() <= input.trialEndsAt.getTime() ? 0 : input.baseRate;
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
            if (subscription.status !== 'RUNNING' && subscription.status !== 'MATURED') {
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

            const settlementCalc = calculateManagedSettlement({
                principal: subscription.principal,
                finalEquity: Number(subscription.currentEquity ?? subscription.principal),
                highWaterMark: subscription.highWaterMark,
                performanceFeeRate: resolveEffectivePerformanceFeeRate({
                    baseRate: Number(subscription.term.performanceFeeRate ?? subscription.product.performanceFeeRate),
                    isTrial: Boolean(subscription.isTrial),
                    trialEndsAt: subscription.trialEndsAt,
                    endAt: subscription.endAt,
                }),
                isGuaranteed: guaranteeEligible,
                minYieldRate: guaranteeEligible ? subscription.term.minYieldRate : null,
            });
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
                    finalPayout: finalPayoutAfterFee,
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
                    finalPayout: finalPayoutAfterFee,
                    settledAt: now,
                },
            });

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

        return NextResponse.json({
            success: true,
            subscription: result.updatedSubscription,
            settlement: result.settlement,
            earlyRedeemed: !result.guaranteeEligible,
            guardrails: result.guardrails,
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
