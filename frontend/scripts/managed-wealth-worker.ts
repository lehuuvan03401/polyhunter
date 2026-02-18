import 'dotenv/config';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
    PrismaClient,
} from '@prisma/client';
import {
    calculateCoverageRatio,
    calculateGuaranteeLiability,
    calculateManagedSettlement,
    calculateReserveBalance,
} from '../lib/managed-wealth/settlement-math';

const DATABASE_URL = process.env.DATABASE_URL || '';
if (!DATABASE_URL) {
    console.error('[ManagedWealthWorker] Missing DATABASE_URL');
    process.exit(1);
}

const RUN_ONCE = process.env.MANAGED_WEALTH_RUN_ONCE === 'true';
const LOOP_INTERVAL_MS = Math.max(10_000, Number(process.env.MANAGED_WEALTH_LOOP_INTERVAL_MS || 60_000));
const MAP_BATCH_SIZE = Math.max(1, Number(process.env.MANAGED_WEALTH_MAP_BATCH_SIZE || 100));
const NAV_BATCH_SIZE = Math.max(1, Number(process.env.MANAGED_WEALTH_NAV_BATCH_SIZE || 500));
const SETTLEMENT_BATCH_SIZE = Math.max(1, Number(process.env.MANAGED_WEALTH_SETTLEMENT_BATCH_SIZE || 300));

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

let running = false;

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

async function getReserveBalance(tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>): Promise<number> {
    const rows = await tx.reserveFundLedger.findMany({
        select: { entryType: true, amount: true },
    });
    return calculateReserveBalance(rows);
}

async function ensureExecutionMappings(now: Date): Promise<number> {
    const candidates = await prisma.managedSubscription.findMany({
        where: {
            status: { in: ['PENDING', 'RUNNING'] },
            copyConfigId: null,
            product: {
                isActive: true,
                status: 'ACTIVE',
            },
        },
        include: {
            product: {
                include: {
                    agents: {
                        include: { agent: true },
                        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
                    },
                },
            },
            term: true,
        },
        orderBy: { createdAt: 'asc' },
        take: MAP_BATCH_SIZE,
    });

    let mapped = 0;
    for (const sub of candidates) {
        const primaryAgent = sub.product.agents[0]?.agent;
        if (!primaryAgent) {
            console.warn(`[ManagedWealthWorker] No agent mapping found for product ${sub.productId}; skip ${sub.id}`);
            continue;
        }

        const existingConfig = await prisma.copyTradingConfig.findFirst({
            where: {
                walletAddress: sub.walletAddress,
                traderAddress: primaryAgent.traderAddress.toLowerCase(),
                agentId: primaryAgent.id,
                isActive: true,
            },
            select: { id: true },
        });

        const configId = existingConfig?.id ?? (
            await prisma.copyTradingConfig.create({
                data: {
                    walletAddress: sub.walletAddress,
                    traderAddress: primaryAgent.traderAddress.toLowerCase(),
                    traderName: primaryAgent.traderName ?? primaryAgent.name,
                    strategyProfile: sub.product.strategyProfile,
                    mode: primaryAgent.mode,
                    sizeScale: primaryAgent.sizeScale,
                    fixedAmount: primaryAgent.fixedAmount,
                    maxSizePerTrade: primaryAgent.maxSizePerTrade,
                    minSizePerTrade: primaryAgent.minSizePerTrade,
                    stopLoss: primaryAgent.stopLoss,
                    takeProfit: primaryAgent.takeProfit,
                    maxOdds: primaryAgent.maxOdds,
                    minLiquidity: primaryAgent.minLiquidity,
                    minVolume: primaryAgent.minVolume,
                    sellMode: primaryAgent.sellMode,
                    autoExecute: true,
                    channel: 'EVENT_LISTENER',
                    executionMode: 'PROXY',
                    direction: 'COPY',
                    slippageType: 'AUTO',
                    maxSlippage: 2,
                    isActive: true,
                    agentId: primaryAgent.id,
                },
                select: { id: true },
            })
        ).id;

        await prisma.managedSubscription.update({
            where: { id: sub.id },
            data: {
                copyConfigId: configId,
                status: 'RUNNING',
                startAt: sub.startAt ?? now,
                endAt: sub.endAt ?? new Date(now.getTime() + sub.term.durationDays * 24 * 60 * 60 * 1000),
            },
        });

        mapped += 1;
    }

    return mapped;
}

