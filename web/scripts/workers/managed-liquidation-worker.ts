import 'dotenv/config';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
    Prisma,
    PrismaClient,
    type ManagedLiquidationTask,
} from '@prisma/client';
import { ethers } from 'ethers';
import { RateLimiter } from '../../../sdk/src/core/rate-limiter';
import { createUnifiedCache } from '../../../sdk/src/core/unified-cache';
import { TradingService } from '../../../sdk/src/services/trading-service';
import { CopyTradingExecutionService } from '../../../sdk/src/services/copy-trading-execution-service';
import { listManagedOpenPositionsWithFallback } from '../../lib/managed-wealth/subscription-position-scope';

const DATABASE_URL = process.env.DATABASE_URL || '';
const RPC_URL = process.env.COPY_TRADING_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://polygon-rpc.com';
const TRADING_PRIVATE_KEY = process.env.TRADING_PRIVATE_KEY || '';
const CHAIN_ID = Number(process.env.CHAIN_ID || 137);
const LOOP_INTERVAL_MS = Math.max(10_000, Number(process.env.MANAGED_LIQUIDATION_LOOP_INTERVAL_MS || 30_000));
const BATCH_SIZE = Math.max(1, Number(process.env.MANAGED_LIQUIDATION_BATCH_SIZE || 20));
const PROCESSING_LEASE_MS = Math.max(30_000, Number(process.env.MANAGED_LIQUIDATION_PROCESSING_LEASE_MS || 120_000));
const BASE_RETRY_MS = Math.max(10_000, Number(process.env.MANAGED_LIQUIDATION_RETRY_BASE_MS || 120_000));
const MAX_RETRY_MS = Math.max(BASE_RETRY_MS, Number(process.env.MANAGED_LIQUIDATION_RETRY_MAX_MS || 1_800_000));
const MAX_ATTEMPTS = Math.max(1, Number(process.env.MANAGED_LIQUIDATION_MAX_ATTEMPTS || 20));
const MIN_NOTIONAL_USD = Math.max(0.5, Number(process.env.MANAGED_LIQUIDATION_MIN_NOTIONAL_USD || 1));
const RUN_ONCE = process.env.MANAGED_LIQUIDATION_RUN_ONCE === 'true';

const CLOB_API_KEY = process.env.POLY_API_KEY || process.env.CLOB_API_KEY;
const CLOB_API_SECRET = process.env.POLY_API_SECRET || process.env.CLOB_API_SECRET;
const CLOB_API_PASSPHRASE = process.env.POLY_API_PASSPHRASE || process.env.CLOB_API_PASSPHRASE;
const clobCredentials = CLOB_API_KEY && CLOB_API_SECRET && CLOB_API_PASSPHRASE
    ? { key: CLOB_API_KEY, secret: CLOB_API_SECRET, passphrase: CLOB_API_PASSPHRASE }
    : undefined;

if (!DATABASE_URL) {
    console.error('[ManagedLiquidationWorker] Missing DATABASE_URL');
    process.exit(1);
}

