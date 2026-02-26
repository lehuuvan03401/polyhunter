import { Prisma } from '@prisma/client';
import type {
    ManagedCommissionStatus,
    ManagedSubscriptionStatus,
    PrismaClient,
} from '@prisma/client';
import { calculateManagedSettlement, calculateReserveBalance } from './settlement-math';
import type { ParticipationProfitFeeScope } from '@/lib/participation-program/fee-scope';
import { releaseManagedPrincipalReservation } from './principal-reservation';

type SettlementModelDelegates = Pick<
    PrismaClient,
    | 'managedSubscription'
    | 'managedSettlement'
    | 'reserveFundLedger'
    | 'managedPrincipalReservationLedger'
    | 'netDepositLedger'
>;

type LiquidationModelDelegates = Pick<
    PrismaClient,
    'managedSubscription' | 'copyTradingConfig'
>;

type SettlementExecutionDelegates = Pick<
    PrismaClient,
    'managedSettlementExecution'
>;

type SettlementSubscription = Prisma.ManagedSubscriptionGetPayload<{
    include: {
        term: {
            select: {
                minYieldRate: true;
                performanceFeeRate: true;
            };
        };
        product: {
            select: {
                isGuaranteed: true;
                performanceFeeRate: true;
            };
        };
        settlement: {
            select: {
                id: true;
                status: true;
            };
        };
    };
}>;

export type ManagedSettlementRecord = Prisma.ManagedSettlementGetPayload<{
    select: {
        id: true;
        status: true;
        principal: true;
        finalEquity: true;
        grossPnl: true;
        highWaterMark: true;
        hwmEligibleProfit: true;
        performanceFeeRate: true;
        performanceFee: true;
        guaranteedPayout: true;
        reserveTopup: true;
        finalPayout: true;
        settledAt: true;
        errorMessage: true;
    };
}>;

export type ManagedSettlementMutationResult =
    | {
        status: 'NOT_FOUND';
    }
    | {
        status: 'SKIPPED_ALREADY_SETTLED';
        subscription: SettlementSubscription;
    }
    | {
        status: 'COMPLETED';
        subscription: SettlementSubscription;
        settlement: ManagedSettlementRecord;
        guaranteeEligible: boolean;
    };

export type ManagedSettlementMutationOptions = {
    subscriptionId: string;
    now: Date;
    guaranteeEligibleOverride?: boolean;
    finalPayoutOverride?: number;
    reserveTopupNote: string;
    endAtNow?: boolean;
    preserveUnmaturedOnNonGuaranteed?: boolean;
};

export function resolveEffectivePerformanceFeeRate(input: {
    baseRate: number;
    isTrial: boolean;
    trialEndsAt?: Date | null;
    endAt?: Date | null;
}): number {
    if (!input.isTrial) return input.baseRate;
    if (!input.trialEndsAt || !input.endAt) return input.baseRate;
    return input.endAt.getTime() <= input.trialEndsAt.getTime() ? 0 : input.baseRate;
}

export function resolveGuaranteeEligible(
    subscription: Pick<SettlementSubscription, 'status' | 'endAt' | 'product'>,
    now: Date
): boolean {
    const maturedByTime = Boolean(subscription.endAt && subscription.endAt <= now);
    return Boolean(
        subscription.product.isGuaranteed &&
        (subscription.status === 'MATURED' || maturedByTime)
    );
}

export function calculateSettlementForSubscription(
    subscription: Pick<
        SettlementSubscription,
        | 'principal'
        | 'currentEquity'
        | 'highWaterMark'
        | 'isTrial'
        | 'trialEndsAt'
        | 'endAt'
        | 'term'
        | 'product'
        | 'status'
    >,
    now: Date,
    guaranteeEligibleOverride?: boolean
) {
    const guaranteeEligible =
        guaranteeEligibleOverride ?? resolveGuaranteeEligible(subscription, now);

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

    return {
        settlementCalc,
        guaranteeEligible,
    };
}

export async function transitionSubscriptionToLiquidatingIfNeeded(
    db: LiquidationModelDelegates,
    input: {
        subscriptionId: string;
        currentStatus: ManagedSubscriptionStatus;
        copyConfigId?: string | null;
    }
): Promise<boolean> {
    if (input.currentStatus === 'LIQUIDATING') {
        return false;
    }

    await db.managedSubscription.update({
        where: { id: input.subscriptionId },
        data: { status: 'LIQUIDATING' },
    });

    if (input.copyConfigId) {
        try {
            await db.copyTradingConfig.update({
                where: { id: input.copyConfigId },
                data: { isActive: false },
            });
        } catch (error) {
            if (
                !(error instanceof Prisma.PrismaClientKnownRequestError)
                || error.code !== 'P2025'
            ) {
                throw error;
            }
        }
    }

    return true;
}

