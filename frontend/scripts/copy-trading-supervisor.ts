/**
 * Copy Trading Supervisor (Enterprise Edition)
 * 
 * Architecture:
 * - Detector: Listens for TransferSingle events (Real-time).
 * - Dispatcher: Finds all subscribers for the signal.
 * - WalletFleet: Manages pool of Operator Wallets (Signers).
 * - Executor: Executes copies in parallel using distinct wallets to avoid Nonce blocking.
 * 
 * Usage:
 * export $(grep -v '^#' .env | xargs) && npx tsx scripts/copy-trading-supervisor.ts
 */

import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import path from 'path';
import { ethers } from 'ethers';
import { EncryptionService } from '../../src/core/encryption.js'; // Import EncryptionService
import { CONTRACT_ADDRESSES, CTF_ABI } from '../../src/core/contracts';
import { CopyTradingExecutionService, ExecutionParams } from '../../src/services/copy-trading-execution-service';
import { TradingService, TradeInfo } from '../../src/services/trading-service';
import { RateLimiter } from '../../src/core/rate-limiter';
import { createUnifiedCache, UnifiedCache } from '../../src/core/unified-cache';
import { WalletManager, WorkerContext } from '../../src/core/wallet-manager';
import { MempoolDetector } from '../../src/core/mempool-detector';
import { TaskQueue } from '../../src/core/task-queue';
import { DebtManager } from '../../src/core/debt-manager';
import { MarketService } from '../../src/services/market-service';
import { GammaApiClient } from '../../src/clients/gamma-api';
import { DataApiClient } from '../../src/clients/data-api';

import { PrismaDebtLogger, PrismaDebtRepository } from './services/debt-adapters';
import { AffiliateEngine } from '../lib/services/affiliate-engine';
import { PositionService } from '../lib/services/position-service';
import { RealtimeServiceV2, ActivityTrade } from '../../src/services/realtime-service-v2';
import { TxMonitor, TrackedTx } from '../../src/core/tx-monitor';

// --- CONFIG ---
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "31337");
const DRY_RUN = process.env.DRY_RUN === 'true';

// Env checks
if (!process.env.TRADING_PRIVATE_KEY) {
    console.error("Missing TRADING_PRIVATE_KEY in .env");
    process.exit(1);
}
if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL in .env");
    process.exit(1);
}

// Global Master Key (for backup / initialization)
const MASTER_PRIVATE_KEY = process.env.TRADING_PRIVATE_KEY;
// For Fleet, we ideally want a Mnemonic. 
let MASTER_MNEMONIC = process.env.TRADING_MNEMONIC || "";

// Fallback: Use default test mnemonic if on Localhost and no mnemonic provided
if (!MASTER_MNEMONIC && (RPC_URL.includes("localhost") || RPC_URL.includes("127.0.0.1"))) {
    console.warn("[Supervisor] ⚠️ Dev Environment detected: Using DEFAULT TEST MNEMONIC for Fleet.");
    MASTER_MNEMONIC = "test test test test test test test test test test test junk";
}

// --- INITIALIZATION ---
if (DRY_RUN) {
    console.log('[Supervisor] ⚠️ DRY_RUN MODE ENABLED - No trades will be executed');
}
console.log(`[Supervisor] 🌍 Network: ${process.env.NEXT_PUBLIC_NETWORK}`);
console.log(`[Supervisor] 🔌 RPC: ${RPC_URL}`);
console.log(`[Supervisor] 🏭 ProxyFactory: ${CONTRACT_ADDRESSES.polygon.proxyFactory}`);
console.log(`[Supervisor] 🏢 Executor: ${CONTRACT_ADDRESSES.polygon.executor}`);
console.log(`[Supervisor] 🏛️  CTF: ${CONTRACT_ADDRESSES.ctf}`);
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

const debtRepository = new PrismaDebtRepository(prisma);
const debtLogger = new PrismaDebtLogger(prisma);
const affiliateEngine = new AffiliateEngine(prisma);
const positionService = new PositionService(prisma);

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

// Infrastructure
const rateLimiter = new RateLimiter();
// Cache: Redis would be better for Prod, currently In-Memory for Supervisor
const cache = createUnifiedCache();

// Helpers
const realtimeService = new RealtimeServiceV2({
    autoReconnect: true,
    pingInterval: 1000, // Aggressive 1s KeepAlive for low latency
    debug: false
});

// Core Services
const gammaApi = new GammaApiClient(rateLimiter, cache);
const dataApi = new DataApiClient(rateLimiter, cache);
const marketService = new MarketService(gammaApi, dataApi, rateLimiter, cache, { chainId: CHAIN_ID });