async function refreshNavSnapshots(now: Date): Promise<number> {
    const snapshotAt = new Date(Math.floor(now.getTime() / 60_000) * 60_000);

    const runningSubs = await prisma.managedSubscription.findMany({
        where: {
            status: 'RUNNING',
            copyConfigId: { not: null },
        },
        select: {
            id: true,
            principal: true,
            highWaterMark: true,
            currentEquity: true,
            copyConfigId: true,
        },
        take: NAV_BATCH_SIZE,
    });

    let updated = 0;

    for (const sub of runningSubs) {
        if (!sub.copyConfigId) continue;

        const [tradeAgg, previousSnapshot, peakAgg] = await Promise.all([
            prisma.copyTrade.aggregate({
                where: {
                    configId: sub.copyConfigId,
                    status: 'EXECUTED',
                },
                _sum: {
                    realizedPnL: true,
                },
            }),
            prisma.managedNavSnapshot.findFirst({
                where: { subscriptionId: sub.id },
                orderBy: { snapshotAt: 'desc' },
                select: {
                    equity: true,
                    snapshotAt: true,
                },
            }),
            prisma.managedNavSnapshot.aggregate({
                where: { subscriptionId: sub.id },
                _max: { nav: true },
            }),
        ]);

        const realizedPnl = Number(tradeAgg._sum.realizedPnL ?? 0);
        const equity = Number((sub.principal + realizedPnl).toFixed(8));
        const nav = sub.principal > 0 ? equity / sub.principal : 1;

        const prevEquity = previousSnapshot?.equity ?? sub.principal;
        const periodReturn = prevEquity > 0 ? (equity - prevEquity) / prevEquity : 0;
        const cumulativeReturn = sub.principal > 0 ? (equity - sub.principal) / sub.principal : 0;

        const peakNav = Math.max(Number(peakAgg._max.nav ?? 1), nav);
        const drawdown = peakNav > 0 ? (peakNav - nav) / peakNav : 0;

        await prisma.managedNavSnapshot.upsert({
            where: {
                subscriptionId_snapshotAt: {
                    subscriptionId: sub.id,
                    snapshotAt,
                },
            },
            update: {
                nav,
                equity,
                periodReturn,
                cumulativeReturn,
                drawdown,
                isFallbackPrice: true,
                priceSource: 'REALIZED_PNL_ONLY',
            },
            create: {
                subscriptionId: sub.id,
                snapshotAt,
                nav,
                equity,
                periodReturn,
                cumulativeReturn,
                drawdown,
                volatility: 0,
                isFallbackPrice: true,
                priceSource: 'REALIZED_PNL_ONLY',
            },
        });

        await prisma.managedSubscription.update({
            where: { id: sub.id },
            data: {
                currentEquity: equity,
                highWaterMark: Math.max(sub.highWaterMark, equity),
            },
        });

        updated += 1;
    }

    return updated;
}

async function markMaturedSubscriptions(now: Date): Promise<number> {
    const matured = await prisma.managedSubscription.updateMany({
        where: {
            status: 'RUNNING',
            endAt: { lte: now },
        },
        data: {
            status: 'MATURED',
            maturedAt: now,
        },
    });

    return matured.count;
}