async function getReserveBalance(db: SettlementModelDelegates): Promise<number> {
    const rows = await db.reserveFundLedger.findMany({
        select: { entryType: true, amount: true },
    });
    return calculateReserveBalance(rows);
}

async function loadSubscriptionForSettlement(
    db: SettlementModelDelegates,
    subscriptionId: string
): Promise<SettlementSubscription | null> {
    return db.managedSubscription.findUnique({
        where: { id: subscriptionId },
        include: {
            term: {
                select: {
                    minYieldRate: true,
                    performanceFeeRate: true,
                },
            },
            product: {
                select: {
                    isGuaranteed: true,
                    performanceFeeRate: true,
                },
            },
            settlement: {
                select: {
                    id: true,
                    status: true,
                },
            },
        },
    });
}

export async function applyManagedSettlementMutation(
    db: SettlementModelDelegates,
    options: ManagedSettlementMutationOptions
): Promise<ManagedSettlementMutationResult> {
    const subscription = await loadSubscriptionForSettlement(db, options.subscriptionId);
    if (!subscription) {
        return { status: 'NOT_FOUND' };
    }

    if (subscription.settlement?.status === 'COMPLETED') {
        await releaseManagedPrincipalReservation(db, {
            walletAddress: subscription.walletAddress,
            subscriptionId: subscription.id,
            amount: subscription.principal,
            note: 'MANAGED_SUBSCRIPTION_SETTLED',
        });
        return {
            status: 'SKIPPED_ALREADY_SETTLED',
            subscription,
        };
    }

    const { settlementCalc, guaranteeEligible } = calculateSettlementForSubscription(
        subscription,
        options.now,
        options.guaranteeEligibleOverride
    );

    if (settlementCalc.reserveTopup > 0) {
        const reserveBalance = await getReserveBalance(db);
        await db.reserveFundLedger.create({
            data: {
                entryType: 'GUARANTEE_TOPUP',
                amount: settlementCalc.reserveTopup,
                balanceAfter: reserveBalance - settlementCalc.reserveTopup,
                subscriptionId: subscription.id,
                note: options.reserveTopupNote,
            },
        });
    }

    const settledAt = options.now;
    const finalPayout =
        typeof options.finalPayoutOverride === 'number'
            ? Math.max(0, Number(options.finalPayoutOverride.toFixed(6)))
            : settlementCalc.finalPayout;
    const nextMaturedAt =
        options.preserveUnmaturedOnNonGuaranteed && !guaranteeEligible
            ? subscription.maturedAt
            : (subscription.maturedAt ?? settledAt);

    const settlement = await db.managedSettlement.upsert({
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
            finalPayout,
            settledAt,
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
            finalPayout,
            settledAt,
        },
        select: {
            id: true,
            status: true,
            principal: true,
            finalEquity: true,
            grossPnl: true,
            highWaterMark: true,
            hwmEligibleProfit: true,
            performanceFeeRate: true,
            performanceFee: true,
            guaranteedPayout: true,
            reserveTopup: true,
            finalPayout: true,
            settledAt: true,
            errorMessage: true,
        },
    });

    const updateData: Prisma.ManagedSubscriptionUpdateInput = {
        status: 'SETTLED',
        currentEquity: settlementCalc.finalEquity,
        highWaterMark: Math.max(subscription.highWaterMark, settlementCalc.finalEquity),
        maturedAt: nextMaturedAt,
        settledAt,
    };
    if (options.endAtNow) {
        updateData.endAt = settledAt;
    }

    const updated = await db.managedSubscription.update({
        where: { id: subscription.id },
        data: updateData,
    });

    await releaseManagedPrincipalReservation(db, {
        walletAddress: subscription.walletAddress,
        subscriptionId: subscription.id,
        amount: settlementCalc.principal,
        note: 'MANAGED_SUBSCRIPTION_SETTLED',
    });

    return {
        status: 'COMPLETED',
        subscription: {
            ...subscription,
            ...updated,
        } as SettlementSubscription,
        settlement,
        guaranteeEligible,
    };
}

type ProfitFeeDistributor = (
    walletAddress: string,
    realizedProfit: number,
    tradeId: string,
    options?: { scope?: ParticipationProfitFeeScope }
) => Promise<void>;