if (!TRADING_PRIVATE_KEY) {
    console.error('[ManagedLiquidationWorker] Missing TRADING_PRIVATE_KEY');
    process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(TRADING_PRIVATE_KEY, provider);

const rateLimiter = new RateLimiter();
const cache = createUnifiedCache();
const tradingService = new TradingService(rateLimiter, cache, {
    privateKey: TRADING_PRIVATE_KEY,
    chainId: CHAIN_ID,
    credentials: clobCredentials,
});
const executionService = new CopyTradingExecutionService(tradingService, signer, CHAIN_ID);

let running = false;

type ManagedOpenPosition = {
    source: 'SCOPED' | 'LEGACY';
    walletAddress: string;
    tokenId: string;
    balance: number;
    avgEntryPrice: number;
    totalCost: number;
};

function stringifyError(error: unknown): string {
    if (error instanceof Error) return error.message.slice(0, 400);
    return String(error).slice(0, 400);
}

function computeRetryDelayMs(attemptCount: number): number {
    const factor = Math.max(0, attemptCount - 1);
    return Math.min(MAX_RETRY_MS, BASE_RETRY_MS * Math.pow(2, factor));
}

function getBestBidPrice(orderbook: unknown): number {
    const bestBid = Number((orderbook as { bids?: Array<{ price?: number | string }> })?.bids?.[0]?.price || 0);
    if (!Number.isFinite(bestBid) || bestBid <= 0) return 0;
    return bestBid;
}

async function markTask(
    taskId: string,
    data: Prisma.ManagedLiquidationTaskUpdateInput
): Promise<void> {
    await prisma.managedLiquidationTask.update({
        where: { id: taskId },
        data,
    });
}

async function claimDueTasks(now: Date): Promise<ManagedLiquidationTask[]> {
    const candidates = await prisma.managedLiquidationTask.findMany({
        where: {
            status: { in: ['PENDING', 'RETRYING'] },
            OR: [
                { nextRetryAt: null },
                { nextRetryAt: { lte: now } },
            ],
        },
        orderBy: [
            { nextRetryAt: 'asc' },
            { updatedAt: 'asc' },
        ],
        take: BATCH_SIZE,
    });

    const claimed: ManagedLiquidationTask[] = [];
    const leaseUntil = new Date(now.getTime() + PROCESSING_LEASE_MS);

    for (const candidate of candidates) {
        const claim = await prisma.managedLiquidationTask.updateMany({
            where: {
                id: candidate.id,
                status: { in: ['PENDING', 'RETRYING'] },
                OR: [
                    { nextRetryAt: null },
                    { nextRetryAt: { lte: now } },
                ],
            },
            data: {
                status: 'RETRYING',
                attemptCount: { increment: 1 },
                lastAttemptAt: now,
                nextRetryAt: leaseUntil,
                errorCode: 'LIQUIDATION_EXECUTING',
                errorMessage: 'Liquidation task claimed by executor',
            },
        });

        if (claim.count <= 0) continue;

        const task = await prisma.managedLiquidationTask.findUnique({
            where: { id: candidate.id },
        });
        if (task) {
            claimed.push(task);
        }
    }

    return claimed;
}

async function loadTaskPosition(task: ManagedLiquidationTask): Promise<ManagedOpenPosition | null> {
    const openPositions = await listManagedOpenPositionsWithFallback(prisma, {
        subscriptionId: task.subscriptionId,
        walletAddress: task.walletAddress,
        copyConfigId: task.copyConfigId,
    });
    const matched = openPositions.find((position) => position.tokenId === task.tokenId && position.balance > 0);
    if (!matched) return null;
    return matched as ManagedOpenPosition;
}

async function persistSuccessfulLiquidation(input: {
    task: ManagedLiquidationTask;
    position: ManagedOpenPosition;
    subscriptionWallet: string;
    copyConfigId: string;
    filledShares: number;
    executedNotionalUsd: number;
    executionPrice: number;
    orderId: string | null;
    txHash: string | null;
    usedBotFloat: boolean;
    now: Date;
}): Promise<void> {
    await prisma.$transaction(async (tx) => {
        let settledShares = input.filledShares;
        let avgEntryPrice = input.position.avgEntryPrice;
        let remainingBalance = 0;

        if (input.position.source === 'SCOPED') {
            const scoped = await tx.managedSubscriptionPosition.findUnique({
                where: {
                    subscriptionId_tokenId: {
                        subscriptionId: input.task.subscriptionId,
                        tokenId: input.task.tokenId,
                    },
                },
            });

            if (!scoped || scoped.balance <= 0) {
                await tx.managedLiquidationTask.update({
                    where: { id: input.task.id },
                    data: {
                        status: 'COMPLETED',
                        nextRetryAt: null,
                        errorCode: null,
                        errorMessage: null,
                        lastAttemptAt: input.now,
                    },
                });
                return;
            }

            settledShares = Math.min(settledShares, scoped.balance);
            avgEntryPrice = scoped.avgEntryPrice;
            remainingBalance = Math.max(0, scoped.balance - settledShares);

            await tx.managedSubscriptionPosition.update({
                where: { id: scoped.id },
                data: {
                    balance: remainingBalance,
                    totalCost: remainingBalance > 0 ? scoped.avgEntryPrice * remainingBalance : 0,
                    avgEntryPrice: remainingBalance > 0 ? scoped.avgEntryPrice : 0,
                },
            });
        } else {
            const legacy = await tx.userPosition.findFirst({
                where: {
                    walletAddress: input.subscriptionWallet,
                    tokenId: input.task.tokenId,
                    balance: { gt: 0 },
                },
                orderBy: { createdAt: 'asc' },
            });

            if (!legacy) {
                await tx.managedLiquidationTask.update({
                    where: { id: input.task.id },
                    data: {
                        status: 'COMPLETED',
                        nextRetryAt: null,
                        errorCode: null,
                        errorMessage: null,
                        lastAttemptAt: input.now,
                    },
                });
                return;
            }

            settledShares = Math.min(settledShares, legacy.balance);
            avgEntryPrice = legacy.avgEntryPrice;
            remainingBalance = Math.max(0, legacy.balance - settledShares);

            await tx.userPosition.update({
                where: { id: legacy.id },
                data: {
                    balance: remainingBalance,
                    totalCost: remainingBalance > 0 ? legacy.avgEntryPrice * remainingBalance : 0,
                    avgEntryPrice: remainingBalance > 0 ? legacy.avgEntryPrice : 0,
                },
            });
        }

        const effectivePrice = settledShares > 0
            ? Number((input.executedNotionalUsd / settledShares).toFixed(8))
            : input.executionPrice;
        const realizedPnl = Number((settledShares * (effectivePrice - avgEntryPrice)).toFixed(8));

        await tx.copyTrade.upsert({
            where: {
                idempotencyKey: `managed-liquidation:${input.task.id}:attempt-${input.task.attemptCount}`,
            },
            update: {
                copySize: Number(input.executedNotionalUsd.toFixed(8)),
                copyPrice: Number(effectivePrice.toFixed(8)),
                status: 'EXECUTED',
                txHash: input.txHash,
                realizedPnl,
                usedBotFloat: input.usedBotFloat,
                executedBy: signer.address.toLowerCase(),
                executedAt: input.now,
            },
            create: {
                idempotencyKey: `managed-liquidation:${input.task.id}:attempt-${input.task.attemptCount}`,
                configId: input.copyConfigId,
                originalTrader: 'MANAGED_LIQUIDATION_ENGINE',
                originalSide: 'SELL',
                originalSize: Number(settledShares.toFixed(8)),
                originalPrice: Number(input.executionPrice.toFixed(8)),
                originalTxHash: input.orderId ? `managed-liq:${input.orderId}` : null,
                tokenId: input.task.tokenId,
                copySize: Number(input.executedNotionalUsd.toFixed(8)),
                copyPrice: Number(effectivePrice.toFixed(8)),
                status: 'EXECUTED',
                txHash: input.txHash,
                errorMessage: `Managed liquidation task ${input.task.id}`,
                realizedPnl,
                usedBotFloat: input.usedBotFloat,
                executedBy: signer.address.toLowerCase(),
                detectedAt: input.now,
                executedAt: input.now,
            },
        });

        if (remainingBalance <= 0.000001) {
            await tx.managedLiquidationTask.update({
                where: { id: input.task.id },
                data: {
                    requestedShares: 0,
                    indicativePrice: effectivePrice,
                    notionalUsd: Number(input.executedNotionalUsd.toFixed(8)),
                    status: 'COMPLETED',
                    nextRetryAt: null,
                    errorCode: null,
                    errorMessage: null,
                    lastAttemptAt: input.now,
                },
            });
            return;
        }

        const retryAt = new Date(input.now.getTime() + computeRetryDelayMs(input.task.attemptCount));
        await tx.managedLiquidationTask.update({
            where: { id: input.task.id },
            data: {
                requestedShares: Number(remainingBalance.toFixed(8)),
                indicativePrice: effectivePrice,
                notionalUsd: Number((remainingBalance * effectivePrice).toFixed(8)),
                status: 'RETRYING',
                nextRetryAt: retryAt,
                errorCode: 'PARTIAL_LIQUIDATION_RETRY',
                errorMessage: 'Partially liquidated; retry remaining shares',
                lastAttemptAt: input.now,
            },
        });
    });
}

async function markRetryOrFailure(task: ManagedLiquidationTask, now: Date, errorCode: string, message: string): Promise<void> {
    if (task.attemptCount >= MAX_ATTEMPTS) {
        await markTask(task.id, {
            status: 'FAILED',
            nextRetryAt: null,
            errorCode,
            errorMessage: `${message} (max attempts reached)`,
            lastAttemptAt: now,
        });
        return;
    }

    const retryAt = new Date(now.getTime() + computeRetryDelayMs(task.attemptCount));
    await markTask(task.id, {
        status: 'RETRYING',
        nextRetryAt: retryAt,
        errorCode,
        errorMessage: message,
        lastAttemptAt: now,
    });
}

async function processTask(task: ManagedLiquidationTask, now: Date): Promise<'completed' | 'retry' | 'blocked' | 'failed'> {
    const subscription = await prisma.managedSubscription.findUnique({
        where: { id: task.subscriptionId },
        select: {
            id: true,
            walletAddress: true,
            status: true,
            copyConfigId: true,
        },
    });

    if (!subscription) {
        await markTask(task.id, {
            status: 'FAILED',
            nextRetryAt: null,
            errorCode: 'SUBSCRIPTION_NOT_FOUND',
            errorMessage: 'Managed subscription not found',
            lastAttemptAt: now,
        });
        return 'failed';
    }

    if (subscription.status !== 'LIQUIDATING') {
        await markTask(task.id, {
            status: 'BLOCKED',
            nextRetryAt: null,
            errorCode: 'SUBSCRIPTION_NOT_LIQUIDATING',
            errorMessage: `Subscription status is ${subscription.status}`,
            lastAttemptAt: now,
        });
        return 'blocked';
    }

    const position = await loadTaskPosition(task);
    if (!position) {
        await markTask(task.id, {
            status: 'COMPLETED',
            requestedShares: 0,
            nextRetryAt: null,
            errorCode: null,
            errorMessage: null,
            lastAttemptAt: now,
        });
        return 'completed';
    }

    const copyConfigId = subscription.copyConfigId || task.copyConfigId;
    if (!copyConfigId) {
        await markTask(task.id, {
            status: 'BLOCKED',
            nextRetryAt: null,
            errorCode: 'MISSING_COPY_CONFIG',
            errorMessage: 'Managed liquidation requires copy config linkage',
            lastAttemptAt: now,
        });
        return 'blocked';
    }

    const targetShares = Number((Math.min(position.balance, Math.max(task.requestedShares, 0)) || position.balance).toFixed(8));
    if (!Number.isFinite(targetShares) || targetShares <= 0) {
        await markTask(task.id, {
            status: 'COMPLETED',
            requestedShares: 0,
            nextRetryAt: null,
            errorCode: null,
            errorMessage: null,
            lastAttemptAt: now,
        });
        return 'completed';
    }

    const orderbook = await tradingService.getOrderBook(task.tokenId);
    const bestBidPrice = getBestBidPrice(orderbook);
    if (bestBidPrice <= 0) {
        await markRetryOrFailure(task, now, 'NO_BID_LIQUIDITY', 'No executable bid liquidity for liquidation');
        return task.attemptCount >= MAX_ATTEMPTS ? 'failed' : 'retry';
    }

    const notionalUsd = Number((targetShares * bestBidPrice).toFixed(8));
    if (notionalUsd < MIN_NOTIONAL_USD) {
        await markTask(task.id, {
            status: 'BLOCKED',
            nextRetryAt: null,
            errorCode: 'NOTIONAL_BELOW_MIN_ORDER',
            errorMessage: `Notional ${notionalUsd.toFixed(6)} below minimum ${MIN_NOTIONAL_USD}`,
            lastAttemptAt: now,
        });
        return 'blocked';
    }

    const execution = await executionService.executeOrderWithProxy({
        tradeId: `managed-liquidation:${task.id}:attempt-${task.attemptCount}`,
        walletAddress: subscription.walletAddress,
        tokenId: task.tokenId,
        side: 'SELL',
        amount: notionalUsd,
        price: bestBidPrice,
        executionMode: 'PROXY',
        allowPartialFill: true,
    });

    if (!execution.success) {
        const errorMessage = execution.error || 'Liquidation execution failed';
        if (errorMessage.includes('No Proxy wallet found for user')) {
            await markTask(task.id, {
                status: 'BLOCKED',
                nextRetryAt: null,
                errorCode: 'MISSING_PROXY_WALLET',
                errorMessage,
                lastAttemptAt: now,
            });
            return 'blocked';
        }

        if (errorMessage.includes('Insufficient Proxy funds')) {
            await markTask(task.id, {
                status: 'BLOCKED',
                nextRetryAt: null,
                errorCode: 'INSUFFICIENT_PROXY_FUNDS',
                errorMessage,
                lastAttemptAt: now,
            });
            return 'blocked';
        }

        await markRetryOrFailure(task, now, 'EXECUTION_FAILED', errorMessage);
        return task.attemptCount >= MAX_ATTEMPTS ? 'failed' : 'retry';
    }

    const filledShares = Number(execution.filledShares || targetShares);
    if (!Number.isFinite(filledShares) || filledShares <= 0) {
        await markRetryOrFailure(task, now, 'ZERO_FILLED_SHARES', 'Execution returned zero filled shares');
        return task.attemptCount >= MAX_ATTEMPTS ? 'failed' : 'retry';
    }

    const executedNotionalUsd = Number(execution.actualSellProceedsUsdc || execution.executedAmount || notionalUsd);
    const txHash = execution.orderId || execution.transactionHashes?.[0] || null;

    await persistSuccessfulLiquidation({
        task,
        position,
        subscriptionWallet: subscription.walletAddress,
        copyConfigId,
        filledShares,
        executedNotionalUsd,
        executionPrice: bestBidPrice,
        orderId: execution.orderId || null,
        txHash,
        usedBotFloat: Boolean(execution.usedBotFloat),
        now,
    });
    return 'completed';
}

async function runCycle(): Promise<void> {
    if (running) {
        console.warn('[ManagedLiquidationWorker] Previous cycle is still running, skipping tick');
        return;
    }
    running = true;
    const started = Date.now();
    const now = new Date();
    let claimed = 0;
    let completed = 0;
    let retried = 0;
    let blocked = 0;
    let failed = 0;

    try {
        const tasks = await claimDueTasks(now);
        claimed = tasks.length;

        for (const task of tasks) {
            try {
                const outcome = await processTask(task, now);
                if (outcome === 'completed') completed += 1;
                if (outcome === 'retry') retried += 1;
                if (outcome === 'blocked') blocked += 1;
                if (outcome === 'failed') failed += 1;
            } catch (error) {
                failed += 1;
                await markRetryOrFailure(
                    task,
                    now,
                    'UNHANDLED_EXECUTION_ERROR',
                    stringifyError(error)
                );
            }
        }
    } catch (error) {
        console.error('[ManagedLiquidationWorker] cycle failed:', error);
    } finally {
        const elapsed = Date.now() - started;
        console.log(
            `[ManagedLiquidationWorker] cycle done in ${elapsed}ms | claimed=${claimed} completed=${completed} retried=${retried} blocked=${blocked} failed=${failed}`
        );
        running = false;
    }
}

async function shutdown(signal: string): Promise<void> {
    console.log(`[ManagedLiquidationWorker] received ${signal}, shutting down...`);
    try {
        await prisma.$disconnect();
        await pool.end();
    } finally {
        process.exit(0);
    }
}

process.on('SIGINT', () => {
    void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});

async function main(): Promise<void> {
    await tradingService.initialize();
    console.log(`[ManagedLiquidationWorker] started | runOnce=${RUN_ONCE} intervalMs=${LOOP_INTERVAL_MS} batch=${BATCH_SIZE}`);

    await runCycle();

    if (RUN_ONCE) {
        await shutdown('RUN_ONCE_COMPLETE');
        return;
    }

    setInterval(() => {
        void runCycle();
    }, LOOP_INTERVAL_MS);
}

void main().catch(async (error) => {
    console.error('[ManagedLiquidationWorker] fatal:', error);
    await shutdown('FATAL_ERROR');
});
