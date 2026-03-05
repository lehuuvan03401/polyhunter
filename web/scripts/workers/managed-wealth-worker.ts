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
import { ethers } from 'ethers';

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
const MANAGED_MAX_TRADE_SIZE_USDC = Math.max(1, Number(process.env.MANAGED_MAX_TRADE_SIZE_USDC || 500));

const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || process.env.NEXT_PUBLIC_AMOY_USDC_ADDRESS || '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const rpcProvider = new ethers.providers.JsonRpcProvider(POLYGON_RPC_URL);
const usdcContract = new ethers.Contract(USDC_ADDRESS, ['function balanceOf(address account) external view returns (uint256)'], rpcProvider);
const LIQUIDATION_RETRY_BASE_MS = Math.max(10_000, Number(process.env.MANAGED_LIQUIDATION_RETRY_BASE_MS || 120_000));
const MANAGED_ALLOCATION_TARGET_COUNT = Math.max(1, Number(process.env.MANAGED_ALLOCATION_TARGET_COUNT || 3));
const MANAGED_ALLOCATION_SNAPSHOT_ENABLED = process.env.MANAGED_ALLOCATION_SNAPSHOT_ENABLED !== 'false';
const MANAGED_MULTI_TARGET_EXECUTION_ENABLED = process.env.MANAGED_MULTI_TARGET_EXECUTION_ENABLED !== 'false';
/** Every N cycles, do a full-scan of ALL running subscriptions to reconcile agent changes. Default: every 20 cycles. */
const FULL_REFRESH_INTERVAL = Math.max(1, Number(process.env.MANAGED_WEALTH_FULL_REFRESH_INTERVAL || 20));

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

let running = false;
let cycleCount = 0;

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