const COMMISSION_CLAIMABLE_STATUSES: ManagedCommissionStatus[] = ['PENDING', 'FAILED'];
const FINAL_COMMISSION_STATUSES: ManagedCommissionStatus[] = ['COMPLETED', 'SKIPPED'];
const MAX_COMMISSION_ERROR_LENGTH = 500;

function stringifyCommissionError(error: unknown): string {
    if (error instanceof Error) {
        return error.message.slice(0, MAX_COMMISSION_ERROR_LENGTH);
    }
    return String(error).slice(0, MAX_COMMISSION_ERROR_LENGTH);
}

export type ManagedProfitFeeSettlementResult =
    | {
        status: 'SKIPPED_NON_PROFIT';
        tradeId: string;
    }
    | {
        status: 'SKIPPED_ALREADY_FINALIZED';
        tradeId: string;
        commissionStatus: ManagedCommissionStatus;
    }
    | {
        status: 'SKIPPED_ALREADY_PROCESSING';
        tradeId: string;
    }
    | {
        status: 'COMPLETED';
        tradeId: string;
    };

export async function settleManagedProfitFeeIfNeeded(input: {
    db: SettlementExecutionDelegates;
    distributor: ProfitFeeDistributor;
    walletAddress: string;
    subscriptionId: string;
    settlementId: string;
    grossPnl: number;
    scope?: ParticipationProfitFeeScope;
    sourcePrefix?: string;
}): Promise<ManagedProfitFeeSettlementResult> {
    const realizedProfit = Number(input.grossPnl ?? 0);
    const sourcePrefix = input.sourcePrefix ?? 'managed-withdraw';
    const tradeId = `${sourcePrefix}:${input.subscriptionId}:${input.settlementId}`;

    const execution = await input.db.managedSettlementExecution.upsert({
        where: {
            settlementId: input.settlementId,
        },
        update: {
            subscriptionId: input.subscriptionId,
            walletAddress: input.walletAddress,
            grossPnl: realizedProfit,
            profitFeeTradeId: tradeId,
            profitFeeScope: input.scope ?? 'MANAGED_WITHDRAWAL',
        },
        create: {
            settlementId: input.settlementId,
            subscriptionId: input.subscriptionId,
            walletAddress: input.walletAddress,
            grossPnl: realizedProfit,
            profitFeeTradeId: tradeId,
            profitFeeScope: input.scope ?? 'MANAGED_WITHDRAWAL',
            commissionStatus: realizedProfit > 0 ? 'PENDING' : 'SKIPPED',
            commissionSkippedReason: realizedProfit > 0 ? null : 'NON_PROFITABLE',
        },
        select: {
            commissionStatus: true,
        },
    });

    if (realizedProfit <= 0) {
        if (execution.commissionStatus !== 'SKIPPED') {
            await input.db.managedSettlementExecution.update({
                where: {
                    settlementId: input.settlementId,
                },
                data: {
                    commissionStatus: 'SKIPPED',
                    commissionSkippedReason: 'NON_PROFITABLE',
                    commissionError: null,
                },
            });
        }
        return {
            status: 'SKIPPED_NON_PROFIT',
            tradeId,
        };
    }

    if (FINAL_COMMISSION_STATUSES.includes(execution.commissionStatus)) {
        return {
            status: 'SKIPPED_ALREADY_FINALIZED',
            tradeId,
            commissionStatus: execution.commissionStatus,
        };
    }

    const claim = await input.db.managedSettlementExecution.updateMany({
        where: {
            settlementId: input.settlementId,
            commissionStatus: { in: COMMISSION_CLAIMABLE_STATUSES },
        },
        data: {
            commissionStatus: 'PROCESSING',
            commissionError: null,
            commissionSkippedReason: null,
        },
    });

    if (claim.count === 0) {
        return {
            status: 'SKIPPED_ALREADY_PROCESSING',
            tradeId,
        };
    }

    try {
        await input.distributor(
            input.walletAddress,
            realizedProfit,
            tradeId,
            { scope: input.scope ?? 'MANAGED_WITHDRAWAL' }
        );

        await input.db.managedSettlementExecution.update({
            where: {
                settlementId: input.settlementId,
            },
            data: {
                commissionStatus: 'COMPLETED',
                commissionSettledAt: new Date(),
                commissionError: null,
            },
        });
        return {
            status: 'COMPLETED',
            tradeId,
        };
    } catch (error) {
        await input.db.managedSettlementExecution.update({
            where: {
                settlementId: input.settlementId,
            },
            data: {
                commissionStatus: 'FAILED',
                commissionError: stringifyCommissionError(error),
            },
        });
        throw error;
    }
}