async function settleMaturedSubscriptions(now: Date): Promise<number> {
    const candidates = await prisma.managedSubscription.findMany({
        where: {
            status: { in: ['MATURED', 'RUNNING'] },
            endAt: { lte: now },
        },
        include: {
            product: {
                select: {
                    id: true,
                    isGuaranteed: true,
                    performanceFeeRate: true,
                },
            },
            term: {
                select: {
                    minYieldRate: true,
                    performanceFeeRate: true,
                },
            },
            settlement: {
                select: { id: true, status: true },
            },
        },
        orderBy: { endAt: 'asc' },
        take: SETTLEMENT_BATCH_SIZE,
    });

    let settled = 0;

    for (const sub of candidates) {
        if (sub.settlement?.status === 'COMPLETED') continue;

        const settlementCalc = calculateManagedSettlement({
            principal: sub.principal,
            finalEquity: Number(sub.currentEquity ?? sub.principal),
            highWaterMark: sub.highWaterMark,
            performanceFeeRate: resolveEffectivePerformanceFeeRate({
                baseRate: Number(sub.term.performanceFeeRate ?? sub.product.performanceFeeRate),
                isTrial: Boolean(sub.isTrial),
                trialEndsAt: sub.trialEndsAt,
                endAt: sub.endAt,
            }),
            isGuaranteed: sub.product.isGuaranteed,
            minYieldRate: sub.term.minYieldRate,
        });

        await prisma.$transaction(async (tx) => {
            const current = await tx.managedSubscription.findUnique({
                where: { id: sub.id },
                include: {
                    settlement: {
                        select: { status: true },
                    },
                },
            });

            if (!current) return;
            if (current.settlement?.status === 'COMPLETED') return;

            if (settlementCalc.reserveTopup > 0) {
                const reserveBalance = await getReserveBalance(tx);
                await tx.reserveFundLedger.create({
                    data: {
                        entryType: 'GUARANTEE_TOPUP',
                        amount: settlementCalc.reserveTopup,
                        balanceAfter: reserveBalance - settlementCalc.reserveTopup,
                        subscriptionId: sub.id,
                        note: 'WORKER_AUTO_SETTLEMENT_GUARANTEE_TOPUP',
                    },
                });
            }

            await tx.managedSettlement.upsert({
                where: { subscriptionId: sub.id },
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
                    subscriptionId: sub.id,
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

            await tx.managedSubscription.update({
                where: { id: sub.id },
                data: {
                    status: 'SETTLED',
                    maturedAt: current.maturedAt ?? now,
                    settledAt: now,
                    currentEquity: settlementCalc.finalEquity,
                    highWaterMark: Math.max(current.highWaterMark, settlementCalc.finalEquity),
                },
            });
        });

        settled += 1;
    }

    return settled;
}

async function enforceGuaranteedPause(): Promise<number> {
    const guaranteedProducts = await prisma.managedProduct.findMany({
        where: {
            isGuaranteed: true,
            isActive: true,
        },
        select: {
            id: true,
            status: true,
            reserveCoverageMin: true,
        },
    });

    if (guaranteedProducts.length === 0) return 0;

    const reserveBalance = await getReserveBalance(prisma);
    let changed = 0;

    for (const product of guaranteedProducts) {
        const liabilities = await prisma.managedSubscription.findMany({
            where: {
                productId: product.id,
                status: { in: ['PENDING', 'RUNNING', 'MATURED'] },
            },
            select: {
                principal: true,
                term: { select: { minYieldRate: true } },
            },
        });

        const guaranteedLiability = liabilities.reduce(
            (acc, sub) => acc + calculateGuaranteeLiability(sub.principal, sub.term.minYieldRate),
            0
        );

        const coverageRatio = calculateCoverageRatio(reserveBalance, guaranteedLiability);

        const shouldPause = coverageRatio < product.reserveCoverageMin;
        const nextStatus = shouldPause ? 'PAUSED' : 'ACTIVE';

        if (nextStatus !== product.status) {
            await prisma.managedProduct.update({
                where: { id: product.id },
                data: { status: nextStatus },
            });
            changed += 1;
        }
    }

    return changed;
}

async function runCycle(): Promise<void> {
    if (running) {
        console.warn('[ManagedWealthWorker] Previous cycle still running, skip this tick.');
        return;
    }

    running = true;
    const started = Date.now();
    const now = new Date();

    try {
        const mapped = await ensureExecutionMappings(now);
        const navUpdated = await refreshNavSnapshots(now);
        const matured = await markMaturedSubscriptions(now);
        const settled = await settleMaturedSubscriptions(now);
        const pausedOrResumed = await enforceGuaranteedPause();

        const durationMs = Date.now() - started;
        console.log(
            `[ManagedWealthWorker] cycle done in ${durationMs}ms | mapped=${mapped} nav=${navUpdated} matured=${matured} settled=${settled} statusChanges=${pausedOrResumed}`
        );
    } catch (error) {
        console.error('[ManagedWealthWorker] cycle failed:', error);
    } finally {
        running = false;
    }
}

async function shutdown(signal: string): Promise<void> {
    console.log(`\n[ManagedWealthWorker] received ${signal}, shutting down...`);
    await prisma.$disconnect();
    await pool.end();
    process.exit(0);
}

process.on('SIGINT', () => {
    void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});

async function main(): Promise<void> {
    console.log(`[ManagedWealthWorker] start | runOnce=${RUN_ONCE} intervalMs=${LOOP_INTERVAL_MS}`);

    await runCycle();

    if (RUN_ONCE) {
        await shutdown('RUN_ONCE_COMPLETE');
        return;
    }

    setInterval(() => {
        void runCycle();
    }, LOOP_INTERVAL_MS);
}

void main();
