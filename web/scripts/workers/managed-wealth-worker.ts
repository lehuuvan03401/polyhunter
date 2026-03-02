import 'dotenv/config';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
    Prisma,
    PrismaClient,
    type AgentTemplate
} from '@prisma/client';
import {
    buildManagedAllocationSeed,
    buildManagedAllocationSnapshot,
    buildManagedTemplateCandidates,
} from '../../lib/managed-wealth/allocation-service';
import {
    calculateCoverageRatio,
    calculateGuaranteeLiability,
    calculateReserveBalance,
} from '../../lib/managed-wealth/settlement-math';
import {
    applyManagedSettlementMutation,
    transitionSubscriptionToLiquidatingIfNeeded,
} from '../../lib/managed-wealth/managed-settlement-service';
import { finalizeManagedSettlementEntry } from '../../lib/managed-wealth/managed-settlement-entrypoint';
import {
    countManagedOpenPositionsWithFallback,
    listManagedOpenPositionsWithFallback,
} from '../../lib/managed-wealth/subscription-position-scope';
import { resolveManagedExecutionConfigIds } from '../../lib/managed-wealth/execution-targets';
import { resolveManagedLiquidationIntent } from '../../lib/managed-wealth/liquidation-intent';
import { polyClient } from '../../lib/polymarket';
import { affiliateEngine } from '../../lib/services/affiliate-engine';

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
const LIQUIDATION_RETRY_BASE_MS = Math.max(10_000, Number(process.env.MANAGED_LIQUIDATION_RETRY_BASE_MS || 120_000));
const MANAGED_ALLOCATION_TARGET_COUNT = Math.max(1, Number(process.env.MANAGED_ALLOCATION_TARGET_COUNT || 3));
const MANAGED_ALLOCATION_SNAPSHOT_ENABLED = process.env.MANAGED_ALLOCATION_SNAPSHOT_ENABLED !== 'false';

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

let running = false;

async function getReserveBalance(tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>): Promise<number> {
    const rows = await tx.reserveFundLedger.findMany({
        select: { entryType: true, amount: true },
    });
    return calculateReserveBalance(rows);
}

function extractSelectedTargetWeights(
    selectedWeights: unknown
): Array<{ address: string; weight: number }> {
    if (!Array.isArray(selectedWeights) || selectedWeights.length === 0) {
        return [];
    }

    return selectedWeights.flatMap((row) => {
        if (typeof row !== 'object' || row === null) {
            return [];
        }

        const candidate = row as {
            address?: unknown;
            weight?: unknown;
        };
        if (typeof candidate.address !== 'string') {
            return [];
        }

        const weight = Number(candidate.weight ?? 0);
        return [{
            address: candidate.address.toLowerCase(),
            weight: Number.isFinite(weight) && weight > 0 ? weight : 0,
        }];
    });
}