async function ensureExecutionMappings(now: Date, forceFullRefresh = false): Promise<number> {
    const candidateQuery = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "ManagedSubscription"
        WHERE 
            "status" IN ('PENDING', 'RUNNING')
            AND "productId" IN (SELECT "id" FROM "ManagedProduct" WHERE "isActive" = true AND "status" = 'ACTIVE')
            ${!forceFullRefresh ? Prisma.sql`
            AND (
                "copyConfigId" IS NULL
                OR NOT EXISTS (
                    SELECT 1 FROM "ManagedSubscriptionExecutionTarget" 
                    WHERE "subscriptionId" = "ManagedSubscription"."id" AND "isActive" = true
                )
                OR EXISTS (
                    SELECT 1 FROM "ManagedSubscriptionAllocation" 
                    WHERE "subscriptionId" = "ManagedSubscription"."id" AND "status" = 'ACTIVE' AND "version" > 1
                )
            ) ` : Prisma.empty}
        ORDER BY "createdAt" ASC
        LIMIT ${MAP_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED;
    `;

    const candidateIds = candidateQuery.map(row => row.id);

    if (candidateIds.length === 0) {
        return 0;
    }

    const candidates = await prisma.managedSubscription.findMany({
        where: { id: { in: candidateIds } },
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
    });

    if (forceFullRefresh && candidates.length > 0) {
        console.log(`[ManagedWealthWorker] full-refresh scan: ${candidates.length} subscriptions`);
    }

    let mapped = 0;
    for (const sub of candidates) {
        // Vault Protection Check: ensure proxy wallet has enough USDC to honor the principal size
        let hasSufficientVaultFunds = true;
        try {
            const rawBalance = await usdcContract.balanceOf(sub.walletAddress);
            const balanceUsdc = Number(ethers.utils.formatUnits(rawBalance, 6));
            if (balanceUsdc < sub.principal) {
                console.warn(`[ManagedWealthWorker] Insufficient vault funds for subscription ${sub.id}: Wallet ${sub.walletAddress} has ${balanceUsdc} USDC, but principal is ${sub.principal}`);
                hasSufficientVaultFunds = false;

                // De-duplicate risk event spam per day
                const dupeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                const recentAlert = await prisma.managedRiskEvent.findFirst({
                    where: {
                        subscriptionId: sub.id,
                        metric: 'INSUFFICIENT_VAULT_FUNDS',
                        createdAt: { gte: dupeStart },
                    },
                    select: { id: true },
                });

                if (!recentAlert) {
                    await prisma.managedRiskEvent.create({
                        data: {
                            subscriptionId: sub.id,
                            severity: 'ERROR',
                            metric: 'INSUFFICIENT_VAULT_FUNDS',
                            action: 'PAUSE_NEW_ENTRIES',
                            description: `Proxy wallet ${sub.walletAddress} balance (${balanceUsdc.toFixed(2)} USDC) is less than registered principal (${sub.principal.toFixed(2)} USDC). Mapping paused.`,
                        }
                    });
                }
            }
        } catch (error) {
            console.error(`[ManagedWealthWorker] Failed to check vault balance for ${sub.walletAddress}`, error);
            // On RPC failure, we fail-open to not permanently block mappings if RPC is flaky
        }

        if (!hasSufficientVaultFunds) {
            continue;
        }

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
        const existingAllocationTargets = MANAGED_MULTI_TARGET_EXECUTION_ENABLED
            ? extractSelectedTargetWeights(existingAllocation?.selectedWeights)
            : extractSelectedTargetWeights(existingAllocation?.selectedWeights).slice(0, 1);

        if (
            sub.copyConfigId &&
            activeExecutionTargets.length === 0 &&
            (!MANAGED_MULTI_TARGET_EXECUTION_ENABLED || existingAllocationTargets.length <= 1)
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
                    targetCount: Math.min(
                        templateCandidates.length,
                        MANAGED_MULTI_TARGET_EXECUTION_ENABLED ? MANAGED_ALLOCATION_TARGET_COUNT : 1
                    ),
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
                fixedAmount: Math.min(MANAGED_MAX_TRADE_SIZE_USDC, Math.max(1, Number((sub.principal * 0.1 * target.targetWeight).toFixed(2)))),
                maxSizePerTrade: Math.max(1, Math.min(MANAGED_MAX_TRADE_SIZE_USDC * 2, Number((sub.principal * 0.2 * target.targetWeight).toFixed(2)))),
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

    if (runningSubs.length === 0) return 0;

    let updated = 0;

    // 1. Resolve Execution Configs Batch
    const allExecutionConfigMap = new Map<string, string[]>();
    const allConfigIdsToQuery = new Set<string>();

    for (const sub of runningSubs) {
        const executionConfigIds = await resolveManagedExecutionConfigIds(prisma, {
            subscriptionId: sub.id,
            fallbackCopyConfigId: sub.copyConfigId,
        });
        allExecutionConfigMap.set(sub.id, executionConfigIds);
        executionConfigIds.forEach(id => allConfigIdsToQuery.add(id));
    }

    // 2. Pre-fetch all copy trades for all configs
    const tradeGroups = await prisma.copyTrade.groupBy({
        by: ['configId'],
        where: {
            configId: { in: Array.from(allConfigIdsToQuery) },
            status: 'EXECUTED',
        },
        _sum: {
            realizedPnL: true,
        },
    });
    const realizedPnlMap = new Map<string, number>();
    for (const group of tradeGroups) {
        realizedPnlMap.set(group.configId, Number(group._sum.realizedPnL ?? 0));
    }

    // 3. Pre-fetch snapshot data
    const subIds = runningSubs.map(s => s.id);
    const [latestSnapshots, peakSnapshots] = await Promise.all([
        prisma.$queryRaw<Array<{ subscriptionId: string; equity: number }>>`
            SELECT DISTINCT ON ("subscriptionId") "subscriptionId", "equity"
            FROM "ManagedNavSnapshot"
            WHERE "subscriptionId" IN (${Prisma.join(subIds)})
            ORDER BY "subscriptionId", "snapshotAt" DESC
        `,
        prisma.$queryRaw<Array<{ subscriptionId: string; maxNav: number }>>`
            SELECT "subscriptionId", MAX("nav") as "maxNav"
            FROM "ManagedNavSnapshot"
            WHERE "subscriptionId" IN (${Prisma.join(subIds)})
            GROUP BY "subscriptionId"
        `,
    ]);
    const latestEquityMap = new Map(latestSnapshots.map(row => [row.subscriptionId, Number(row.equity)]));
    const peakNavMap = new Map(peakSnapshots.map(row => [row.subscriptionId, Number(row.maxNav)]));

    // 4. Pre-fetch and resolve ALL open positions across all subscriptions
    const subPositionsMap = new Map<string, any[]>();
    const tokensToFetch = new Set<string>();

    for (const sub of runningSubs) {
        const executionConfigIds = allExecutionConfigMap.get(sub.id) ?? [];
        if (executionConfigIds.length === 0) {
            subPositionsMap.set(sub.id, []);
            continue;
        }
        const openPositions = await listManagedOpenPositionsWithFallback(prisma, {
            subscriptionId: sub.id,
            walletAddress: sub.walletAddress,
            copyConfigIds: executionConfigIds,
            copyConfigId: sub.copyConfigId,
        });
        subPositionsMap.set(sub.id, openPositions);
        openPositions.forEach((p: { tokenId: string }) => tokensToFetch.add(p.tokenId));
    }

    // 5. Batch fetch CLOB Prices once
    const currentPriceMap = new Map<string, number>();
    if (tokensToFetch.size > 0) {
        try {
            const tokenList = Array.from(tokensToFetch);
            // Polymarket limits may apply, but this is much better than single requests per sub
            const orderbooks = await polyClient.markets.getTokenOrderbooks(
                tokenList.map(id => ({ tokenId: id, side: 'BUY' as const }))
            );
            orderbooks.forEach((book, tokenId) => {
                if (book.bids.length > 0) {
                    currentPriceMap.set(tokenId, book.bids[0].price);
                } else {
                    currentPriceMap.set(tokenId, 0);
                }
            });
        } catch (err) {
            console.warn('[ManagedWealthWorker] Failed to batch fetch CLOB prices for NAV:', err);
        }
    }

    // 6. Process in memory and save
    for (const sub of runningSubs) {
        const executionConfigIds = allExecutionConfigMap.get(sub.id) ?? [];
        if (executionConfigIds.length === 0) continue;

        let realizedPnl = 0;
        for (const cid of executionConfigIds) {
            realizedPnl += realizedPnlMap.get(cid) ?? 0;
        }

        const openPositions = subPositionsMap.get(sub.id) ?? [];
        let unrealizedPnl = 0;
        let allPricesFailed = false;

        if (openPositions.length > 0) {
            const hasAnyPrice = openPositions.some((p: { tokenId: string }) => currentPriceMap.has(p.tokenId));
            if (!hasAnyPrice) {
                allPricesFailed = true;
            } else {
                for (const pos of openPositions) {
                    const curPrice = currentPriceMap.get(pos.tokenId) ?? pos.avgEntryPrice;
                    unrealizedPnl += pos.balance * (curPrice - pos.avgEntryPrice);
                }
            }
        }

        if (allPricesFailed) {
            console.warn(`[ManagedWealthWorker] Skipping NAV snapshot for sub ${sub.id}: all price fetches failed`);
            continue;
        }

        const equity = Number((sub.principal + realizedPnl + unrealizedPnl).toFixed(8));
        const nav = sub.principal > 0 ? equity / sub.principal : 1;

        const prevEquity = latestEquityMap.get(sub.id) ?? sub.principal;
        const periodReturn = prevEquity > 0 ? (equity - prevEquity) / prevEquity : 0;
        const cumulativeReturn = sub.principal > 0 ? (equity - sub.principal) / sub.principal : 0;

        const peakNav = Math.max(peakNavMap.get(sub.id) ?? 1, nav);
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

        // Write DRAWDOWN_ALERT risk event if drawdown exceeds configured threshold
        // Use a 24h dedup window to avoid flooding the table on every cycle
        const NAV_DRAWDOWN_ALERT_THRESHOLD = Math.min(1, Math.max(0, Number(
            process.env.MANAGED_NAV_DRAWDOWN_ALERT_THRESHOLD || 0.25
        )));
        if (Number.isFinite(drawdown) && drawdown >= NAV_DRAWDOWN_ALERT_THRESHOLD) {
            const dupeWindowStart = new Date(snapshotAt.getTime() - 24 * 60 * 60 * 1000);
            const existingAlert = await prisma.managedRiskEvent.findFirst({
                where: {
                    subscriptionId: sub.id,
                    metric: 'NAV_DRAWDOWN_ALERT',
                    createdAt: { gte: dupeWindowStart },
                },
                select: { id: true },
            });
            if (!existingAlert) {
                await prisma.managedRiskEvent.create({
                    data: {
                        subscriptionId: sub.id,
                        severity: drawdown >= 0.5 ? 'ERROR' : 'WARN',
                        metric: 'NAV_DRAWDOWN_ALERT',
                        threshold: NAV_DRAWDOWN_ALERT_THRESHOLD,
                        observedValue: drawdown,
                        action: 'DELEVERAGE',
                        description: `NAV drawdown ${(drawdown * 100).toFixed(2)}% exceeds threshold ${(NAV_DRAWDOWN_ALERT_THRESHOLD * 100).toFixed(2)}%`,
                    },
                });
            }
        }

        updated += 1;
    }

    return updated;
}

async function markMaturedSubscriptions(now: Date): Promise<number> {
    const maturedCandidates = await prisma.managedSubscription.findMany({
        where: {
            status: 'RUNNING',
            endAt: { lte: now },
        },
        select: { id: true },
        take: SETTLEMENT_BATCH_SIZE,
    });

    if (maturedCandidates.length === 0) return 0;

    const subIds = maturedCandidates.map(c => c.id);

    await prisma.$transaction(async (tx) => {
        const executionTargets = await tx.managedSubscriptionExecutionTarget.findMany({
            where: { subscriptionId: { in: subIds }, isActive: true },
            select: { copyConfigId: true },
        });

        const configIds = executionTargets.map(t => t.copyConfigId);

        if (configIds.length > 0) {
            await tx.managedSubscriptionExecutionTarget.updateMany({
                where: { subscriptionId: { in: subIds }, isActive: true },
                data: { isActive: false, deactivatedAt: now },
            });
            await tx.copyTradingConfig.updateMany({
                where: { id: { in: configIds } },
                data: { isActive: false },
            });
        }

        await tx.managedSubscription.updateMany({
            where: { id: { in: subIds } },
            data: {
                status: 'MATURED',
                maturedAt: now,
            },
        });
    });

    return subIds.length;
}

async function settleMaturedSubscriptions(now: Date): Promise<number> {
    const candidateQuery = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "ManagedSubscription"
        WHERE 
            "status" IN ('MATURED', 'RUNNING', 'LIQUIDATING')
            AND "endAt" <= ${now}
        ORDER BY "endAt" ASC
        LIMIT ${SETTLEMENT_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED;
    `;

    const candidateIds = candidateQuery.map(row => row.id);

    if (candidateIds.length === 0) {
        return 0;
    }

    const candidates = await prisma.managedSubscription.findMany({
        where: { id: { in: candidateIds } },
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
    const candidateQuery = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "ManagedSubscription"
        WHERE 
            "status" = 'LIQUIDATING'
        FOR UPDATE SKIP LOCKED;
    `;

    const candidateIds = candidateQuery.map(row => row.id);

    if (candidateIds.length === 0) {
        return 0;
    }

    const liquidatingSubs = await prisma.managedSubscription.findMany({
        where: { id: { in: candidateIds } },
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

            // MAX LIQUIDATION RETRIES: Avoid getting permanently stuck in a illiquid market.
            // After 100 attempts (usually hours/days later), we give up and mark FAILED,
            // effectively allowing the position to be "written off" as $0 so the user can settle.
            const MAX_LIQUIDATION_ATTEMPTS = 100;
            const existingTask = await prisma.managedLiquidationTask.findUnique({
                where: {
                    subscriptionId_tokenId: {
                        subscriptionId: sub.id,
                        tokenId: pos.tokenId,
                    },
                },
            });

            const nextAttemptCount = (existingTask?.attemptCount ?? 0) + 1;
            const isTerminalFailure = nextAttemptCount >= MAX_LIQUIDATION_ATTEMPTS;

            const finalStatus = isTerminalFailure ? 'FAILED' : intent.status;
            let finalErrorCode = isTerminalFailure ? 'MAX_RETRIES_EXCEEDED' : intent.errorCode;
            let finalErrorMessage = isTerminalFailure ? 'Liquidation failed repeatedly and has been marked as a terminal failure' : intent.errorMessage;

            if (isTerminalFailure && !existingTask) {
                // If it's hitting terminal failure but no task exists yet, something's very wrong,
                // but we handle it safely.
            } else if (isTerminalFailure && existingTask?.status !== 'FAILED') {
                // Emit a risk event for observability when a position goes to $0 terminal failure.
                await prisma.managedRiskEvent.create({
                    data: {
                        subscriptionId: sub.id,
                        severity: 'ERROR',
                        metric: 'LIQUIDATION_TERMINAL_FAILURE',
                        action: 'FORCE_PROTECTIVE_EXIT',
                        description: `Gave up liquidating ${pos.balance} shares of ${pos.tokenId} after ${MAX_LIQUIDATION_ATTEMPTS} attempts`,
                    },
                });

                // Clear the position balance to unlock settlement
                await prisma.managedSubscriptionPosition.update({
                    where: {
                        subscriptionId_tokenId: {
                            subscriptionId: sub.id,
                            tokenId: pos.tokenId,
                        },
                    },
                    data: { balance: 0 },
                });
            }

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
                    notionalUsd: isTerminalFailure ? 0 : (curPrice > 0 ? Number((pos.balance * curPrice).toFixed(8)) : null),
                    status: finalStatus,
                    attemptCount: { increment: 1 },
                    lastAttemptAt: now,
                    nextRetryAt: finalStatus === 'BLOCKED' || finalStatus === 'FAILED' ? null : nextRetryAt,
                    errorCode: finalErrorCode,
                    errorMessage: finalErrorMessage,
                },
                create: {
                    subscriptionId: sub.id,
                    walletAddress: pos.walletAddress,
                    copyConfigId: executionConfigIds[0] ?? sub.copyConfigId ?? null,
                    tokenId: pos.tokenId,
                    requestedShares: pos.balance,
                    avgEntryPrice: pos.avgEntryPrice,
                    indicativePrice: curPrice > 0 ? curPrice : null,
                    notionalUsd: isTerminalFailure ? 0 : (curPrice > 0 ? Number((pos.balance * curPrice).toFixed(8)) : null),
                    status: finalStatus,
                    attemptCount: 1,
                    lastAttemptAt: now,
                    nextRetryAt: finalStatus === 'BLOCKED' || finalStatus === 'FAILED' ? null : nextRetryAt,
                    errorCode: finalErrorCode,
                    errorMessage: finalErrorMessage,
                },
            });

            taskUpdates += 1;
        }
    }

    return taskUpdates;
}

async function retryFailedCommissions(now: Date): Promise<number> {
    const candidateQuery = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "ManagedSettlementExecution"
        WHERE 
            "commissionStatus" IN ('PENDING', 'FAILED')
            AND "createdAt" <= ${new Date(now.getTime() - 60_000)} -- at least 1 minute old
        LIMIT 50
        FOR UPDATE SKIP LOCKED;
    `;

    const candidateIds = candidateQuery.map(row => row.id);

    if (candidateIds.length === 0) {
        return 0;
    }

    const executions = await prisma.managedSettlementExecution.findMany({
        where: { id: { in: candidateIds } },
        select: {
            id: true,
            settlementId: true,
            subscriptionId: true,
            walletAddress: true,
            grossPnl: true,
            profitFeeTradeId: true,
            profitFeeScope: true,
        },
    });

    let retried = 0;

    for (const exec of executions) {
        // Mark as PROCESSING to prevent double execution if loop crashes halfway
        await prisma.managedSettlementExecution.update({
            where: { id: exec.id },
            data: {
                commissionStatus: 'PROCESSING',
                commissionError: null,
            },
        });

        const scope = exec.profitFeeScope as any; // Cast to ParticipationProfitFeeScope

        try {
            await affiliateEngine.distributeProfitFee(
                exec.walletAddress,
                exec.grossPnl,
                exec.profitFeeTradeId,
                { scope }
            );

            await prisma.managedSettlementExecution.update({
                where: { id: exec.id },
                data: {
                    commissionStatus: 'COMPLETED',
                    commissionSettledAt: new Date(),
                    commissionError: null,
                },
            });
            retried++;
        } catch (error) {
            console.error(`[ManagedWealthWorker] Retry commission failed for ${exec.id}:`, error);
            await prisma.managedSettlementExecution.update({
                where: { id: exec.id },
                data: {
                    commissionStatus: 'FAILED',
                    commissionError: String(error).slice(0, 500),
                },
            });
        }
    }

    return retried;
}

/**
 * Proactively expire any ACTIVE memberships whose endsAt has passed.
 * This ensures memberships are marked EXPIRED even if the user never visits
 * the dashboard (the GET endpoint also does this, but only on access).
 */
async function expireManagedMemberships(now: Date): Promise<number> {
    const result = await prisma.$executeRaw`
        UPDATE "ManagedMembership"
        SET "status" = 'EXPIRED', "updatedAt" = ${now}
        WHERE "status" = 'ACTIVE'
          AND "endsAt" <= ${now}
    `;
    return typeof result === 'number' ? result : 0;
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
        cycleCount += 1;
        const isFullRefreshCycle = cycleCount % FULL_REFRESH_INTERVAL === 0;
        const mapped = await ensureExecutionMappings(now, isFullRefreshCycle);
        if (isFullRefreshCycle) {
            console.log(`[ManagedWealthWorker] full-refresh cycle #${cycleCount}`);
        }
        // Step 2: Handle any running/matured limits, transitions them to MATURED
        const matured = await markMaturedSubscriptions(now);
        // Step 3: Settles zero-balance MATURED/RUNNING/LIQUIDATING, or puts them iteratively into LIQUIDATING
        const settled = await settleMaturedSubscriptions(now);
        // Step 4: Liquidate anything sitting in LIQUIDATING state
        const liquidated = await liquidateSubscriptions(now);
        // Step 5: Refresh NAV for running + liquidating items
        const navUpdated = await refreshNavSnapshots(now);

        const pausedOrResumed = await enforceGuaranteedPause();

        // Step 7: Retry any stranded or failed commission distributions
        const retriedCommissions = await retryFailedCommissions(now);

        // Step 8: Expire outdated memberships (#13 — proactive, not only on GET)
        const expiredMemberships = await expireManagedMemberships(now);

        const durationMs = Date.now() - started;
        const totalTouched = mapped + matured + settled + liquidated + navUpdated + pausedOrResumed + retriedCommissions + expiredMemberships;

        // Structured JSON log for monitoring (#9)
        console.log(JSON.stringify({
            event: 'managed_wealth_cycle',
            durationMs,
            mapped,
            matured,
            settled,
            liquidated,
            navUpdated,
            statusChanges: pausedOrResumed,
            expiredMemberships,
            ts: now.toISOString(),
        }));
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
