import { Prisma } from '@prisma/client';
import type { ManagedSubscriptionStatus, PrismaClient } from '@prisma/client';
import { calculateManagedSettlement, calculateReserveBalance } from './settlement-math';
import type { ParticipationProfitFeeScope } from '@/lib/participation-program/fee-scope';

type SettlementModelDelegates = Pick<
    PrismaClient,
    'managedSubscription' | 'managedSettlement' | 'reserveFundLedger'
>;

type LiquidationModelDelegates = Pick<
    PrismaClient,
    'managedSubscription' | 'copyTradingConfig'
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

export async function settleManagedProfitFeeIfNeeded(input: {
    distributor: ProfitFeeDistributor;
    walletAddress: string;
    subscriptionId: string;
    settlementId: string;
    grossPnl: number;
    scope?: ParticipationProfitFeeScope;
    sourcePrefix?: string;
}): Promise<void> {
    const realizedProfit = Number(input.grossPnl ?? 0);
    if (realizedProfit <= 0) return;

    const sourcePrefix = input.sourcePrefix ?? 'managed-withdraw';
    await input.distributor(
        input.walletAddress,
        realizedProfit,
        `${sourcePrefix}:${input.subscriptionId}:${input.settlementId}`,
        { scope: input.scope ?? 'MANAGED_WITHDRAWAL' }
    );
}