// 1. Master Trading Service (for read-only or fallback)
const masterTradingService = new TradingService(
    rateLimiter,
    cache,
    {
        privateKey: MASTER_PRIVATE_KEY,
        chainId: CHAIN_ID
    }
);

// 2. Execution Service (Logic Container)
const executionService = new CopyTradingExecutionService(masterTradingService, masterTradingService.getWallet(), CHAIN_ID, debtLogger);

// 3. Wallet Manager (The Fleet)
let walletManager: WalletManager | null = null;
let debtManager: DebtManager | null = null;

// --- SHUTDOWN HANDLING ---
let isShuttingDown = false;

async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[Supervisor] 🛑 Received ${signal}. Shutting down gracefully...`);

    // 1. Stop accepting new jobs
    // (Supervisor loop checks isShuttingDown implicitly by process exiting, but we can be explicit if we had a loop flag)

    // 2. Close WebSocket
    console.log("[Supervisor] 🔌 Disconnecting WebSocket...");
    try {
        // Assuming disconnect type exists on V2, if not we rely on process exit
        // realtimeService.disconnect(); 
    } catch (e) {
        console.error("WS invalid disconnect", e);
    }

    // 3. Close Database Pool
    console.log("[Supervisor] 💾 Disconnecting Database...");
    try {
        await prisma.$disconnect();
    } catch (e) {
        console.error("DB disconnect error", e);
    }

    console.log("[Supervisor] 👋 Goodbye.");
    process.exit(0);
}

// --- STATE ---
interface ActiveConfig {
    id: string;
    walletAddress: string; // User
    traderAddress: string; // Trader
    fixedAmount?: number;
    sizeScale?: number;
    maxSlippage: number;
    slippageType: 'FIXED' | 'AUTO';
    autoExecute: boolean;
    // Execution Mode
    executionMode: 'PROXY' | 'EOA';
    encryptedKey?: string;
    iv?: string;
    // Filter Fields
    minLiquidity?: number;
    minVolume?: number;
    maxOdds?: number;
}

let activeConfigs: ActiveConfig[] = [];
let monitoredTraders: Set<string> = new Set();
let isProcessing = false;

// --- QUEUE ---
interface JobQueueItem {
    config: ActiveConfig;
    side: 'BUY' | 'SELL';
    tokenId: string;
    approxPrice: number;
    originalTrader: string;
    originalSize: number;
    isPreflight: boolean;
    overrides?: ethers.Overrides;
}
const jobQueue = new TaskQueue<JobQueueItem>(1000);

// --- HEALTH METRICS ---
interface Metrics {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    totalLatencyMs: number;
    lastResetAt: number;
}
const metrics: Metrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalLatencyMs: 0,
    lastResetAt: Date.now(),
};

function recordExecution(success: boolean, latencyMs: number): void {
    metrics.totalExecutions++;
    if (success) metrics.successfulExecutions++;
    else metrics.failedExecutions++;
    metrics.totalLatencyMs += latencyMs;
}

function logMetricsSummary(): void {
    const duration = (Date.now() - metrics.lastResetAt) / 1000 / 60; // minutes
    const avgLatency = metrics.totalExecutions > 0
        ? (metrics.totalLatencyMs / metrics.totalExecutions / 1000).toFixed(2)
        : '0';
    const successRate = metrics.totalExecutions > 0
        ? ((metrics.successfulExecutions / metrics.totalExecutions) * 100).toFixed(1)
        : '100';

    console.log(`[Metrics] 📊 Last ${duration.toFixed(1)}min: ${metrics.totalExecutions} executions, ${successRate}% success, ${avgLatency}s avg latency`);

    // Reset for next period
    metrics.totalExecutions = 0;
    metrics.successfulExecutions = 0;
    metrics.failedExecutions = 0;
    metrics.totalLatencyMs = 0;
    metrics.lastResetAt = Date.now();
}

// --- PRICE CACHE (5 second TTL) ---
const priceCache = new Map<string, { price: number; timestamp: number }>();
const PRICE_CACHE_TTL = 5000;

async function getCachedPrice(tokenId: string, side: 'BUY' | 'SELL'): Promise<number> {
    const cached = priceCache.get(tokenId);
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
        return cached.price;
    }
    try {
        const ob = await masterTradingService.getOrderBook(tokenId);
        const price = side === 'BUY'
            ? Number(ob.asks[0]?.price || 0.5)
            : Number(ob.bids[0]?.price || 0.5);
        priceCache.set(tokenId, { price, timestamp: Date.now() });
        console.log(`[Supervisor] 💰 Price fetched for ${tokenId}: $${price.toFixed(4)}`);
        return price;
    } catch (e: any) {
        console.warn(`[Supervisor] Price fetch failed for ${tokenId}: ${e.message}`);
        return cached?.price || 0.5;
    }
}

// --- POSITION CACHE (for fast sell-skip checks) ---
// Maps: walletAddress -> tokenId -> balance
const userPositionsCache = new Map<string, Map<string, number>>();
const POSITION_CACHE_REFRESH_INTERVAL = 5 * 60 * 1000; // Refresh every 5 minutes

/**
 * Preload all user positions from database into memory cache
 * This enables instant sell-skip checks without database queries
 */
async function preloadUserPositions(): Promise<void> {
    try {
        console.log('[Supervisor] 📦 Preloading user positions...');

        const positions = await prisma.userPosition.findMany({
            where: {
                balance: { gt: 0 } // Only load positions with balance
            },
            select: {
                walletAddress: true,
                tokenId: true,
                balance: true
            }
        });

        // Clear and rebuild cache
        userPositionsCache.clear();

        for (const pos of positions) {
            const wallet = pos.walletAddress.toLowerCase();
            if (!userPositionsCache.has(wallet)) {
                userPositionsCache.set(wallet, new Map());
            }
            userPositionsCache.get(wallet)!.set(pos.tokenId, pos.balance);
        }

        console.log(`[Supervisor] ✅ Loaded ${positions.length} positions for ${userPositionsCache.size} wallets`);
    } catch (error: any) {
        console.error('[Supervisor] ❌ Failed to preload positions:', error.message);
    }
}

/**
 * Fast check if user has position in a token (no database query)
 * Returns true if user has balance > 0
 */
function hasPosition(walletAddress: string, tokenId: string): boolean {
    const wallet = walletAddress.toLowerCase();
    const positions = userPositionsCache.get(wallet);
    if (!positions) return false;

    const balance = positions.get(tokenId) || 0;
    return balance > 0;
}

/**
 * Update position cache after trade execution
 * Call this after successful buy/sell to keep cache in sync
 */
function updatePositionCache(walletAddress: string, tokenId: string, balanceChange: number): void {
    const wallet = walletAddress.toLowerCase();
    if (!userPositionsCache.has(wallet)) {
        userPositionsCache.set(wallet, new Map());
    }

    const positions = userPositionsCache.get(wallet)!;
    const currentBalance = positions.get(tokenId) || 0;
    const newBalance = currentBalance + balanceChange;

    if (newBalance <= 0) {
        positions.delete(tokenId); // Remove zero/negative balances
    } else {
        positions.set(tokenId, newBalance);
    }
}

// --- EVENT DEDUPLICATION (60 second TTL) ---
// Uses txHash-only as key for cross-channel deduplication (WS + Chain)
const processedEvents = new Map<string, number>();
const EVENT_TTL = 60_000;

function isEventDuplicate(txHash: string): boolean {
    const ts = processedEvents.get(txHash);
    if (ts && Date.now() - ts < EVENT_TTL) {
        // Silently ignore duplicates (dedup working correctly)
        return true;
    }
    processedEvents.set(txHash, Date.now());
    // Cleanup old entries periodically
    if (processedEvents.size > 1000) {
        const now = Date.now();
        for (const [k, v] of processedEvents.entries()) {
            if (now - v > EVENT_TTL) processedEvents.delete(k);
        }
    }
    return false;
}

// --- FILTER VALIDATION ---
interface FilterResult {
    passes: boolean;
    reason?: string;
}

async function passesFilters(
    config: ActiveConfig,
    tokenId: string,
    side: 'BUY' | 'SELL',
    price: number
): Promise<FilterResult> {
    // maxOdds filter: Skip trades on very high probability outcomes
    if (config.maxOdds && side === 'BUY') {
        if (price > config.maxOdds) {
            return {
                passes: false,
                reason: `maxOdds filter failed: price ${(price * 100).toFixed(1)}% > max ${(config.maxOdds * 100).toFixed(1)}%`
            };
        }
    }

    // minLiquidity and minVolume would require market API calls
    // For MVP, we only enforce maxOdds which uses price already fetched
    // TODO: Add market liquidity/volume checks when market API is integrated

    return { passes: true };
}

async function checkQueue() {
    if (jobQueue.isEmpty) return;

    // Try to get a worker
    const worker = walletManager ? walletManager.checkoutWorker() : null;
    if (!worker) return; // Still no workers

    // Get next job
    const job = jobQueue.dequeue();
    if (job) {
        console.log(`[Supervisor] 📥 Dequeued job for User ${job.config.walletAddress}. Remaining: ${jobQueue.length}`);
        // Execute (Don't await, let it run in background)
        executeJobInternal(
            worker,
            job.config,
            job.side,
            job.tokenId,
            job.approxPrice,
            job.originalTrader,
            job.originalSize,
            job.isPreflight
        );
    }
}

// --- HELPERS ---
async function refreshConfigs() {
    try {
        const configs = await prisma.copyTradingConfig.findMany({
            where: {
                isActive: true,
                autoExecute: true,
                channel: 'EVENT_LISTENER'
            }
        });

        activeConfigs = configs.map(c => ({
            id: c.id,
            walletAddress: c.walletAddress,
            traderAddress: c.traderAddress,
            fixedAmount: c.fixedAmount || undefined,
            sizeScale: c.sizeScale || undefined,
            maxSlippage: c.maxSlippage,
            slippageType: c.slippageType as 'FIXED' | 'AUTO',
            autoExecute: c.autoExecute,
            executionMode: c.executionMode as 'PROXY' | 'EOA',
            encryptedKey: c.encryptedKey || undefined,
            iv: c.iv || undefined,
            // Filter Fields
            minLiquidity: c.minLiquidity || undefined,
            minVolume: c.minVolume || undefined,
            maxOdds: c.maxOdds || undefined
        }));

        monitoredTraders = new Set(activeConfigs.map(c => c.traderAddress.toLowerCase()));

        const stats = walletManager ? walletManager.getStats() : { total: 1, available: 1 };
        console.log(`[Supervisor] Refreshed: ${activeConfigs.length} strategies. Fleet: ${stats.available}/${stats.total} ready.`);

        // Update Mempool Detector
        if (mempoolDetector) {
            mempoolDetector.updateMonitoredTraders(monitoredTraders);
        }

    } catch (e) {
        console.error("[Supervisor] Config refresh failed:", e);
    }
}

async function getMarketMetadata(tokenId: string) {
    try {
        // Use MarketService to get CLOB Market info via Orderbook
        const book = await marketService.getTokenOrderbook(tokenId);
        if (!book.market) throw new Error("No market ID in orderbook");
        const market = await marketService.getClobMarket(book.market);

        // Find specific token outcome
        const token = market.tokens.find(t => t.tokenId === tokenId);

        return {
            marketSlug: market.marketSlug || 'unknown-market',
            conditionId: market.conditionId,
            outcome: token?.outcome || 'Yes'
        };
    } catch (e) {
        // Fallback for missing simulated markets
        return {
            marketSlug: 'unknown-simulated',
            conditionId: '0x0',
            outcome: 'Yes'
        };
    }
}

async function handleTransfer(
    operator: string,
    from: string,
    to: string,
    id: ethers.BigNumber,
    value: ethers.BigNumber,
    event: ethers.Event
) {
    // Deduplicate events to prevent double execution (unified txHash-only)
    const txHash = event.transactionHash;
    if (isEventDuplicate(txHash)) {
        return;
    }

    try {
        const tokenId = id.toString();
        const amountValues = value.toString();
        const originalSize = parseFloat(amountValues) / 1e6;

        // 1. Identify Trader
        let trader: string | null = null;
        let side: 'BUY' | 'SELL' | null = null;

        if (monitoredTraders.has(to.toLowerCase())) {
            trader = to.toLowerCase();
            side = 'BUY';
        } else if (monitoredTraders.has(from.toLowerCase())) {
            trader = from.toLowerCase();
            side = 'SELL';
        }

        if (!trader || !side) return;

        console.log(`[Supervisor] 🚨 SIGNAL DETECTED: Trader ${trader} ${side} Token ${tokenId}`);

        // 2. Find subscribers
        const subscribers = activeConfigs.filter(c => c.traderAddress.toLowerCase() === trader);
        if (subscribers.length === 0) return;

        console.log(`[Supervisor] Dispatching ${subscribers.length} jobs...`);

        // 3. Fetch real market price (cached)
        const price = await getCachedPrice(tokenId, side);

        // 4. PARALLEL EXECUTION LOOP
        subscribers.forEach(async (sub) => {
            await processJob(sub, side!, tokenId, price, trader!, originalSize);
        });

    } catch (error) {
        console.error(`[Supervisor] Event processing error:`, error);
    }
}

// Handler for Mempool Logic
const handleSniffedTx = async (
    txHash: string,
    operator: string,
    from: string,
    to: string,
    id: ethers.BigNumber,
    value: ethers.BigNumber,
    gasInfo?: { maxFeePerGas?: ethers.BigNumber, maxPriorityFeePerGas?: ethers.BigNumber }
) => {
    // 0. Calculate Gas Boost (Front-Running)
    let overrides: ethers.Overrides = {};
    if (gasInfo && gasInfo.maxFeePerGas && gasInfo.maxPriorityFeePerGas) {
        // Boost by 10% (1.10) or more
        const BOOST_FACTOR = 115; // 115 = 1.15
        overrides = {
            maxFeePerGas: gasInfo.maxFeePerGas.mul(BOOST_FACTOR).div(100),
            maxPriorityFeePerGas: gasInfo.maxPriorityFeePerGas.mul(BOOST_FACTOR).div(100)
        };
        console.log(`[Supervisor] 🚀 Gas Boost: Target ${ethers.utils.formatUnits(gasInfo.maxPriorityFeePerGas, 'gwei')} -> Boosted ${ethers.utils.formatUnits(overrides.maxPriorityFeePerGas as ethers.BigNumber, 'gwei')} Gwei`);
    }

    // Deduplication: If we process mempool, we should cache the 'id/hash' so the Event Listener doesn't double-execute?
    // Or we simply let the second execution fail/idempotency check.
    // For now, let's just log and trigger.

    if (isProcessing) return;

    try {
        const tokenId = id.toString();
        const amountValues = value.toString();
        const originalSize = parseFloat(amountValues) / 1e6;

        let trader: string | null = null;
        let side: 'BUY' | 'SELL' | null = null;

        // Sniffed data logic same as Event (SafeTransferFrom)
        if (monitoredTraders.has(to.toLowerCase())) {
            trader = to.toLowerCase();
            side = 'BUY';
        } else if (monitoredTraders.has(from.toLowerCase())) {
            trader = from.toLowerCase();
            side = 'SELL';
        }

        if (!trader || !side) return;

        console.log(`[Supervisor] 🦈 MEMPOOL SNIPING: Trader ${trader} ${side} Token ${tokenId} (Pending Tx: ${txHash})`);

        // Dispatch Jobs immediately
        const subscribers = activeConfigs.filter(c => c.traderAddress.toLowerCase() === trader);

        if (subscribers.length === 0) return;

        // Price might be slightly different as it's pending, but we use strict/market anyway.
        const PRICE_PLACEHOLDER = 0.5;

        for (const config of subscribers) {
            // Process Job (Pass 1000 shares example size if needed, mostly fixedAmount uses config)
            processJob(config, side, tokenId, PRICE_PLACEHOLDER, trader, originalSize, true, overrides);
        }

    } catch (e) {
        console.error(`[Supervisor] Mempool sniff error:`, e);
    }
};

async function processJob(
    config: ActiveConfig,
    side: 'BUY' | 'SELL',
    tokenId: string,
    approxPrice: number,
    originalTrader: string,
    originalSize: number,
    isPreflight: boolean = false,
    overrides?: ethers.Overrides
) {
    if (isShuttingDown) {
        console.log(`[Supervisor] 🛑 Order Skipped (Shutting Down): ${config.walletAddress} ${side} ${tokenId}`);
        return;
    }

    // 0. Fast SELL-skip check (no database query needed)
    if (side === 'SELL') {
        if (!hasPosition(config.walletAddress, tokenId)) {
            console.log(`[Supervisor] ⏭️  SKIPPED SELL (no position): ${config.walletAddress.substring(0, 10)}... token ${tokenId.substring(0, 20)}...`);
            return;
        }
    }

    // 1. Validate filters before allocating resources
    const filterResult = await passesFilters(config, tokenId, side, approxPrice);
    if (!filterResult.passes) {
        console.log(`[Supervisor] 🔕 Trade skipped for ${config.walletAddress}: ${filterResult.reason}`);
        return;
    }

    // 2. Try Checkout Worker OR EOA Signer
    let worker: WorkerContext | null = null;
    let eoaSigner: ethers.Wallet | null = null;
    let eoaTradingService: TradingService | null = null;

    if (config.executionMode === 'EOA') {
        // EOA Mode: Decrypt and Create Wallet
        if (config.encryptedKey && config.iv) {
            try {
                const privateKey = EncryptionService.decrypt(config.encryptedKey, config.iv);
                const userWallet = new ethers.Wallet(privateKey, provider);
                eoaSigner = userWallet;
                worker = {
                    address: userWallet.address,
                    signer: userWallet,
                    tradingService: masterTradingService
                };
            } catch (e) {
                console.error(`[Supervisor] Decryption failed for user ${config.walletAddress}:`, e);
                return;
            }
        }
    } else {
        // Proxy Mode: Checkout Worker
        if (walletManager) {
            worker = walletManager.checkoutWorker();
        } else {
            // Fallback logic...
            const masterWallet = masterTradingService.getWallet();
            if (masterWallet) {
                worker = {
                    address: masterWallet.address,
                    signer: masterWallet.connect(provider),
                    tradingService: masterTradingService
                };
            }
        }
    }


    // 3. If no worker AND no EOA, QUEUE IT
    if (!worker) {
        const queueOverrides = overrides;
        const queued = jobQueue.enqueue({
            config,
            side,
            tokenId,
            approxPrice,
            originalTrader,
            originalSize,
            isPreflight,
            overrides: queueOverrides
        });
        if (queued) {
            console.warn(`[Supervisor] ⏳ All workers busy. Job QUEUED for User ${config.walletAddress}. Queue size: ${jobQueue.length}`);
        } else {
            console.error(`[Supervisor] ❌ Job DROPPED (Queue Full) for User ${config.walletAddress}`);
        }
        return;
    }

    // 4. Construct Effective Worker Context
    const effectiveWorker: WorkerContext = worker;

    // 5. Execute
    await executeJobInternal(effectiveWorker, config, side, tokenId, approxPrice, originalTrader, originalSize, isPreflight, overrides);
}

async function executeJobInternal(
    worker: WorkerContext,
    config: ActiveConfig,
    side: 'BUY' | 'SELL',
    tokenId: string,
    approxPrice: number,
    originalTrader: string,
    originalSize: number,
    isPreflight: boolean,
    overrides?: ethers.Overrides
) {
    const workerAddress = worker.address;
    const typeLabel = isPreflight ? "🦈 MEMPOOL" : "🐢 BLOCK";
    const startTime = Date.now(); // Track latency
    console.log(`[Supervisor] 🏃 [${typeLabel}] Assigning User ${config.walletAddress} -> Worker ${workerAddress}`);

    try {
        // 2. Calculate Size
        let copyAmount = 10; // Default $10
        if (config.fixedAmount) copyAmount = config.fixedAmount;

        // DRY_RUN Mode: Log execution decision without placing order
        if (DRY_RUN) {
            const latencyMs = Date.now() - startTime;
            console.log(`[DRY_RUN] ════════════════════════════════════════`);
            console.log(`[DRY_RUN] Would execute: ${side} $${copyAmount.toFixed(2)} of token ${tokenId.substring(0, 20)}...`);
            console.log(`[DRY_RUN]   User: ${config.walletAddress}`);
            console.log(`[DRY_RUN]   Price: $${approxPrice.toFixed(4)}`);
            console.log(`[DRY_RUN]   Slippage: ${config.maxSlippage}% (${config.slippageType})`);
            console.log(`[DRY_RUN]   Mode: ${config.executionMode}`);
            console.log(`[DRY_RUN]   Original: ${originalTrader} ${side} ${originalSize.toFixed(2)} shares`);
            console.log(`[DRY_RUN]   Latency: ${latencyMs}ms`);
            console.log(`[DRY_RUN] ════════════════════════════════════════`);

            recordExecution(true, latencyMs);

            // Async Metadata Backfill for Dry Run
            const meta = await getMarketMetadata(tokenId);

            // Log to DB as SKIPPED
            await prisma.copyTrade.create({
                data: {
                    configId: config.id,
                    originalTrader: originalTrader,
                    originalSide: side,
                    originalSize: originalSize,
                    originalPrice: approxPrice,
                    tokenId: tokenId,
                    copySize: copyAmount,
                    copyPrice: approxPrice,
                    status: 'SKIPPED',
                    errorMessage: 'DRY_RUN mode - execution skipped',
                    executedAt: new Date(),
                    marketSlug: meta.marketSlug,
                    conditionId: meta.conditionId,
                    outcome: meta.outcome
                }
            });
            return;
        }

        // 3. Execute
        const baseParams: ExecutionParams = {
            tradeId: `auto-${Date.now()}-${config.id}`,
            walletAddress: config.walletAddress, // User
            tokenId: tokenId,
            side: side,
            amount: copyAmount,
            price: approxPrice,
            maxSlippage: config.maxSlippage,
            slippageMode: config.slippageType,
            signer: worker.signer, // DYNAMIC SIGNER
            tradingService: worker.tradingService, // DYNAMIC SERVICE
            overrides: overrides, // GAS OVERRIDES
            executionMode: config.executionMode, // PROXY or EOA
        };

        const result = await executionService.executeOrderWithProxy(baseParams);

        // Record metrics
        const latencyMs = Date.now() - startTime;
        recordExecution(result.success, latencyMs);

        // 4. Log Result (Async DB write)
        // Fetch Metadata BEFORE Create
        const metadata = await getMarketMetadata(tokenId);

        await prisma.copyTrade.create({
            data: {
                configId: config.id,
                originalTrader: originalTrader,
                originalSide: side,
                originalSize: originalSize,
                originalPrice: approxPrice,
                tokenId: tokenId,
                copySize: copyAmount,
                copyPrice: approxPrice,
                status: result.success ? 'EXECUTED' : 'FAILED',
                txHash: result.orderId,
                errorMessage: result.error,
                executedAt: new Date(),
                marketSlug: metadata.marketSlug,
                conditionId: metadata.conditionId,
                outcome: metadata.outcome
            }
        });

        console.log(`[Supervisor] ✅ Job Complete for User ${config.walletAddress}: ${result.success ? "Success" : "Failed (" + result.error + ")"} (${latencyMs}ms)`);

        if (result.success) {
            // --- POSITION TRACKING & PROFIT-BASED FEE ---
            try {
                // Import is already at top level in this script
                const tradeValue = copyAmount; // USDC value of this trade
                const shares = tradeValue / approxPrice; // Approx shares traded

                if (side === 'BUY') {
                    // On BUY: Update position cost basis (no fee yet)
                    await positionService.recordBuy({
                        walletAddress: config.walletAddress,
                        tokenId: tokenId,
                        side: 'BUY',
                        amount: shares,
                        price: approxPrice,
                        totalValue: tradeValue
                    });
                    console.log(`[Supervisor] 📊 Position updated for BUY.`);

                    // Update position cache for fast sell-skip checks
                    updatePositionCache(config.walletAddress, tokenId, shares);

                    // Also update volume in referral record (legacy volume-based tracking)
                    await affiliateEngine.distributeCommissions({
                        tradeId: result.orderId || `trade-${Date.now()}`,
                        traderAddress: config.walletAddress,
                        volume: tradeValue,
                        platformFee: 0 // No fee on BUY
                    });

                } else {
                    // On SELL: Calculate profit and charge fee if profitable
                    const profitResult = await positionService.recordSell({
                        walletAddress: config.walletAddress,
                        tokenId: tokenId,
                        side: 'SELL',
                        amount: shares,
                        price: approxPrice,
                        totalValue: tradeValue
                    });

                    console.log(`[Supervisor] 💰 Sell Result: Profit=$${profitResult.profit.toFixed(4)} (${(profitResult.profitPercent * 100).toFixed(2)}%)`);

                    // Update position cache (negative for sell)
                    updatePositionCache(config.walletAddress, tokenId, -shares);

                    if (profitResult.profit > 0) {
                        // Charge profit-based fee
                        await affiliateEngine.distributeProfitFee(
                            config.walletAddress,
                            profitResult.profit,
                            result.orderId || `trade-${Date.now()}`
                        );
                    } else {
                        console.log(`[Supervisor] ❌ No profit, skipping fee.`);
                    }
                }
            } catch (affError) {
                console.error(`[Supervisor] ⚠️ Position/Affiliate Trigger Failed:`, affError);
            }
        }

    } catch (e: any) {
        // Record failed execution
        const latencyMs = Date.now() - startTime;
        recordExecution(false, latencyMs);
        console.error(`[Supervisor] 💥 Job Crashed for User ${config.walletAddress}:`, e.message);
    } finally {
        // 5. Checkin Worker AND Trigger Queue
        if (walletManager && worker) {
            walletManager.checkinWorker(worker.address);
            // TRIGGER NEXT JOB
            checkQueue();
        }
    }
}


// --- WEB SOCKET HANDLERS ---
async function handleActivityTrade(trade: ActivityTrade) {
    // 0. Deduplicate using txHash-only (unified with chain listener)
    if (!trade.transactionHash) return;
    if (isEventDuplicate(trade.transactionHash)) return;

    try {
        const traderAddress = trade.trader?.address?.toLowerCase();
        if (!traderAddress) return;

        // 1. Identification & Filtering
        if (!monitoredTraders.has(traderAddress)) return;

        // trade.side in Activity is "BUY" or "SELL"
        const side = trade.side;
        const tokenId = trade.asset;
        const size = trade.size;
        const price = trade.price;

        console.log(`[Supervisor] ⚡ WS DETECTED: ${traderAddress} ${side} ${tokenId} ($${price})`);

        // 2. Find subscribers
        const subscribers = activeConfigs.filter(c => c.traderAddress.toLowerCase() === traderAddress);
        if (subscribers.length === 0) return;

        // 3. Execution
        for (const sub of subscribers) {
            try {
                await processJob(sub, side!, tokenId, price, traderAddress!, size);
            } catch (execError) {
                console.error(`[Supervisor] WS Execution error for ${sub.walletAddress}:`, execError);
            }
        }

    } catch (e) {
        console.error(`[Supervisor] WS Handle Error:`, e);
    }
}

function startActivityListener() {
    console.log("[Supervisor] 🔌 Connecting Activity WebSocket...");
    realtimeService.connect();

    // Subscribe to ALL activity to catch monitored traders
    realtimeService.subscribeAllActivity({
        onTrade: handleActivityTrade
    });

    console.log("[Supervisor] 🎧 Listening for WS Trades...");
}

// --- MAIN ---
let mempoolDetector: MempoolDetector;

async function main() {
    console.log("Starting Copy Trading Supervisor (Enterprise)...");

    // --- INITIALIZATION ---
    if (MASTER_MNEMONIC) {
        walletManager = new WalletManager(
            provider,
            rateLimiter,
            cache,
            MASTER_MNEMONIC,
            20, // Pool Size: 20 Parallel Workers
            0,  // Start Index
            CHAIN_ID
        );
        // CRITICAL: Initialize Fleet Credentials
        await walletManager.initialize();
    } else {
        console.warn("⚠️ NO MNEMONIC FOUND! Supervisor running in SINGLE WORKER mode (Legacy).");
        console.warn("Please set TRADING_MNEMONIC in .env for parallel scale.");
    }

    // Initialize Debt Manager
    if (walletManager) {
        debtManager = new DebtManager(debtRepository, walletManager, provider, CHAIN_ID);
    } else {
        console.warn("[Supervisor] ⚠️ DebtManager NOT initialized (No WalletManager). Debt recovery disabled.");
    }

    // Recover any pending debts from previous sessions
    if (debtManager) {
        console.log('[Supervisor] 🩺 Checking for pending debts from previous sessions...');
        const recovery = await debtManager.recoverPendingDebts();
        if (recovery.recovered > 0 || recovery.errors > 0) {
            console.log(`[Supervisor] 💰 Debt recovery: ${recovery.recovered} recovered, ${recovery.errors} errors`);
        }
    }

    await refreshConfigs();

    // Preload user positions for fast sell-skip checks
    await preloadUserPositions();

    // Refresh configs loop
    setInterval(refreshConfigs, 10000);

    // Refresh position cache periodically (every 5 minutes)
    setInterval(preloadUserPositions, POSITION_CACHE_REFRESH_INTERVAL);

    // Maintenance Loop (Auto-Refuel)
    setInterval(async () => {
        if (walletManager && masterTradingService.getWallet()) {
            await walletManager.ensureFleetBalances(masterTradingService.getWallet(), 0.1, 0.5);
        }
    }, 60000 * 5); // Check every 5 minutes

    // Debt Recovery Loop
    setInterval(async () => {
        if (debtManager) {
            await debtManager.recoverPendingDebts();
        }
    }, 120000); // 2 mins

    // Metrics Logging Loop
    setInterval(logMetricsSummary, 300000); // 5 mins

    // Start Listeners
    // Always start listeners - monitoredTraders might be populated later via refreshConfigs
    // A. WebSocket (Primary - <500ms)
    startActivityListener();

    // B. Chain Events (Fallback - ~2s)
    console.log(`[Supervisor] 🎧 Listening for TransferSingle events on ${CONTRACT_ADDRESSES.ctf}...`);
    const ctf = new ethers.Contract(CONTRACT_ADDRESSES.ctf, CTF_ABI, provider);
    ctf.on("TransferSingle", handleTransfer);

    // C. Mempool (Optional / Legacy)
    if (process.env.ENABLE_MEMPOOL === 'true') {
        mempoolDetector = new MempoolDetector(
            provider,
            monitoredTraders,
            (tx: any) => {
                console.log(`[Mempool] Signal: ${tx.hash}`);
            }
        );
        mempoolDetector.start();
    }

    // Keep alive
    process.on('SIGINT', () => {
        console.log("Stopping...");
        process.exit();
    });
}

// Execute Main
main().catch(console.error);