async function ensureExecutionMappings(now: Date): Promise<number> {
    const candidates = await prisma.managedSubscription.findMany({
        where: {
            status: { in: ['PENDING', 'RUNNING'] },
            OR: [
                { copyConfigId: null },
                {
                    executionTargets: {
                        none: {
                            isActive: true,
                        },
                    },
                },
                {
                    allocations: {
                        some: {
                            status: 'ACTIVE',
                            version: {
                                gt: 1,
                            },
                        },
                    },
                },
            ],
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
        const activeExecutionTargets = await prisma.managedSubscriptionExecutionTarget.findMany({
            where: {
                subscriptionId: sub.id,
                isActive: true,
            },
            orderBy: [
                { isPrimary: 'desc' },
                { targetOrder: 'asc' },
                { createdAt: 'asc' },
            ],
            select: {
                copyConfigId: true,
                allocationVersion: true,
                targetWeight: true,
                targetOrder: true,
                isPrimary: true,
                copyConfig: {
                    select: {
                        traderAddress: true,
                        agentId: true,
                    },
                },
            },
        });
        const existingAllocation = MANAGED_ALLOCATION_SNAPSHOT_ENABLED
            ? await prisma.managedSubscriptionAllocation.findFirst({
                where: {
                    subscriptionId: sub.id,
                    status: 'ACTIVE',
                },
                orderBy: { version: 'desc' },
                select: {
                    version: true,
                    selectedWeights: true,
                },
            })
            : null;
        const existingAllocationTargets = extractSelectedTargetWeights(existingAllocation?.selectedWeights);

        if (
            sub.copyConfigId &&
            activeExecutionTargets.length === 0 &&
            existingAllocationTargets.length <= 1
        ) {
            await prisma.managedSubscriptionExecutionTarget.upsert({
                where: {
                    subscriptionId_copyConfigId: {
                        subscriptionId: sub.id,
                        copyConfigId: sub.copyConfigId,
                    },
                },
                update: {
                    targetWeight: 1,
                    targetOrder: 0,
                    isPrimary: true,
                    isActive: true,
                    deactivatedAt: null,
                },
                create: {
                    subscriptionId: sub.id,
                    copyConfigId: sub.copyConfigId,
                    targetWeight: 1,
                    targetOrder: 0,
                    isPrimary: true,
                    isActive: true,
                    activatedAt: now,
                },
            });
            await prisma.managedSubscription.update({
                where: { id: sub.id },
                data: {
                    status: 'RUNNING',
                    startAt: sub.startAt ?? now,
                    endAt: sub.endAt ?? new Date(now.getTime() + sub.term.durationDays * 24 * 60 * 60 * 1000),
                },
            });
            mapped += 1;
            continue;
        }

        let desiredTargets: Array<{
            agent: AgentTemplate;
            weight: number;
        }> = [];
        let allocationVersion: number | null = null;

        if (MANAGED_ALLOCATION_SNAPSHOT_ENABLED) {
            const templateCandidates = buildManagedTemplateCandidates({
                strategyProfile: sub.product.strategyProfile,
                templates: sub.product.agents.map((item) => ({
                    traderAddress: item.agent.traderAddress,
                    name: item.agent.name,
                    traderName: item.agent.traderName,
                    profileImage: item.agent.avatarUrl,
                    weight: item.weight,
                    isPrimary: item.isPrimary,
                })),
            });
            if (templateCandidates.length === 0) {
                console.warn(`[ManagedWealthWorker] No agent mapping found for product ${sub.productId}; skip ${sub.id}`);
                continue;
            }

            allocationVersion = existingAllocation?.version ?? null;
            desiredTargets = existingAllocationTargets
                .map((target) => {
                    const agent = sub.product.agents.find(
                        (item) => item.agent.traderAddress.toLowerCase() === target.address
                    )?.agent ?? null;

                    if (!agent) {
                        return null;
                    }

                    return {
                        agent,
                        weight: target.weight > 0 ? target.weight : 0,
                    };
                })
                .filter((target): target is NonNullable<typeof target> => target !== null);

            if (desiredTargets.length === 0) {
                const versionAgg = await prisma.managedSubscriptionAllocation.aggregate({
                    where: { subscriptionId: sub.id },
                    _max: { version: true },
                });
                const nextVersion = Number(versionAgg._max.version ?? 0) + 1;
                const seed = buildManagedAllocationSeed({
                    subscriptionId: sub.id,
                    version: nextVersion,
                    walletAddress: sub.walletAddress,
                    strategyProfile: sub.product.strategyProfile,
                });
                const snapshot = buildManagedAllocationSnapshot({
                    strategyProfile: sub.product.strategyProfile,
                    version: nextVersion,
                    seed,
                    targetCount: Math.min(templateCandidates.length, MANAGED_ALLOCATION_TARGET_COUNT),
                    reason: existingAllocation
                        ? 'REFRESH_PRODUCT_TEMPLATE_ALLOCATION'
                        : 'INITIAL_PRODUCT_TEMPLATE_ALLOCATION',
                    generatedAt: now.toISOString(),
                    candidates: templateCandidates,
                });
                if (snapshot.targets.length === 0) {
                    console.warn(`[ManagedWealthWorker] Allocation snapshot produced no targets; skip ${sub.id}`);
                    continue;
                }

                await prisma.$transaction(async (tx) => {
                    await tx.managedSubscriptionAllocation.updateMany({
                        where: {
                            subscriptionId: sub.id,
                            status: 'ACTIVE',
                        },
                        data: {
                            status: 'SUPERSEDED',
                        },
                    });
                    await tx.managedSubscriptionAllocation.create({
                        data: {
                            subscriptionId: sub.id,
                            version: snapshot.version,
                            status: 'ACTIVE',
                            reason: snapshot.reason,
                            seed: snapshot.seed,
                            scoreSnapshot: snapshot.scoreSnapshot as Prisma.InputJsonValue,
                            selectedWeights: snapshot.selectedWeights as Prisma.InputJsonValue,
                        },
                    });
                });

                allocationVersion = snapshot.version;
                desiredTargets = snapshot.targets
                    .map((target) => {
                        const agent = sub.product.agents.find(
                            (item) => item.agent.traderAddress.toLowerCase() === target.address
                        )?.agent ?? null;

                        if (!agent) {
                            return null;
                        }

                        return {
                            agent,
                            weight: target.weight,
                        };
                    })
                    .filter((target): target is NonNullable<typeof target> => target !== null);
            }
        } else {
            const fallbackAgent = sub.product.agents[0]?.agent ?? null;
            if (fallbackAgent) {
                desiredTargets = [{
                    agent: fallbackAgent,
                    weight: 1,
                }];
            }
        }

        if (desiredTargets.length === 0) {
            console.warn(`[ManagedWealthWorker] No execution agent could be resolved for subscription ${sub.id}; skip`);
            continue;
        }

        const normalizedDesiredTargets = desiredTargets.map((target, targetOrder) => ({
            agent: target.agent,
            targetWeight: target.weight > 0
                ? Number(target.weight.toFixed(8))
                : Number((1 / desiredTargets.length).toFixed(8)),
            targetOrder,
            isPrimary: targetOrder === 0,
        }));
        const alreadySynced = activeExecutionTargets.length === normalizedDesiredTargets.length
            && normalizedDesiredTargets.every((target, index) => {
                const current = activeExecutionTargets[index];
                if (!current) return false;

                return (
                    current.copyConfig.agentId === target.agent.id
                    && current.copyConfig.traderAddress.toLowerCase() === target.agent.traderAddress.toLowerCase()
                    && Number(current.targetWeight.toFixed(8)) === target.targetWeight
                    && current.targetOrder === target.targetOrder
                    && current.isPrimary === target.isPrimary
                    && (current.allocationVersion ?? null) === allocationVersion
                );
            });

        if (alreadySynced) {
            const primaryConfigId = activeExecutionTargets[0]?.copyConfigId ?? sub.copyConfigId ?? null;
            const needsSubscriptionTouch =
                sub.copyConfigId !== primaryConfigId
                || sub.status !== 'RUNNING'
                || !sub.startAt
                || !sub.endAt;

            if (needsSubscriptionTouch) {
                await prisma.managedSubscription.update({
                    where: { id: sub.id },
                    data: {
                        copyConfigId: primaryConfigId,
                        status: 'RUNNING',
                        startAt: sub.startAt ?? now,
                        endAt: sub.endAt ?? new Date(now.getTime() + sub.term.durationDays * 24 * 60 * 60 * 1000),
                    },
                });
                mapped += 1;
            }
            continue;
        }

        const preparedTargets: Array<{
            copyConfigId: string;
            targetWeight: number;
            targetOrder: number;
            isPrimary: boolean;
        }> = [];

        for (const target of normalizedDesiredTargets) {
            const matchingTarget = activeExecutionTargets.find((current) =>
                current.copyConfig.agentId === target.agent.id
                && current.copyConfig.traderAddress.toLowerCase() === target.agent.traderAddress.toLowerCase()
            );
            const configData = {
                walletAddress: sub.walletAddress,
                traderAddress: target.agent.traderAddress.toLowerCase(),
                traderName: target.agent.traderName ?? target.agent.name,
                strategyProfile: sub.product.strategyProfile,
                mode: 'FIXED_AMOUNT' as const,
                sizeScale: target.agent.sizeScale,
                fixedAmount: Math.max(1, Number((sub.principal * 0.1 * target.targetWeight).toFixed(2))),
                maxSizePerTrade: Math.max(1, Number((sub.principal * 0.2 * target.targetWeight).toFixed(2))),
                minSizePerTrade: target.agent.minSizePerTrade,
                stopLoss: target.agent.stopLoss,
                takeProfit: target.agent.takeProfit,
                maxOdds: target.agent.maxOdds,
                minLiquidity: target.agent.minLiquidity,
                minVolume: target.agent.minVolume,
                sellMode: target.agent.sellMode,
                autoExecute: true,
                channel: 'EVENT_LISTENER' as const,
                executionMode: 'PROXY' as const,
                direction: 'COPY',
                slippageType: 'AUTO',
                maxSlippage: 2,
                isActive: true,
                agentId: target.agent.id,
            };
            const configId = matchingTarget
                ? (
                    await prisma.copyTradingConfig.update({
                        where: { id: matchingTarget.copyConfigId },
                        data: configData,
                        select: { id: true },
                    })
                ).id
                : (
                    await prisma.copyTradingConfig.create({
                        data: configData,
                        select: { id: true },
                    })
                ).id;

            preparedTargets.push({
                copyConfigId: configId,
                targetWeight: target.targetWeight,
                targetOrder: target.targetOrder,
                isPrimary: target.isPrimary,
            });
        }

        const staleConfigIds = activeExecutionTargets
            .map((target) => target.copyConfigId)
            .filter((copyConfigId) =>
                !preparedTargets.some((target) => target.copyConfigId === copyConfigId)
            );

        await prisma.$transaction(async (tx) => {
            await tx.managedSubscriptionExecutionTarget.updateMany({
                where: {
                    subscriptionId: sub.id,
                    isActive: true,
                    copyConfigId: {
                        notIn: preparedTargets.map((target) => target.copyConfigId),
                    },
                },
                data: {
                    isActive: false,
                    isPrimary: false,
                    deactivatedAt: now,
                },
            });

            if (staleConfigIds.length > 0) {
                await tx.copyTradingConfig.updateMany({
                    where: {
                        id: { in: staleConfigIds },
                    },
                    data: {
                        isActive: false,
                    },
                });
            }

            for (const target of preparedTargets) {
                await tx.managedSubscriptionExecutionTarget.upsert({
                    where: {
                        subscriptionId_copyConfigId: {
                            subscriptionId: sub.id,
                            copyConfigId: target.copyConfigId,
                        },
                    },
                    update: {
                        allocationVersion,
                        targetWeight: target.targetWeight,
                        targetOrder: target.targetOrder,
                        isPrimary: target.isPrimary,
                        isActive: true,
                        deactivatedAt: null,
                    },
                    create: {
                        subscriptionId: sub.id,
                        copyConfigId: target.copyConfigId,
                        allocationVersion,
                        targetWeight: target.targetWeight,
                        targetOrder: target.targetOrder,
                        isPrimary: target.isPrimary,
                        isActive: true,
                        activatedAt: now,
                    },
                });
            }

            await tx.managedSubscription.update({
                where: { id: sub.id },
                data: {
                    copyConfigId: preparedTargets[0]?.copyConfigId ?? null,
                    status: 'RUNNING',
                    startAt: sub.startAt ?? now,
                    endAt: sub.endAt ?? new Date(now.getTime() + sub.term.durationDays * 24 * 60 * 60 * 1000),
                },
            });
        });

        mapped += 1;
    }

    return mapped;
}

async function refreshNavSnapshots(now: Date): Promise<number> {
    const snapshotAt = new Date(Math.floor(now.getTime() / 60_000) * 60_000);

    const runningSubs = await prisma.managedSubscription.findMany({
        where: {
            status: { in: ['RUNNING', 'LIQUIDATING'] },
            copyConfigId: { not: null },
        },
        select: {
            id: true,
            principal: true,
            highWaterMark: true,
            currentEquity: true,
            copyConfigId: true,
            walletAddress: true,
        },
        take: NAV_BATCH_SIZE,
    });

    let updated = 0;

    // Cache to avoid refetching prices for the same token across multiple subs
    const currentPriceMap = new Map<string, number>();

    for (const sub of runningSubs) {
        const executionConfigIds = await resolveManagedExecutionConfigIds(prisma, {
            subscriptionId: sub.id,
            fallbackCopyConfigId: sub.copyConfigId,
        });
        if (executionConfigIds.length === 0) continue;

        const [tradeAgg, previousSnapshot, peakAgg, openPositions] = await Promise.all([
            prisma.copyTrade.aggregate({
                where: {
                    configId: executionConfigIds.length === 1
                        ? executionConfigIds[0]
                        : { in: executionConfigIds },
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
            listManagedOpenPositionsWithFallback(prisma, {
                subscriptionId: sub.id,
                walletAddress: sub.walletAddress,
                copyConfigIds: executionConfigIds,
                copyConfigId: sub.copyConfigId,
            })
        ]);

        const realizedPnl = Number(tradeAgg._sum.realizedPnL ?? 0);
        let unrealizedPnl = 0;

        // Fetch prices for any open positions that we haven't fetched yet
        if (openPositions.length > 0) {
            const tokensToFetch = openPositions.map((p: { tokenId: string }) => p.tokenId).filter((tid: string) => !currentPriceMap.has(tid));
            if (tokensToFetch.length > 0) {
                try {
                    const orderbooks = await polyClient.markets.getTokenOrderbooks(
                        tokensToFetch.map((id: string) => ({ tokenId: id, side: 'BUY' as const }))
                    );
                    orderbooks.forEach((book, tokenId) => {
                        if (book.bids.length > 0) {
                            currentPriceMap.set(tokenId, book.bids[0].price);
                        } else {
                            // If no bid, fallback to 0 or leave it to fallback
                            currentPriceMap.set(tokenId, 0);
                        }
                    });
                } catch (err) {
                    console.warn('[ManagedWealthWorker] Failed to fetch CLOB prices for NAV:', err);
                }
            }

            for (const pos of openPositions) {
                const curPrice = currentPriceMap.get(pos.tokenId) ?? pos.avgEntryPrice;
                unrealizedPnl += pos.balance * (curPrice - pos.avgEntryPrice);
            }
        }

        const equity = Number((sub.principal + realizedPnl + unrealizedPnl).toFixed(8));
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
                priceSource: 'MARK_TO_MARKET',
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
                priceSource: 'MARK_TO_MARKET',
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
            status: { in: ['MATURED', 'RUNNING', 'LIQUIDATING'] },
            endAt: { lte: now },
        },
        select: {
            id: true,
            walletAddress: true,
            copyConfigId: true,
            status: true,
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

        const executionConfigIds = await resolveManagedExecutionConfigIds(prisma, {
            subscriptionId: sub.id,
            fallbackCopyConfigId: sub.copyConfigId,
        });

        // Check if there are open positions
        const openPositionsCount = await countManagedOpenPositionsWithFallback(prisma, {
            subscriptionId: sub.id,
            walletAddress: sub.walletAddress,
            copyConfigIds: executionConfigIds,
            copyConfigId: sub.copyConfigId,
        });

        if (openPositionsCount > 0) {
            if (sub.status !== 'LIQUIDATING') {
                await prisma.$transaction(async (tx) => {
                    await transitionSubscriptionToLiquidatingIfNeeded(tx, {
                        subscriptionId: sub.id,
                        currentStatus: sub.status,
                        copyConfigIds: executionConfigIds,
                        copyConfigId: sub.copyConfigId,
                    });
                });
            }
            continue; // Skip settlement until positions are liquidated by the liquidateSubscriptions routine
        }

        const mutationResult = await prisma.$transaction(async (tx) =>
            applyManagedSettlementMutation(tx, {
                subscriptionId: sub.id,
                now,
                reserveTopupNote: 'WORKER_AUTO_SETTLEMENT_GUARANTEE_TOPUP',
            })
        );

        if (mutationResult.status !== 'COMPLETED') {
            continue;
        }

        await finalizeManagedSettlementEntry({
            db: prisma,
            distributor: async (walletAddress, realizedProfit, tradeId, options) =>
                affiliateEngine.distributeProfitFee(walletAddress, realizedProfit, tradeId, options),
            walletAddress: sub.walletAddress,
            mutationResult,
            onProfitFeeError: (affiliateError) => {
                console.error('[ManagedWealthWorker] Profit fee distribution failed:', affiliateError);
            },
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
            (acc: number, sub: { principal: number, term: { minYieldRate: number | null } }) => acc + calculateGuaranteeLiability(sub.principal, sub.term.minYieldRate),
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

async function liquidateSubscriptions(now: Date): Promise<number> {
    const liquidatingSubs = await prisma.managedSubscription.findMany({
        where: {
            status: 'LIQUIDATING',
        },
        select: {
            id: true,
            walletAddress: true,
            copyConfigId: true,
        },
    });

    let taskUpdates = 0;

    for (const sub of liquidatingSubs) {
        const executionConfigIds = await resolveManagedExecutionConfigIds(prisma, {
            subscriptionId: sub.id,
            fallbackCopyConfigId: sub.copyConfigId,
        });

        const openPositions = await listManagedOpenPositionsWithFallback(prisma, {
            subscriptionId: sub.id,
            walletAddress: sub.walletAddress,
            copyConfigIds: executionConfigIds,
            copyConfigId: sub.copyConfigId,
        });

        if (openPositions.length === 0) {
            await prisma.managedLiquidationTask.updateMany({
                where: {
                    subscriptionId: sub.id,
                    status: { in: ['PENDING', 'RETRYING', 'BLOCKED'] },
                },
                data: {
                    status: 'COMPLETED',
                    errorCode: null,
                    errorMessage: null,
                    nextRetryAt: null,
                    lastAttemptAt: now,
                },
            });
            continue;
        }

        const tokensToFetch = openPositions.map((p: { tokenId: string }) => p.tokenId);
        const currentPriceMap = new Map<string, number>();

        try {
            const orderbooks = await polyClient.markets.getTokenOrderbooks(
                tokensToFetch.map((id: string) => ({ tokenId: id, side: 'BUY' as const }))
            );
            orderbooks.forEach((book, tokenId) => {
                // To liquidate immediately, take the best bid price (meaning selling to someone's bid)
                if (book.bids.length > 0) {
                    currentPriceMap.set(tokenId, book.bids[0].price);
                } else {
                    currentPriceMap.set(tokenId, 0);
                }
            });
        } catch (err) {
            console.warn(`[ManagedWealthWorker] Failed to fetch CLOB prices for liquidation sub ${sub.id}:`, err);
        }

        for (const pos of openPositions) {
            const curPrice = currentPriceMap.get(pos.tokenId) ?? 0;
            const intent = resolveManagedLiquidationIntent({
                hasCopyConfig: executionConfigIds.length > 0,
                indicativeBidPrice: curPrice,
            });
            const nextRetryAt = new Date(now.getTime() + LIQUIDATION_RETRY_BASE_MS);

            await prisma.managedLiquidationTask.upsert({
                where: {
                    subscriptionId_tokenId: {
                        subscriptionId: sub.id,
                        tokenId: pos.tokenId,
                    },
                },
                update: {
                    walletAddress: pos.walletAddress,
                    copyConfigId: executionConfigIds[0] ?? sub.copyConfigId ?? null,
                    requestedShares: pos.balance,
                    avgEntryPrice: pos.avgEntryPrice,
                    indicativePrice: curPrice > 0 ? curPrice : null,
                    notionalUsd: curPrice > 0 ? Number((pos.balance * curPrice).toFixed(8)) : null,
                    status: intent.status,
                    attemptCount: { increment: 1 },
                    lastAttemptAt: now,
                    nextRetryAt: intent.status === 'BLOCKED' ? null : nextRetryAt,
                    errorCode: intent.errorCode,
                    errorMessage: intent.errorMessage,
                },
                create: {
                    subscriptionId: sub.id,
                    walletAddress: pos.walletAddress,
                    copyConfigId: executionConfigIds[0] ?? sub.copyConfigId ?? null,
                    tokenId: pos.tokenId,
                    requestedShares: pos.balance,
                    avgEntryPrice: pos.avgEntryPrice,
                    indicativePrice: curPrice > 0 ? curPrice : null,
                    notionalUsd: curPrice > 0 ? Number((pos.balance * curPrice).toFixed(8)) : null,
                    status: intent.status,
                    attemptCount: 1,
                    lastAttemptAt: now,
                    nextRetryAt: intent.status === 'BLOCKED' ? null : nextRetryAt,
                    errorCode: intent.errorCode,
                    errorMessage: intent.errorMessage,
                },
            });

            taskUpdates += 1;
        }
    }

    return taskUpdates;
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
        // Step 2: Handle any running/matured limits, transitions them to MATURED
        const matured = await markMaturedSubscriptions(now);
        // Step 3: Settles zero-balance MATURED/RUNNING/LIQUIDATING, or puts them iteratively into LIQUIDATING
        const settled = await settleMaturedSubscriptions(now);
        // Step 4: Liquidate anything sitting in LIQUIDATING state
        const liquidated = await liquidateSubscriptions(now);
        // Step 5: Refresh NAV for running + liquidating items
        const navUpdated = await refreshNavSnapshots(now);

        const pausedOrResumed = await enforceGuaranteedPause();

        const durationMs = Date.now() - started;
        console.log(
            `[ManagedWealthWorker] cycle done in ${durationMs}ms | mapped=${mapped} matured=${matured} settled=${settled} liquidated=${liquidated} nav=${navUpdated} statusChanges=${pausedOrResumed}`
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
