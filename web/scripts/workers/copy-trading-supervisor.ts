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

import { Prisma, PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as path from 'path';
import { ethers } from 'ethers';
import { createHash, randomUUID } from 'crypto';
import { EncryptionService } from '../../../sdk/src/core/encryption.js'; // Import EncryptionService
import { CONTRACT_ADDRESSES, CTF_ABI, ERC20_ABI, USDC_DECIMALS } from '../../../sdk/src/core/contracts';
import { CopyTradingExecutionService, ExecutionParams } from '../../../sdk/src/services/copy-trading-execution-service';
import { TradeOrchestrator } from '../../../sdk/src/core/trade-orchestrator.js';
import { TradingService, TradeInfo } from '../../../sdk/src/services/trading-service';
import { RateLimiter } from '../../../sdk/src/core/rate-limiter';
import { createUnifiedCache, UnifiedCache } from '../../../sdk/src/core/unified-cache';
import { WalletManager, WorkerContext } from '../../../sdk/src/core/wallet-manager';
import { MempoolDetector } from '../../../sdk/src/core/mempool-detector';
import { TaskQueue } from '../../../sdk/src/core/task-queue';
import { DebtManager } from '../../../sdk/src/core/debt-manager';
import { MarketService } from '../../../sdk/src/services/market-service';
import { TokenMetadataService } from '../../../sdk/src/services/token-metadata-service';
import { GammaApiClient } from '../../../sdk/src/clients/gamma-api';
import { DataApiClient, type Activity as DataActivity } from '../../../sdk/src/clients/data-api';

import { PrismaDebtLogger, PrismaDebtRepository } from '../services/debt-adapters';
import { AffiliateEngine } from '../../lib/services/affiliate-engine';
import { PositionService } from '../../lib/services/position-service';
import { RealtimeServiceV2, ActivityTrade, Subscription } from '../../../sdk/src/services/realtime-service-v2';
import { TxMonitor, TrackedTx } from '../../../sdk/src/core/tx-monitor';
import { normalizeTradeSizingFromShares } from '../../../sdk/src/utils/trade-sizing.js';

// --- CONFIG ---
// =========================
// 网络与执行开关
// =========================
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "31337");
const DRY_RUN = process.env.DRY_RUN === 'true';
const ENABLE_REAL_TRADING = process.env.ENABLE_REAL_TRADING === 'true';
const EMERGENCY_PAUSE = process.env.COPY_TRADING_EMERGENCY_PAUSE === 'true';

// =========================
// 风控阈值（额度/频率/白名单）
// =========================
const EXECUTION_ALLOWLIST = (process.env.COPY_TRADING_EXECUTION_ALLOWLIST || '')
    .split(',')
    .map((addr) => addr.trim().toLowerCase())
    .filter(Boolean);
const MAX_TRADE_USD = Number(process.env.COPY_TRADING_MAX_TRADE_USD || '0');
const GLOBAL_DAILY_CAP_USD = Number(process.env.COPY_TRADING_DAILY_CAP_USD || '0');
const WALLET_DAILY_CAP_USD = Number(process.env.COPY_TRADING_WALLET_DAILY_CAP_USD || '0');
const MARKET_DAILY_CAP_USD = Number(process.env.COPY_TRADING_MARKET_DAILY_CAP_USD || '0');
const MAX_TRADES_PER_WINDOW = Number(process.env.COPY_TRADING_MAX_TRADES_PER_WINDOW || '0');
const TRADE_WINDOW_MS = Number(process.env.COPY_TRADING_TRADE_WINDOW_MS || '600000');
const MARKET_CAPS_RAW = process.env.COPY_TRADING_MARKET_CAPS || '';
const ASYNC_SETTLEMENT = process.env.COPY_TRADING_ASYNC_SETTLEMENT === 'true'
    || process.env.COPY_TRADING_ASYNC_SETTLEMENT === '1';

// =========================
// 缓存与去重
// =========================
// GUARDRAIL_CACHE_TTL_MS 用于缓存额度统计查询，降低高频 guardrail 的 DB 压力。
const GUARDRAIL_CACHE_TTL_MS = parseInt(process.env.SUPERVISOR_GUARDRAIL_CACHE_TTL_MS || '5000', 10);
// MARKET_META_TTL_MS 缓存 token -> (slug/condition/outcome) 元数据，减少重复市场查询。
const MARKET_META_TTL_MS = parseInt(process.env.SUPERVISOR_MARKET_META_TTL_MS || '300000', 10);
// DEDUP_TTL_MS 控制“同一事件哈希”去重窗口，避免多信号源重复下单。
const DEDUP_TTL_MS = parseInt(process.env.SUPERVISOR_DEDUP_TTL_MS || '60000', 10);
const FILTER_MARKET_STATS_TTL_MS = Math.max(1000, parseInt(process.env.SUPERVISOR_FILTER_MARKET_STATS_TTL_MS || '15000', 10));
const FILTER_ORDERBOOK_DEPTH_LEVELS = Math.max(1, parseInt(process.env.SUPERVISOR_FILTER_ORDERBOOK_DEPTH_LEVELS || '20', 10));
const EOA_SERVICE_TTL_MS = Math.max(60_000, parseInt(process.env.SUPERVISOR_EOA_SERVICE_TTL_MS || '300000', 10));
const EOA_SERVICE_SWEEP_INTERVAL_MS = Math.max(15_000, parseInt(process.env.SUPERVISOR_EOA_SERVICE_SWEEP_INTERVAL_MS || '60000', 10));
const QUEUE_LAG_SAMPLE_LIMIT = Math.max(100, parseInt(process.env.SUPERVISOR_QUEUE_LAG_SAMPLE_LIMIT || '2000', 10));
const METRICS_TOP_K = Math.max(1, parseInt(process.env.SUPERVISOR_METRICS_TOP_K || '5', 10));
const WALLET_METRICS_MAX_KEYS = Math.max(100, parseInt(process.env.SUPERVISOR_WALLET_METRICS_MAX_KEYS || '5000', 10));
const WALLET_METRICS_MIN_ATTEMPTS = Math.max(1, parseInt(process.env.SUPERVISOR_WALLET_METRICS_MIN_ATTEMPTS || '3', 10));

// =========================
// 并发与队列
// =========================
const FANOUT_CONCURRENCY = parseInt(process.env.SUPERVISOR_FANOUT_CONCURRENCY || '25', 10);
const QUEUE_MAX_SIZE = parseInt(process.env.SUPERVISOR_QUEUE_MAX_SIZE || '5000', 10);
const QUEUE_DRAIN_INTERVAL_MS = parseInt(process.env.SUPERVISOR_QUEUE_DRAIN_INTERVAL_MS || '500', 10);
const WORKER_POOL_SIZE = Math.max(1, parseInt(process.env.SUPERVISOR_WORKER_POOL_SIZE || '20', 10));
const AUTO_LOAD_SHEDDING_ENABLED = process.env.SUPERVISOR_AUTO_LOAD_SHEDDING !== 'false';
const LOAD_SHEDDING_QUEUE_DEPTH_WARN = Math.max(10, parseInt(process.env.SUPERVISOR_LOAD_SHEDDING_QUEUE_DEPTH_WARN || '500', 10));
const LOAD_SHEDDING_QUEUE_DEPTH_CRITICAL = Math.max(
    LOAD_SHEDDING_QUEUE_DEPTH_WARN,
    parseInt(process.env.SUPERVISOR_LOAD_SHEDDING_QUEUE_DEPTH_CRITICAL || '1500', 10)
);
const LOAD_SHEDDING_QUEUE_P95_WARN_MS = Math.max(100, parseInt(process.env.SUPERVISOR_LOAD_SHEDDING_QUEUE_P95_WARN_MS || '3000', 10));
const LOAD_SHEDDING_QUEUE_P95_CRITICAL_MS = Math.max(
    LOAD_SHEDDING_QUEUE_P95_WARN_MS,
    parseInt(process.env.SUPERVISOR_LOAD_SHEDDING_QUEUE_P95_CRITICAL_MS || '8000', 10)
);
const LOAD_SHEDDING_DEGRADED_FANOUT_LIMIT = Math.max(
    1,
    Math.min(
        FANOUT_CONCURRENCY,
        parseInt(process.env.SUPERVISOR_LOAD_SHEDDING_DEGRADED_FANOUT || String(Math.max(1, Math.floor(FANOUT_CONCURRENCY * 0.5))), 10)
    )
);
const LOAD_SHEDDING_CRITICAL_FANOUT_LIMIT = Math.max(
    1,
    Math.min(
        LOAD_SHEDDING_DEGRADED_FANOUT_LIMIT,
        parseInt(
            process.env.SUPERVISOR_LOAD_SHEDDING_CRITICAL_FANOUT
            || String(Math.max(1, Math.floor(FANOUT_CONCURRENCY * 0.2))),
            10
        )
    )
);
const LOAD_SHEDDING_RECOVERY_WINDOWS = Math.max(1, parseInt(process.env.SUPERVISOR_LOAD_SHEDDING_RECOVERY_WINDOWS || '2', 10));
const LOAD_SHEDDING_EVAL_INTERVAL_MS = Math.max(1000, parseInt(process.env.SUPERVISOR_LOAD_SHEDDING_EVAL_INTERVAL_MS || '15000', 10));
const LOAD_SHEDDING_PAUSE_MEMPOOL_ON_DEGRADED = process.env.SUPERVISOR_LOAD_SHEDDING_PAUSE_MEMPOOL_ON_DEGRADED !== 'false';

// =========================
// 对账任务（SELL 账务复核）
// =========================
const SELL_RECONCILIATION_ENABLED = process.env.SUPERVISOR_SELL_RECONCILIATION_ENABLED !== 'false';
const SELL_RECONCILIATION_INTERVAL_MS = Math.max(60 * 60 * 1000, parseInt(process.env.SUPERVISOR_SELL_RECONCILIATION_INTERVAL_MS || String(24 * 60 * 60 * 1000), 10));
const SELL_RECONCILIATION_LOOKBACK_MS = Math.max(60 * 60 * 1000, parseInt(process.env.SUPERVISOR_SELL_RECONCILIATION_LOOKBACK_MS || String(26 * 60 * 60 * 1000), 10));
const SELL_RECONCILIATION_MAX_TRADES = Math.max(10, parseInt(process.env.SUPERVISOR_SELL_RECONCILIATION_MAX_TRADES || '200', 10));
const SELL_RECONCILIATION_DIFF_THRESHOLD_USDC = Math.max(0.0001, Number(process.env.SUPERVISOR_SELL_RECONCILIATION_DIFF_THRESHOLD_USDC || '0.01'));

// =========================
// 配置刷新策略
// =========================
// refresh 与 full refresh 分层：高频增量 + 低频全量校准。
const CONFIG_REFRESH_INTERVAL_MS = Math.max(1000, parseInt(process.env.SUPERVISOR_CONFIG_REFRESH_MS || '10000', 10));
const CONFIG_FULL_REFRESH_INTERVAL_MS = Math.max(60000, parseInt(process.env.SUPERVISOR_CONFIG_FULL_REFRESH_MS || String(5 * 60 * 1000), 10));

// =========================
// 信号源（WS / Polling / Hybrid）
// =========================
const WS_ADDRESS_FILTER = process.env.SUPERVISOR_WS_FILTER_BY_ADDRESS !== 'false';
const SHARD_COUNT = Math.max(1, parseInt(process.env.SUPERVISOR_SHARD_COUNT || '1', 10));
const SHARD_INDEX = Math.max(0, parseInt(process.env.SUPERVISOR_SHARD_INDEX || '0', 10));
const SHARD_INDEX_EFFECTIVE = SHARD_INDEX % SHARD_COUNT;
const REDIS_URL = process.env.SUPERVISOR_REDIS_URL || process.env.REDIS_URL || '';
const SIGNAL_MODE_RAW = (process.env.COPY_TRADING_SIGNAL_MODE || 'HYBRID').toUpperCase();
const SIGNAL_MODE = SIGNAL_MODE_RAW === 'WS_ONLY' || SIGNAL_MODE_RAW === 'POLLING_ONLY' || SIGNAL_MODE_RAW === 'HYBRID'
    ? SIGNAL_MODE_RAW
    : 'HYBRID';
const POLLING_BASE_INTERVAL_MS = Math.max(1000, parseInt(process.env.SUPERVISOR_POLLING_BASE_INTERVAL_MS || '5000', 10));
const POLLING_MAX_INTERVAL_MS = Math.max(POLLING_BASE_INTERVAL_MS, parseInt(process.env.SUPERVISOR_POLLING_MAX_INTERVAL_MS || '10000', 10));
const POLLING_LIMIT = Math.max(10, Math.min(500, parseInt(process.env.SUPERVISOR_POLLING_LIMIT || '200', 10)));
const POLLING_LOOKBACK_SECONDS = Math.max(10, parseInt(process.env.SUPERVISOR_POLLING_LOOKBACK_SECONDS || '90', 10));
const WS_UNHEALTHY_THRESHOLD_MS = Math.max(5000, parseInt(process.env.SUPERVISOR_WS_UNHEALTHY_THRESHOLD_MS || '30000', 10));
const SIGNAL_SOURCE_WINDOW_MS = Math.max(30000, parseInt(process.env.SUPERVISOR_SIGNAL_SOURCE_WINDOW_MS || '120000', 10));
const SIGNAL_CURSOR_SOURCE = 'data_api_activity';

// =========================
// 自检模式（联调/验收）
// =========================
const SELFTEST_ENABLED = process.env.SUPERVISOR_SELFTEST === 'true';
const SELFTEST_EXIT = process.env.SUPERVISOR_SELFTEST_EXIT === 'true';
const SELFTEST_CREATE_CONFIG = process.env.SUPERVISOR_SELFTEST_CREATE_CONFIG !== 'false';
const SELFTEST_CLEANUP = process.env.SUPERVISOR_SELFTEST_CLEANUP !== 'false';
const SELFTEST_CONFIG_ID = process.env.SUPERVISOR_SELFTEST_CONFIG_ID || '';
const SELFTEST_TOKEN_ID = process.env.SUPERVISOR_SELFTEST_TOKEN_ID
    || (CHAIN_ID === 31337 || CHAIN_ID === 1337 ? 'mock-token-exec-path-1234567890' : '');
const SELFTEST_SIDE = (process.env.SUPERVISOR_SELFTEST_SIDE || 'BUY').toUpperCase() as 'BUY' | 'SELL';
const SELFTEST_PRICE = Number(process.env.SUPERVISOR_SELFTEST_PRICE || '0.5');
const SELFTEST_SIZE = Number(process.env.SUPERVISOR_SELFTEST_SIZE || '10');
const SELFTEST_TRADER = process.env.SUPERVISOR_SELFTEST_TRADER || '';
const SELFTEST_WALLET = process.env.SUPERVISOR_SELFTEST_WALLET || '';
const SELFTEST_EXECUTION_MODE = (process.env.SUPERVISOR_SELFTEST_EXECUTION_MODE || '').toUpperCase() as 'EOA' | 'PROXY' | '';

// Env checks
if (!process.env.TRADING_PRIVATE_KEY) {
    console.error("Missing TRADING_PRIVATE_KEY in .env");
    process.exit(1);
}
if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL in .env");
    process.exit(1);
}

function isWsSignalEnabled(): boolean {
    // HYBRID 与 WS_ONLY 都允许 WS 作为信号输入。
    return SIGNAL_MODE === 'WS_ONLY' || SIGNAL_MODE === 'HYBRID';
}

function isPollingSignalEnabled(): boolean {
    // HYBRID 与 POLLING_ONLY 都启用 polling 兜底链路。
    return SIGNAL_MODE === 'POLLING_ONLY' || SIGNAL_MODE === 'HYBRID';
}

function isPollingOnlyMode(): boolean {
    return SIGNAL_MODE === 'POLLING_ONLY';
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
console.log(`[Supervisor] 📡 Signal mode: ${SIGNAL_MODE}`);
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
let activitySubscription: Subscription | null = null;
let activitySubscriptionKey = '';

// Core Services
const gammaApi = new GammaApiClient(rateLimiter, cache);
const dataApi = new DataApiClient(rateLimiter, cache);
const marketService = new MarketService(gammaApi, dataApi, rateLimiter, cache, { chainId: CHAIN_ID });
const tokenMetadataService = new TokenMetadataService(marketService, cache);

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

// 2a. Trade Orchestrator (Centralized Risk & Execution)
let tradeOrchestrator = new TradeOrchestrator(
    executionService,
    tokenMetadataService,
    masterTradingService,
    prisma,
    undefined, // Use default SpeedProfile
    ASYNC_SETTLEMENT
);

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
        if (pollingLoopTimer) {
            clearTimeout(pollingLoopTimer);
            pollingLoopTimer = null;
        }
        if (activitySubscription) {
            activitySubscription.unsubscribe();
            activitySubscription = null;
        }
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

    if (redisClient) {
        console.log("[Supervisor] 📦 Disconnecting Redis...");
        try {
            await redisClient.quit();
        } catch (e) {
            console.error("Redis disconnect error", e);
        }
    }

    userExecManager.dispose();

    console.log("[Supervisor] 👋 Goodbye.");
    process.exit(0);
}

// --- STATE ---
interface ActiveConfig {
    id: string;
    walletAddress: string; // User
    traderAddress: string; // Trader
    tradeSizeMode?: 'SHARES' | 'NOTIONAL' | null;
    mode: string;
    fixedAmount?: number;
    sizeScale?: number;
    maxSizePerTrade: number;
    minSizePerTrade?: number;
    maxSlippage: number;
    slippageType: 'FIXED' | 'AUTO';
    autoExecute: boolean;
    // Execution Mode
    executionMode: 'PROXY' | 'EOA';
    encryptedKey?: string;
    iv?: string;
    apiKey?: string;
    apiSecret?: string;
    apiPassphrase?: string;
    // Filter Fields
    minLiquidity?: number;
    minVolume?: number;
    maxOdds?: number;
}

let activeConfigs: ActiveConfig[] = [];
const configCache = new Map<string, ActiveConfig>();
let configRefreshCursor: Date | null = null;
let isRefreshingConfigs = false;
let pendingFullRefresh = false;
const configRefreshStats = {
    lastRunAt: 0,
    lastDurationMs: 0,
    lastFetched: 0,
    lastMode: 'none'
};
let monitoredTraders: Set<string> = new Set();
let ownedTraders: Set<string> = new Set();
let ownedTradersCursorSignature = '';
let pollingLoopTimer: NodeJS.Timeout | null = null;
let pollingLoopRunning = false;
let pollingIntervalMs = POLLING_BASE_INTERVAL_MS;
let signalCursorStoreAvailable = true;

interface SignalCursorState {
    cursor: number;
    cursorTxHash: string | null;
}

const signalCursorCache = new Map<string, SignalCursorState>();

class UserExecutionManager {
    private services = new Map<string, { fingerprint: string; service: TradingService; lastAccessAt: number }>();
    private readonly cleanupTimer: NodeJS.Timeout;

    constructor(
        private readonly ttlMs: number,
        sweepIntervalMs: number
    ) {
        this.cleanupTimer = setInterval(() => {
            const evicted = this.evictExpiredServices();
            if (evicted > 0) {
                console.log(`[Supervisor] 🧹 EOA service cache sweep evicted ${evicted} stale entr${evicted === 1 ? 'y' : 'ies'}.`);
            }
        }, sweepIntervalMs);
        this.cleanupTimer.unref?.();
    }

    private evictExpiredServices(now = Date.now()): number {
        let evicted = 0;
        for (const [configId, entry] of this.services.entries()) {
            if (now - entry.lastAccessAt <= this.ttlMs) continue;
            this.services.delete(configId);
            evicted += 1;
        }
        return evicted;
    }

    private buildFingerprint(config: ActiveConfig): string {
        return createHash('sha256')
            .update([
                config.encryptedKey || '',
                config.iv || '',
                config.apiKey || '',
                config.apiSecret || '',
                config.apiPassphrase || '',
            ].join('|'))
            .digest('hex');
    }

    private decryptField(value: string): string {
        const [iv, data] = value.split(':');
        if (!iv || !data) {
            throw new Error('Invalid encrypted field format');
        }
        return EncryptionService.decrypt(data, iv);
    }

    private async createService(config: ActiveConfig, credentials?: { key: string; secret: string; passphrase: string }): Promise<TradingService> {
        const privateKey = EncryptionService.decrypt(config.encryptedKey!, config.iv!);
        const limiter = new RateLimiter(); // Per-user limiter
        const svc = new TradingService(limiter, cache, { privateKey, chainId: CHAIN_ID, credentials });
        await svc.initialize();
        return svc;
    }

    async getEOAService(config: ActiveConfig): Promise<TradingService | null> {
        if (!config.encryptedKey || !config.iv) {
            console.warn(`[Supervisor] EOA mode enabled for ${config.id} but missing keys.`);
            return null;
        }

        this.evictExpiredServices();
        const fingerprint = this.buildFingerprint(config);
        const cached = this.services.get(config.id);
        if (cached) {
            if (cached.fingerprint !== fingerprint) {
                this.services.delete(config.id);
            } else {
                cached.lastAccessAt = Date.now();
                return cached.service;
            }
        }

        try {
            let credentials: { key: string; secret: string; passphrase: string } | undefined;
            if (config.apiKey && config.apiSecret && config.apiPassphrase) {
                credentials = {
                    key: this.decryptField(config.apiKey),
                    secret: this.decryptField(config.apiSecret),
                    passphrase: this.decryptField(config.apiPassphrase),
                };
            }

            const svc = await this.createService(config, credentials);
            this.services.set(config.id, { fingerprint, service: svc, lastAccessAt: Date.now() });
            return svc;
        } catch (error) {
            console.error(`[Supervisor] Failed to initialize EOA service for ${config.id}:`, error);
            return null;
        }
    }

    dispose(): void {
        clearInterval(this.cleanupTimer);
        const staleCount = this.services.size;
        this.services.clear();
        if (staleCount > 0) {
            console.log(`[Supervisor] 🧹 Cleared ${staleCount} cached EOA service entr${staleCount === 1 ? 'y' : 'ies'} on shutdown.`);
        }
    }
}

const userExecManager = new UserExecutionManager(EOA_SERVICE_TTL_MS, EOA_SERVICE_SWEEP_INTERVAL_MS);

function calculateCopySize(
    config: {
        mode: string;
        sizeScale?: number;
        fixedAmount?: number;
        maxSizePerTrade: number;
        minSizePerTrade?: number;
    },
    originalShares: number,
    originalPrice: number
): number {
    const originalValue = originalShares * originalPrice;

    if (config.mode === 'FIXED_AMOUNT' && config.fixedAmount) {
        return Math.min(config.fixedAmount, config.maxSizePerTrade);
    }

    const scaledValue = originalValue * (config.sizeScale || 1);
    const minSize = config.minSizePerTrade ?? 0;
    return Math.max(minSize, Math.min(scaledValue, config.maxSizePerTrade));
}

// --- QUEUE ---
interface JobQueueItem {
    config: ActiveConfig;
    side: 'BUY' | 'SELL';
    tokenId: string;
    approxPrice: number;
    originalTrader: string;
    originalSize: number;
    originalSignalId: string;
    isPreflight: boolean;
    overrides?: ethers.Overrides;
    enqueuedAt?: number;
}

type SignalIdentity = {
    txHash?: string;
    logIndex?: number;
};

interface QueueStore<T> {
    enqueue(item: T): Promise<boolean>;
    dequeue(): Promise<T | null>;
    size(): Promise<number>;
}

class MemoryQueueStore<T> implements QueueStore<T> {
    private queue: TaskQueue<T>;
    constructor(maxSize: number) {
        this.queue = new TaskQueue<T>(maxSize);
    }
    async enqueue(item: T): Promise<boolean> {
        return this.queue.enqueue(item);
    }
    async dequeue(): Promise<T | null> {
        return this.queue.dequeue() ?? null;
    }
    async size(): Promise<number> {
        return this.queue.length;
    }
}

class RedisQueueStore<T> implements QueueStore<T> {
    constructor(
        private client: any,
        private key: string,
        private maxSize: number
    ) { }

    async enqueue(item: T): Promise<boolean> {
        const size = await this.client.llen(this.key);
        if (size >= this.maxSize) return false;
        await this.client.rpush(this.key, JSON.stringify(item));
        return true;
    }

    async dequeue(): Promise<T | null> {
        const raw = await this.client.lpop(this.key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
    }

    async size(): Promise<number> {
        return this.client.llen(this.key);
    }
}

let queueStore: QueueStore<JobQueueItem> = new MemoryQueueStore<JobQueueItem>(QUEUE_MAX_SIZE);
let redisClient: any | null = null;

// --- HEALTH METRICS ---
interface Metrics {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    skippedExecutions: number;
    totalLatencyMs: number;
    lastResetAt: number;
}
const metrics: Metrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    skippedExecutions: 0,
    totalLatencyMs: 0,
    lastResetAt: Date.now(),
};
const queueStats = {
    enqueued: 0,
    dequeued: 0,
    dropped: 0,
    totalLagMs: 0,
    maxLagMs: 0,
    maxDepth: 0,
};
let isDrainingQueue = false;
let isSellReconciliationRunning = false;
const queueLagSamplesMs: number[] = [];
const rejectStats = {
    total: 0,
    byReason: new Map<string, number>(),
};
const walletExecutionStats = new Map<string, {
    success: number;
    failed: number;
    skipped: number;
    totalLatencyMs: number;
}>();
const reconciliationMetrics = {
    runs: 0,
    errors: 0,
    scanned: 0,
    reconciled: 0,
    skipped: 0,
    totalAbsDiff: 0,
    maxAbsDiff: 0,
    lastRunAt: 0,
    lastElapsedMs: 0,
};

type LoadSheddingMode = 'NORMAL' | 'DEGRADED' | 'CRITICAL';

const loadSheddingState: {
    mode: LoadSheddingMode;
    healthyWindows: number;
    lastModeChangeAt: number;
    lastQueueDepth: number;
    lastQueueP95LagMs: number;
} = {
    mode: 'NORMAL',
    healthyWindows: 0,
    lastModeChangeAt: Date.now(),
    lastQueueDepth: 0,
    lastQueueP95LagMs: 0,
};

interface SourceWindowEntry {
    firstSeenAt: number;
    ws: boolean;
    polling: boolean;
}

type SignalSource = 'ws' | 'polling' | 'chain' | 'mempool';

const signalHealth = {
    wsLastEventAt: 0,
    pollLastRunAt: 0,
    pollLastEventAt: 0,
    pollLagMs: 0,
    wsLastEventAgeMs: 0,
    sourceMismatchRate: 0,
    wsDegraded: false,
};

const signalSourceWindow = new Map<string, SourceWindowEntry>();
const sourceStats = {
    wsEvents: 0,
    pollingEvents: 0,
    closedWsOnly: 0,
    closedPollingOnly: 0,
    closedBoth: 0,
};

function recordSignalSource(key: string, source: SignalSource) {
    if (source === 'ws') {
        sourceStats.wsEvents += 1;
        signalHealth.wsLastEventAt = Date.now();
    } else if (source === 'polling') {
        sourceStats.pollingEvents += 1;
        signalHealth.pollLastEventAt = Date.now();
    } else {
        return;
    }

    const now = Date.now();
    const existing = signalSourceWindow.get(key);
    if (existing) {
        if (source === 'ws') existing.ws = true;
        if (source === 'polling') existing.polling = true;
        return;
    }

    signalSourceWindow.set(key, {
        firstSeenAt: now,
        ws: source === 'ws',
        polling: source === 'polling',
    });
}

function flushSignalSourceWindow(now = Date.now()) {
    for (const [key, entry] of Array.from(signalSourceWindow.entries())) {
        if (now - entry.firstSeenAt < SIGNAL_SOURCE_WINDOW_MS) continue;
        if (entry.ws && entry.polling) sourceStats.closedBoth += 1;
        else if (entry.ws) sourceStats.closedWsOnly += 1;
        else if (entry.polling) sourceStats.closedPollingOnly += 1;
        signalSourceWindow.delete(key);
    }
}

function evaluateWsHealth() {
    if (!isWsSignalEnabled()) {
        signalHealth.wsLastEventAgeMs = 0;
        signalHealth.wsDegraded = false;
        return;
    }

    const now = Date.now();
    signalHealth.wsLastEventAgeMs = signalHealth.wsLastEventAt > 0
        ? (now - signalHealth.wsLastEventAt)
        : Number.MAX_SAFE_INTEGER;
    const unhealthy = signalHealth.wsLastEventAgeMs > WS_UNHEALTHY_THRESHOLD_MS;

    if (SIGNAL_MODE !== 'HYBRID') return;
    // HYBRID 模式下，WS 退化并不停止系统，而是由 polling 接管主信号来源。
    if (unhealthy && !signalHealth.wsDegraded) {
        signalHealth.wsDegraded = true;
        console.warn(`[Supervisor] ⚠️ WS unhealthy (${signalHealth.wsLastEventAgeMs}ms without event). Polling remains active.`);
        return;
    }

    if (!unhealthy && signalHealth.wsDegraded) {
        signalHealth.wsDegraded = false;
        console.log('[Supervisor] ✅ WS recovered. Hybrid fast-path restored.');
    }
}

function recordExecution(outcome: 'success' | 'failed' | 'skipped', latencyMs: number): void {
    metrics.totalExecutions++;
    if (outcome === 'success') metrics.successfulExecutions++;
    else if (outcome === 'failed') metrics.failedExecutions++;
    else metrics.skippedExecutions++;
    if (outcome !== 'skipped') {
        metrics.totalLatencyMs += latencyMs;
    }
}

function appendQueueLagSample(lagMs: number): void {
    if (!Number.isFinite(lagMs) || lagMs < 0) return;
    queueLagSamplesMs.push(lagMs);
    if (queueLagSamplesMs.length > QUEUE_LAG_SAMPLE_LIMIT) {
        queueLagSamplesMs.splice(0, queueLagSamplesMs.length - QUEUE_LAG_SAMPLE_LIMIT);
    }
}

function calculatePercentile(samples: number[], percentile: number): number {
    if (samples.length === 0) return 0;
    const sorted = [...samples].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
    return sorted[index];
}

function recordRejectReason(reason: string): void {
    const normalized = reason.trim().toUpperCase();
    if (!normalized) return;
    rejectStats.total += 1;
    rejectStats.byReason.set(normalized, (rejectStats.byReason.get(normalized) || 0) + 1);
}

function recordWalletExecution(walletAddress: string, outcome: 'success' | 'failed' | 'skipped', latencyMs = 0): void {
    const normalized = walletAddress.trim().toLowerCase();
    if (!normalized) return;
    let stats = walletExecutionStats.get(normalized);
    if (!stats) {
        if (walletExecutionStats.size >= WALLET_METRICS_MAX_KEYS) {
            return;
        }
        stats = { success: 0, failed: 0, skipped: 0, totalLatencyMs: 0 };
        walletExecutionStats.set(normalized, stats);
    }
    if (outcome === 'success') stats.success += 1;
    else if (outcome === 'failed') stats.failed += 1;
    else stats.skipped += 1;
    if (outcome !== 'skipped') stats.totalLatencyMs += Math.max(0, latencyMs);
}

function summarizeTopRejectReasons(limit = METRICS_TOP_K): string {
    const entries = Array.from(rejectStats.byReason.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
    if (entries.length === 0) return 'none';
    return entries.map(([reason, count]) => `${reason}:${count}`).join(', ');
}

function summarizeTopWalletStats(limit = METRICS_TOP_K): string {
    const entries = Array.from(walletExecutionStats.entries())
        .map(([wallet, stats]) => {
            const attempts = stats.success + stats.failed + stats.skipped;
            const decided = stats.success + stats.failed;
            const successRate = decided > 0 ? (stats.success / decided) * 100 : 100;
            const avgLatencyMs = decided > 0 ? stats.totalLatencyMs / decided : 0;
            return { wallet, ...stats, attempts, decided, successRate, avgLatencyMs };
        })
        .filter((entry) => entry.attempts >= WALLET_METRICS_MIN_ATTEMPTS)
        .sort((a, b) => b.attempts - a.attempts)
        .slice(0, limit);

    if (entries.length === 0) return 'none';
    return entries.map((entry) => {
        const shortWallet = `${entry.wallet.slice(0, 8)}...${entry.wallet.slice(-4)}`;
        return `${shortWallet}(ok=${entry.success},fail=${entry.failed},skip=${entry.skipped},sr=${entry.successRate.toFixed(1)}%,avg=${entry.avgLatencyMs.toFixed(0)}ms)`;
    }).join(', ');
}

function classifyFilterRejectReason(reason: string): string {
    const normalized = reason.toLowerCase();
    if (normalized.includes('maxodds filter failed')) return 'MAX_ODDS_FILTER_FAILED';
    if (normalized.includes('minliquidity filter failed')) return 'MIN_LIQUIDITY_FILTER_FAILED';
    if (normalized.includes('minvolume filter failed')) return 'MIN_VOLUME_FILTER_FAILED';
    if (normalized.includes('market metrics unavailable')) return 'FILTER_METRICS_UNAVAILABLE';
    return 'FILTER_BLOCKED';
}

function loadSheddingSeverity(mode: LoadSheddingMode): number {
    if (mode === 'CRITICAL') return 2;
    if (mode === 'DEGRADED') return 1;
    return 0;
}

function computeLoadSheddingTargetMode(queueDepth: number, queueP95LagMs: number): LoadSheddingMode {
    if (
        queueDepth >= LOAD_SHEDDING_QUEUE_DEPTH_CRITICAL
        || queueP95LagMs >= LOAD_SHEDDING_QUEUE_P95_CRITICAL_MS
    ) {
        return 'CRITICAL';
    }
    if (
        queueDepth >= LOAD_SHEDDING_QUEUE_DEPTH_WARN
        || queueP95LagMs >= LOAD_SHEDDING_QUEUE_P95_WARN_MS
    ) {
        return 'DEGRADED';
    }
    return 'NORMAL';
}

function getDispatchFanoutLimit(): number {
    if (!AUTO_LOAD_SHEDDING_ENABLED) return FANOUT_CONCURRENCY;
    if (loadSheddingState.mode === 'CRITICAL') {
        return Math.max(1, Math.min(FANOUT_CONCURRENCY, LOAD_SHEDDING_CRITICAL_FANOUT_LIMIT));
    }
    if (loadSheddingState.mode === 'DEGRADED') {
        return Math.max(1, Math.min(FANOUT_CONCURRENCY, LOAD_SHEDDING_DEGRADED_FANOUT_LIMIT));
    }
    return FANOUT_CONCURRENCY;
}

function isMempoolDispatchPaused(): boolean {
    if (!AUTO_LOAD_SHEDDING_ENABLED) return false;
    if (loadSheddingState.mode === 'CRITICAL') return true;
    return loadSheddingState.mode === 'DEGRADED' && LOAD_SHEDDING_PAUSE_MEMPOOL_ON_DEGRADED;
}

function transitionLoadSheddingMode(nextMode: LoadSheddingMode, reason: string): void {
    const prevMode = loadSheddingState.mode;
    if (nextMode === prevMode) return;
    loadSheddingState.mode = nextMode;
    loadSheddingState.lastModeChangeAt = Date.now();
    const message = `[Supervisor] 🚦 Load shedding ${prevMode} -> ${nextMode}. ${reason}. fanout=${getDispatchFanoutLimit()} mempoolPaused=${isMempoolDispatchPaused()}`;
    if (loadSheddingSeverity(nextMode) > loadSheddingSeverity(prevMode)) {
        console.warn(message);
    } else {
        console.log(message);
    }
}

function evaluateLoadSheddingState(params: { queueDepth: number; queueP95LagMs: number; source: 'interval' | 'summary' }): void {
    loadSheddingState.lastQueueDepth = params.queueDepth;
    loadSheddingState.lastQueueP95LagMs = params.queueP95LagMs;
    if (!AUTO_LOAD_SHEDDING_ENABLED) return;

    const targetMode = computeLoadSheddingTargetMode(params.queueDepth, params.queueP95LagMs);
    const currentMode = loadSheddingState.mode;
    if (targetMode === currentMode) {
        if (currentMode === 'NORMAL') {
            loadSheddingState.healthyWindows = 0;
        }
        return;
    }

    if (targetMode === 'NORMAL' && currentMode !== 'NORMAL') {
        loadSheddingState.healthyWindows += 1;
        if (loadSheddingState.healthyWindows < LOAD_SHEDDING_RECOVERY_WINDOWS) {
            return;
        }
    } else {
        loadSheddingState.healthyWindows = 0;
    }

    const reason = `source=${params.source} depth=${params.queueDepth} p95LagMs=${params.queueP95LagMs}`;
    transitionLoadSheddingMode(targetMode, reason);
    if (targetMode === 'NORMAL') {
        loadSheddingState.healthyWindows = 0;
    }
}

async function evaluateLoadSheddingSnapshot(source: 'interval' | 'summary' = 'interval'): Promise<void> {
    if (!AUTO_LOAD_SHEDDING_ENABLED) return;
    try {
        const queueDepth = await queueStore.size();
        const queueP95LagMs = calculatePercentile(queueLagSamplesMs, 95);
        evaluateLoadSheddingState({ queueDepth, queueP95LagMs, source });
    } catch (error) {
        console.warn('[Supervisor] Load shedding snapshot failed:', error);
    }
}

async function logMetricsSummary(): Promise<void> {
    try {
        flushSignalSourceWindow();
        evaluateWsHealth();
        const closedTotal = sourceStats.closedWsOnly + sourceStats.closedPollingOnly + sourceStats.closedBoth;
        signalHealth.sourceMismatchRate = closedTotal > 0
            ? (sourceStats.closedWsOnly + sourceStats.closedPollingOnly) / closedTotal
            : 0;
        const duration = (Date.now() - metrics.lastResetAt) / 1000 / 60; // minutes
        const decidedExecutions = metrics.successfulExecutions + metrics.failedExecutions;
        const avgLatency = decidedExecutions > 0
            ? (metrics.totalLatencyMs / decidedExecutions / 1000).toFixed(2)
            : '0';
        const successRate = decidedExecutions > 0
            ? ((metrics.successfulExecutions / decidedExecutions) * 100).toFixed(1)
            : '100';
        const queueDepth = await queueStore.size();
        queueStats.maxDepth = Math.max(queueStats.maxDepth, queueDepth);
        const avgQueueLag = queueStats.dequeued > 0
            ? (queueStats.totalLagMs / queueStats.dequeued / 1000).toFixed(2)
            : '0';
        const p95QueueLagMs = calculatePercentile(queueLagSamplesMs, 95);
        evaluateLoadSheddingState({ queueDepth, queueP95LagMs: p95QueueLagMs, source: 'summary' });
        const rejectSummary = summarizeTopRejectReasons();
        const walletSummary = summarizeTopWalletStats();

        console.log(`[Metrics] 📊 Last ${duration.toFixed(1)}min: total=${metrics.totalExecutions} success=${metrics.successfulExecutions} failed=${metrics.failedExecutions} skipped=${metrics.skippedExecutions} successRate=${successRate}% avgLatency=${avgLatency}s`);
        console.log(`[Metrics] 📦 Queue: depth=${queueDepth} maxDepth=${queueStats.maxDepth} dropped=${queueStats.dropped} avgLag=${avgQueueLag}s p95Lag=${(p95QueueLagMs / 1000).toFixed(2)}s maxLag=${(queueStats.maxLagMs / 1000).toFixed(2)}s`);
        console.log(`[Metrics] 🚦 Load shedding: mode=${loadSheddingState.mode} fanout=${getDispatchFanoutLimit()} mempoolPaused=${isMempoolDispatchPaused()} healthyWindows=${loadSheddingState.healthyWindows}`);
        console.log(`[Metrics] 🛡️ Reject reasons: total=${rejectStats.total} top=[${rejectSummary}]`);
        console.log(`[Metrics] 👛 Wallet success: top=[${walletSummary}]`);
        if (reconciliationMetrics.runs > 0 || reconciliationMetrics.lastRunAt > 0) {
            console.log(
                `[Metrics] 🧮 Reconcile: runs=${reconciliationMetrics.runs} errors=${reconciliationMetrics.errors} scanned=${reconciliationMetrics.scanned} reconciled=${reconciliationMetrics.reconciled} skipped=${reconciliationMetrics.skipped} totalAbsDiff=$${reconciliationMetrics.totalAbsDiff.toFixed(4)} maxAbsDiff=$${reconciliationMetrics.maxAbsDiff.toFixed(4)} lastElapsed=${reconciliationMetrics.lastElapsedMs}ms lastAt=${reconciliationMetrics.lastRunAt ? new Date(reconciliationMetrics.lastRunAt).toISOString() : 'n/a'}`
            );
        }
        console.log(`[Metrics] 🧾 Dedup: hits=${dedupStats.hits} misses=${dedupStats.misses}`);
        console.log(`[Metrics] 📡 Signal: mode=${SIGNAL_MODE} poll_lag_ms=${signalHealth.pollLagMs} ws_last_event_age_ms=${signalHealth.wsLastEventAgeMs} source_mismatch_rate=${signalHealth.sourceMismatchRate.toFixed(4)} ws_degraded=${signalHealth.wsDegraded}`);
        console.log(`[Metrics] 📡 Source counts: ws=${sourceStats.wsEvents} polling=${sourceStats.pollingEvents} both=${sourceStats.closedBoth} ws_only=${sourceStats.closedWsOnly} polling_only=${sourceStats.closedPollingOnly}`);
        if (configRefreshStats.lastRunAt) {
            console.log(`[Metrics] 🧭 Config refresh: mode=${configRefreshStats.lastMode} fetched=${configRefreshStats.lastFetched} duration=${configRefreshStats.lastDurationMs}ms at=${new Date(configRefreshStats.lastRunAt).toISOString()}`);
        }

        // 周期性清零窗口指标，形成滚动观测（而非进程生命周期累计）。
        metrics.totalExecutions = 0;
        metrics.successfulExecutions = 0;
        metrics.failedExecutions = 0;
        metrics.skippedExecutions = 0;
        metrics.totalLatencyMs = 0;
        metrics.lastResetAt = Date.now();
        queueStats.enqueued = 0;
        queueStats.dequeued = 0;
        queueStats.dropped = 0;
        queueStats.totalLagMs = 0;
        queueStats.maxLagMs = 0;
        queueStats.maxDepth = queueDepth;
        queueLagSamplesMs.length = 0;
        rejectStats.total = 0;
        rejectStats.byReason.clear();
        walletExecutionStats.clear();
        reconciliationMetrics.runs = 0;
        reconciliationMetrics.errors = 0;
        reconciliationMetrics.scanned = 0;
        reconciliationMetrics.reconciled = 0;
        reconciliationMetrics.skipped = 0;
        reconciliationMetrics.totalAbsDiff = 0;
        reconciliationMetrics.maxAbsDiff = 0;
        dedupStats.hits = 0;
        dedupStats.misses = 0;
        sourceStats.wsEvents = 0;
        sourceStats.pollingEvents = 0;
        sourceStats.closedBoth = 0;
        sourceStats.closedWsOnly = 0;
        sourceStats.closedPollingOnly = 0;
    } catch (error) {
        console.warn('[Supervisor] Metrics summary failed:', error);
    }
}

function buildSellReconciliationMessage(params: {
    existing: string | null;
    previousCopySize: number;
    reconciledCopySize: number;
    fillSource?: string;
}): string {
    const delta = params.reconciledCopySize - params.previousCopySize;
    const marker = `SELL_RECONCILED ${params.previousCopySize.toFixed(6)} -> ${params.reconciledCopySize.toFixed(6)} (delta ${delta.toFixed(6)}, source ${params.fillSource || 'unknown'})`;
    if (!params.existing) return marker;
    if (params.existing.includes('SELL_RECONCILED')) return params.existing;
    return `${params.existing} | ${marker}`;
}

async function runSellAccountingReconciliation(): Promise<void> {
    if (!SELL_RECONCILIATION_ENABLED || isSellReconciliationRunning) return;
    isSellReconciliationRunning = true;

    const startedAt = Date.now();
    reconciliationMetrics.runs += 1;
    reconciliationMetrics.lastRunAt = startedAt;
    let scanned = 0;
    let reconciled = 0;
    let skipped = 0;
    let totalAbsDiff = 0;
    let maxAbsDiff = 0;

    try {
        const since = new Date(Date.now() - SELL_RECONCILIATION_LOOKBACK_MS);
        const candidates = await prisma.copyTrade.findMany({
            where: {
                originalSide: 'SELL',
                status: { in: ['EXECUTED', 'SETTLEMENT_PENDING'] },
                executedAt: { gte: since },
                txHash: { not: null },
                copySize: { gt: 0 },
            },
            select: {
                id: true,
                txHash: true,
                copySize: true,
                copyPrice: true,
                errorMessage: true,
                tokenId: true,
                config: {
                    select: {
                        walletAddress: true,
                    },
                },
            },
            orderBy: { executedAt: 'desc' },
            take: SELL_RECONCILIATION_MAX_TRADES,
        });

        for (const trade of candidates) {
            const orderId = (trade.txHash || '').trim();
            if (!orderId || orderId.startsWith('sim-')) {
                skipped += 1;
                continue;
            }

            scanned += 1;
            let fillInfo: { executedNotional?: number; avgFillPrice?: number; fillSource?: string } | null = null;
            try {
                fillInfo = await masterTradingService.lookupOrderFillInfo(orderId);
            } catch (error) {
                skipped += 1;
                continue;
            }

            const reconciledCopySize = Number(fillInfo?.executedNotional || 0);
            if (!Number.isFinite(reconciledCopySize) || reconciledCopySize <= 0) {
                skipped += 1;
                continue;
            }

            const diff = reconciledCopySize - trade.copySize;
            if (Math.abs(diff) < SELL_RECONCILIATION_DIFF_THRESHOLD_USDC) {
                continue;
            }

            const reconciledCopyPrice = Number(fillInfo?.avgFillPrice || 0) > 0
                ? Number(fillInfo?.avgFillPrice)
                : trade.copyPrice;

            await prisma.copyTrade.update({
                where: { id: trade.id },
                data: {
                    copySize: reconciledCopySize,
                    copyPrice: reconciledCopyPrice,
                    errorMessage: buildSellReconciliationMessage({
                        existing: trade.errorMessage,
                        previousCopySize: trade.copySize,
                        reconciledCopySize,
                        fillSource: fillInfo?.fillSource,
                    }),
                },
            });

            await recordGuardrailEvent({
                reason: 'SELL_RECONCILED',
                source: 'supervisor-reconcile',
                walletAddress: trade.config.walletAddress,
                amount: Math.abs(diff),
                tradeId: trade.id,
                tokenId: trade.tokenId || undefined,
            });

            reconciled += 1;
            totalAbsDiff += Math.abs(diff);
            maxAbsDiff = Math.max(maxAbsDiff, Math.abs(diff));
        }

        const elapsed = Date.now() - startedAt;
        reconciliationMetrics.scanned += scanned;
        reconciliationMetrics.reconciled += reconciled;
        reconciliationMetrics.skipped += skipped;
        reconciliationMetrics.totalAbsDiff += totalAbsDiff;
        reconciliationMetrics.maxAbsDiff = Math.max(reconciliationMetrics.maxAbsDiff, maxAbsDiff);
        reconciliationMetrics.lastElapsedMs = elapsed;
        console.log(`[Supervisor] 🔎 SELL reconciliation done: scanned=${scanned} reconciled=${reconciled} skipped=${skipped} totalAbsDiff=$${totalAbsDiff.toFixed(4)} elapsed=${elapsed}ms`);
    } catch (error) {
        reconciliationMetrics.errors += 1;
        reconciliationMetrics.lastElapsedMs = Date.now() - startedAt;
        console.warn('[Supervisor] SELL reconciliation failed:', error);
    } finally {
        isSellReconciliationRunning = false;
    }
}

// --- PRICE CACHE (5 second TTL) ---
const priceCache = new Map<string, { price: number; timestamp: number }>();
const PRICE_CACHE_TTL = 5000;
const MEMPOOL_PRICE_FALLBACK_MAX_AGE_MS = Math.max(
    PRICE_CACHE_TTL,
    parseInt(process.env.SUPERVISOR_MEMPOOL_PRICE_FALLBACK_MAX_AGE_MS || '15000', 10)
);
const PREFLIGHT_CACHE_TTL_MS = 2000;
const marketMetaCache = new Map<string, { data: { marketSlug: string; conditionId: string; outcome: string }; fetchedAt: number }>();

const MARKET_CAPS = new Map<string, number>();
if (MARKET_CAPS_RAW) {
    MARKET_CAPS_RAW.split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .forEach((entry) => {
            const [slug, cap] = entry.split(/[:=]/).map((part) => part.trim());
            const capValue = Number(cap);
            if (slug && Number.isFinite(capValue) && capValue > 0) {
                MARKET_CAPS.set(slug.toLowerCase(), capValue);
            }
        });
}

function buildPriceCacheKey(tokenId: string, side: 'BUY' | 'SELL'): string {
    return `${tokenId}:${side}`;
}

function extractSidePrice(orderbook: any, side: 'BUY' | 'SELL'): number | null {
    const raw = side === 'BUY' ? orderbook?.asks?.[0]?.price : orderbook?.bids?.[0]?.price;
    const price = Number(raw);
    if (!Number.isFinite(price) || price <= 0) return null;
    return price;
}

async function getCachedPrice(tokenId: string, side: 'BUY' | 'SELL'): Promise<number> {
    const cacheKey = buildPriceCacheKey(tokenId, side);
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
        return cached.price;
    }
    try {
        const ob = await masterTradingService.getOrderBook(tokenId);
        const price = extractSidePrice(ob, side);
        if (!price) throw new Error('NO_SIDE_PRICE');
        priceCache.set(cacheKey, { price, timestamp: Date.now() });
        console.log(`[Supervisor] 💰 Price fetched for ${tokenId} (${side}): $${price.toFixed(4)}`);
        return price;
    } catch (e: any) {
        // 标准路径允许回退兜底值，避免系统断流。
        console.warn(`[Supervisor] Price fetch failed for ${tokenId} (${side}): ${e.message}`);
        return cached?.price || 0.5;
    }
}

async function getStrictMempoolPrice(tokenId: string, side: 'BUY' | 'SELL'): Promise<number | null> {
    const cacheKey = buildPriceCacheKey(tokenId, side);
    const now = Date.now();
    const cached = priceCache.get(cacheKey);
    if (cached && now - cached.timestamp < PRICE_CACHE_TTL) {
        return cached.price;
    }

    try {
        const ob = await masterTradingService.getOrderBook(tokenId);
        const price = extractSidePrice(ob, side);
        if (!price) throw new Error('NO_SIDE_PRICE');
        priceCache.set(cacheKey, { price, timestamp: now });
        return price;
    } catch (e: any) {
        if (cached && now - cached.timestamp <= MEMPOOL_PRICE_FALLBACK_MAX_AGE_MS) {
            console.warn(`[Supervisor] Mempool price fetch failed for ${tokenId} (${side}), using cached fallback age=${now - cached.timestamp}ms`);
            return cached.price;
        }
        console.warn(`[Supervisor] Mempool price unavailable for ${tokenId} (${side}): ${e.message}`);
        return null;
    }
}

// --- POSITION CACHE (for fast sell-skip checks) ---
// Maps: walletAddress -> tokenId -> balance
const userPositionsCache = new Map<string, Map<string, number>>();
const POSITION_CACHE_REFRESH_INTERVAL = 5 * 60 * 1000; // Refresh every 5 minutes

const preflightCache = new Map<string, { value: any; fetchedAt: number }>();
const preflightInFlight = new Map<string, Promise<any>>();

function buildPreflightKey(parts: Array<string | number | null | undefined>): string {
    return parts
        .filter((part) => part !== null && part !== undefined)
        .map((part) => String(part))
        .join('|');
}

async function getPreflightCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = preflightCache.get(key);
    if (cached && Date.now() - cached.fetchedAt <= PREFLIGHT_CACHE_TTL_MS) {
        return cached.value as T;
    }

    const inflight = preflightInFlight.get(key);
    if (inflight) {
        // 同 key 请求复用 Promise，降低高并发下重复 RPC/DB 开销。
        return inflight as Promise<T>;
    }

    const promise = (async () => {
        try {
            const value = await fetcher();
            if (value !== undefined && value !== null) {
                preflightCache.set(key, { value, fetchedAt: Date.now() });
            }
            return value;
        } finally {
            preflightInFlight.delete(key);
        }
    })();

    preflightInFlight.set(key, promise);
    return promise;
}

interface CounterStore {
    get(key: string): Promise<number | null>;
    set(key: string, value: number, ttlMs: number): Promise<void>;
    incrBy(key: string, value: number, ttlMs: number): Promise<number>;
}

class MemoryCounterStore implements CounterStore {
    private store = new Map<string, { value: number; expiresAt: number }>();
    async get(key: string): Promise<number | null> {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (entry.expiresAt <= Date.now()) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }
    async set(key: string, value: number, ttlMs: number): Promise<void> {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
    async incrBy(key: string, value: number, ttlMs: number): Promise<number> {
        const current = await this.get(key);
        const next = (current ?? 0) + value;
        await this.set(key, next, ttlMs);
        return next;
    }
}

class RedisCounterStore implements CounterStore {
    constructor(private client: any, private prefix: string) { }
    async get(key: string): Promise<number | null> {
        const value = await this.client.get(`${this.prefix}${key}`);
        return value ? Number(value) : null;
    }
    async set(key: string, value: number, ttlMs: number): Promise<void> {
        await this.client.set(`${this.prefix}${key}`, value.toString(), 'PX', ttlMs);
    }
    async incrBy(key: string, value: number, ttlMs: number): Promise<number> {
        const fullKey = `${this.prefix}${key}`;
        const next = await this.client.incrbyfloat(fullKey, value);
        await this.client.pexpire(fullKey, ttlMs);
        return Number(next);
    }
}

let counterStore: CounterStore = new MemoryCounterStore();

async function getCachedCounter(key: string, fallback: () => Promise<number>): Promise<number> {
    const cached = await counterStore.get(key);
    if (cached !== null) return cached;
    const value = await fallback();
    await counterStore.set(key, value, GUARDRAIL_CACHE_TTL_MS);
    return value;
}

function getDailyKey(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

function getWindowBucket(): string {
    return String(Math.floor(Date.now() / TRADE_WINDOW_MS));
}

async function incrementGuardrailCounters(params: {
    walletAddress: string;
    amount: number;
    marketSlug?: string;
}) {
    const dailyKey = getDailyKey(new Date());
    await counterStore.incrBy(`global:${dailyKey}`, params.amount, GUARDRAIL_CACHE_TTL_MS);
    await counterStore.incrBy(`wallet:${params.walletAddress.toLowerCase()}:${dailyKey}`, params.amount, GUARDRAIL_CACHE_TTL_MS);
    if (params.marketSlug) {
        await counterStore.incrBy(`market:${params.marketSlug.toLowerCase()}:${dailyKey}`, params.amount, GUARDRAIL_CACHE_TTL_MS);
    }
    await counterStore.incrBy(`window:${getWindowBucket()}`, 1, GUARDRAIL_CACHE_TTL_MS);
}

async function recordGuardrailEvent(params: {
    reason: string;
    source: string;
    walletAddress?: string;
    amount?: number;
    tradeId?: string;
    tokenId?: string;
}) {
    if (params.reason !== 'SELL_RECONCILED') {
        recordRejectReason(params.reason);
    }
    try {
        await prisma.guardrailEvent.create({
            data: {
                reason: params.reason,
                source: params.source,
                walletAddress: params.walletAddress,
                amount: params.amount,
                tradeId: params.tradeId,
                tokenId: params.tokenId,
            },
        });
    } catch (error) {
        console.warn('[Supervisor] Failed to persist guardrail event:', error);
    }
}

async function getExecutedTotalSince(since: Date, walletAddress?: string): Promise<number> {
    const where = {
        status: { in: ['EXECUTED', 'SETTLEMENT_PENDING'] },
        executedAt: { gte: since },
        ...(walletAddress
            ? { config: { walletAddress: walletAddress.toLowerCase() } }
            : {}),
    } as any;

    const result = await prisma.copyTrade.aggregate({
        _sum: { copySize: true },
        where,
    });

    return Number(result?._sum?.copySize || 0);
}

async function getExecutedTotalForMarketSince(since: Date, marketSlug: string): Promise<number> {
    const result = await prisma.copyTrade.aggregate({
        _sum: { copySize: true },
        where: {
            status: { in: ['EXECUTED', 'SETTLEMENT_PENDING'] },
            executedAt: { gte: since },
            marketSlug,
        },
    });

    return Number(result?._sum?.copySize || 0);
}

async function getExecutedCountSince(since: Date): Promise<number> {
    return prisma.copyTrade.count({
        where: {
            status: { in: ['EXECUTED', 'SETTLEMENT_PENDING'] },
            executedAt: { gte: since },
        },
    });
}

async function checkExecutionGuardrails(
    walletAddress: string,
    amount: number,
    context: { source?: string; marketSlug?: string; tradeId?: string; tokenId?: string } = {}
): Promise<{ allowed: boolean; reason?: string }> {
    const source = context.source || 'supervisor';
    const marketSlug = context.marketSlug?.toLowerCase();

    // Supervisor 侧 guardrail 与 worker 侧保持同口径，避免双系统判定不一致。
    if (EMERGENCY_PAUSE) {
        await recordGuardrailEvent({ reason: 'EMERGENCY_PAUSE', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
        return { allowed: false, reason: 'EMERGENCY_PAUSE' };
    }

    if (!ENABLE_REAL_TRADING) {
        await recordGuardrailEvent({ reason: 'REAL_TRADING_DISABLED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
        return { allowed: false, reason: 'REAL_TRADING_DISABLED' };
    }

    if (EXECUTION_ALLOWLIST.length > 0) {
        const normalized = walletAddress.toLowerCase();
        if (!EXECUTION_ALLOWLIST.includes(normalized)) {
            await recordGuardrailEvent({ reason: 'ALLOWLIST_BLOCKED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
            return { allowed: false, reason: 'ALLOWLIST_BLOCKED' };
        }
    }

    if (MAX_TRADE_USD > 0 && amount > MAX_TRADE_USD) {
        await recordGuardrailEvent({ reason: 'MAX_TRADE_EXCEEDED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
        return { allowed: false, reason: `MAX_TRADE_EXCEEDED (${amount.toFixed(2)} > ${MAX_TRADE_USD})` };
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyKey = getDailyKey(new Date());

    if (GLOBAL_DAILY_CAP_USD > 0) {
        const globalUsed = await getCachedCounter(`global:${dailyKey}`, () => getExecutedTotalSince(since));
        if (globalUsed + amount > GLOBAL_DAILY_CAP_USD) {
            await recordGuardrailEvent({ reason: 'GLOBAL_DAILY_CAP_EXCEEDED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
            return {
                allowed: false,
                reason: `GLOBAL_DAILY_CAP_EXCEEDED (${globalUsed.toFixed(2)} + ${amount.toFixed(2)} > ${GLOBAL_DAILY_CAP_USD})`,
            };
        }
    }

    if (WALLET_DAILY_CAP_USD > 0) {
        const walletUsed = await getCachedCounter(
            `wallet:${walletAddress.toLowerCase()}:${dailyKey}`,
            () => getExecutedTotalSince(since, walletAddress)
        );
        if (walletUsed + amount > WALLET_DAILY_CAP_USD) {
            await recordGuardrailEvent({ reason: 'WALLET_DAILY_CAP_EXCEEDED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
            return {
                allowed: false,
                reason: `WALLET_DAILY_CAP_EXCEEDED (${walletUsed.toFixed(2)} + ${amount.toFixed(2)} > ${WALLET_DAILY_CAP_USD})`,
            };
        }
    }

    if (marketSlug) {
        const marketCap = MARKET_CAPS.get(marketSlug) || MARKET_DAILY_CAP_USD;
        if (marketCap > 0) {
            const marketUsed = await getCachedCounter(
                `market:${marketSlug.toLowerCase()}:${dailyKey}`,
                () => getExecutedTotalForMarketSince(since, marketSlug)
            );
            if (marketUsed + amount > marketCap) {
                await recordGuardrailEvent({ reason: 'MARKET_DAILY_CAP_EXCEEDED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
                return {
                    allowed: false,
                    reason: `MARKET_DAILY_CAP_EXCEEDED (${marketUsed.toFixed(2)} + ${amount.toFixed(2)} > ${marketCap})`,
                };
            }
        }
    }

    if (MAX_TRADES_PER_WINDOW > 0) {
        const windowStart = new Date(Date.now() - TRADE_WINDOW_MS);
        const tradeCount = await getCachedCounter(
            `window:${getWindowBucket()}`,
            () => getExecutedCountSince(windowStart)
        );
        if (tradeCount >= MAX_TRADES_PER_WINDOW) {
            await recordGuardrailEvent({ reason: 'TRADE_RATE_LIMIT_EXCEEDED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
            return {
                allowed: false,
                reason: `TRADE_RATE_LIMIT_EXCEEDED (${tradeCount} >= ${MAX_TRADES_PER_WINDOW})`,
            };
        }
    }

    if (DRY_RUN) {
        await recordGuardrailEvent({ reason: 'DRY_RUN', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
        return { allowed: false, reason: 'DRY_RUN' };
    }

    return { allowed: true };
}

async function preflightExecutionEOA(
    walletAddress: string,
    side: 'BUY' | 'SELL',
    tokenId: string,
    copySize: number,
    price: number
): Promise<{ allowed: boolean; reason?: string; adjustedCopySize: number; adjustedCopyShares: number }> {
    if (!provider) {
        return { allowed: false, reason: 'NO_PROVIDER', adjustedCopySize: copySize, adjustedCopyShares: 0 };
    }

    if (!price || price <= 0) {
        return { allowed: false, reason: 'INVALID_PRICE', adjustedCopySize: copySize, adjustedCopyShares: 0 };
    }

    if (side === 'BUY') {
        const chainKey = CHAIN_ID === 137 ? 'polygon' : 'amoy';
        const usdcAddress = CONTRACT_ADDRESSES[chainKey].usdc;
        const usdc = new ethers.Contract(usdcAddress, ERC20_ABI, provider);
        const balanceRaw = await getPreflightCached(
            buildPreflightKey(['eoausdc', walletAddress]),
            () => usdc.balanceOf(walletAddress)
        ).catch(() => ethers.BigNumber.from(0));
        const balance = Number(ethers.utils.formatUnits(balanceRaw, USDC_DECIMALS));
        if (balance < copySize) {
            return {
                allowed: false,
                reason: `INSUFFICIENT_USDC ${balance.toFixed(2)} < ${copySize.toFixed(2)}`,
                adjustedCopySize: copySize,
                adjustedCopyShares: copySize / price,
            };
        }
        return { allowed: true, adjustedCopySize: copySize, adjustedCopyShares: copySize / price };
    }

    const ctf = new ethers.Contract(CONTRACT_ADDRESSES.ctf, CTF_ABI, provider);
    const balanceRaw = await getPreflightCached(
        buildPreflightKey(['eoactf', walletAddress, tokenId]),
        () => ctf.balanceOf(walletAddress, tokenId)
    ).catch(() => ethers.BigNumber.from(0));
    const actualShares = Number(ethers.utils.formatUnits(balanceRaw, USDC_DECIMALS));
    const requestedShares = copySize / price;
    const adjustedShares = Math.min(requestedShares, actualShares);

    if (adjustedShares <= 0) {
        return { allowed: false, reason: 'NO_SHARES_AVAILABLE', adjustedCopySize: 0, adjustedCopyShares: 0 };
    }

    if (adjustedShares < requestedShares) {
        console.log(`[Supervisor] ⚠️ EOA sell capped: requested ${requestedShares.toFixed(2)}, available ${actualShares.toFixed(2)}`);
    }

    return {
        allowed: true,
        adjustedCopySize: adjustedShares * price,
        adjustedCopyShares: adjustedShares,
    };
}

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
        await prefetchMarketMetadata(positions.map((pos) => pos.tokenId));
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

function setPositionCacheBalance(walletAddress: string, tokenId: string, balance: number): void {
    const wallet = walletAddress.toLowerCase();
    if (!userPositionsCache.has(wallet)) {
        userPositionsCache.set(wallet, new Map());
    }
    const positions = userPositionsCache.get(wallet)!;
    if (balance <= 0) {
        positions.delete(tokenId);
        return;
    }
    positions.set(tokenId, balance);
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
    setPositionCacheBalance(walletAddress, tokenId, newBalance);
}

type SellPositionDecision = {
    allow: boolean;
    source: 'cache' | 'db' | 'none' | 'fail-open';
    balance?: number;
};

async function resolveSellPositionDecision(walletAddress: string, tokenId: string): Promise<SellPositionDecision> {
    if (hasPosition(walletAddress, tokenId)) {
        return { allow: true, source: 'cache' };
    }

    const normalizedWallet = walletAddress.toLowerCase();
    const key = buildPreflightKey(['sell-position', normalizedWallet, tokenId]);

    try {
        const dbBalance = await getPreflightCached<number>(
            key,
            async () => {
                const position = await prisma.userPosition.findFirst({
                    where: {
                        walletAddress: normalizedWallet,
                        tokenId,
                        balance: { gt: 0 },
                    },
                    select: { balance: true },
                });
                return Number(position?.balance || 0);
            }
        );

        if (dbBalance > 0) {
            setPositionCacheBalance(walletAddress, tokenId, dbBalance);
            return { allow: true, source: 'db', balance: dbBalance };
        }
        return { allow: false, source: 'none' };
    } catch (error) {
        // DB 确认失败时按 fail-open 继续，让后续执行层（余额/授权检查）兜底。
        console.warn(`[Supervisor] SELL DB confirmation failed, fail-open for ${walletAddress} ${tokenId}:`, error);
        return { allow: true, source: 'fail-open' };
    }
}

// --- EVENT DEDUPLICATION (Shared Store) ---
interface DedupStore {
    checkAndSet(key: string, ttlMs: number): Promise<boolean>;
}

class MemoryDedupStore implements DedupStore {
    private store = new Map<string, number>();
    async checkAndSet(key: string, ttlMs: number): Promise<boolean> {
        const now = Date.now();
        const expiresAt = this.store.get(key);
        if (expiresAt && expiresAt > now) {
            return false;
        }
        this.store.set(key, now + ttlMs);
        if (this.store.size > 5000) {
            for (const [k, v] of Array.from(this.store.entries())) {
                if (v <= now) this.store.delete(k);
            }
        }
        return true;
    }
}

class RedisDedupStore implements DedupStore {
    constructor(private client: any, private prefix: string) { }
    async checkAndSet(key: string, ttlMs: number): Promise<boolean> {
        const result = await this.client.set(`${this.prefix}${key}`, '1', 'PX', ttlMs, 'NX');
        return result === 'OK';
    }
}

let dedupStore: DedupStore = new MemoryDedupStore();
const dedupStats = { hits: 0, misses: 0 };

async function initSharedStores(): Promise<void> {
    const redisRequired = SHARD_COUNT > 1;
    if (!REDIS_URL) {
        if (redisRequired) {
            throw new Error('[Supervisor] SHARD_COUNT>1 requires REDIS_URL for shared queue/dedup/counter stores.');
        }
        console.warn('[Supervisor] ⚠️ REDIS_URL not set. Using in-memory queue/dedup/counters.');
        return;
    }

    try {
        const { default: Redis } = await import('ioredis');
        redisClient = new Redis(REDIS_URL, { enableReadyCheck: true, maxRetriesPerRequest: 2 });
        await redisClient.ping();
        const prefix = 'copytrading:supervisor:';
        queueStore = new RedisQueueStore<JobQueueItem>(redisClient, `${prefix}queue`, QUEUE_MAX_SIZE);
        dedupStore = new RedisDedupStore(redisClient, `${prefix}dedup:`);
        counterStore = new RedisCounterStore(redisClient, `${prefix}counter:`);
        console.log('[Supervisor] ✅ Redis connected. Shared stores enabled.');
    } catch (error) {
        if (redisRequired) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new Error(`[Supervisor] SHARD_COUNT>1 requires Redis connectivity. Failed to initialize shared stores: ${reason}`);
        }
        console.warn('[Supervisor] ⚠️ Redis unavailable, falling back to in-memory stores.', error);
    }
}

function buildDedupKey(params: { txHash: string; logIndex?: number; tokenId?: string; side?: string }): string {
    if (params.logIndex !== undefined && params.logIndex !== null) {
        return `${params.txHash}:${params.logIndex}`;
    }
    if (params.tokenId) {
        return `${params.txHash}:${params.tokenId}:${params.side || ''}`;
    }
    return params.txHash;
}

async function isEventDuplicate(params: { txHash: string; logIndex?: number; tokenId?: string; side?: string; source?: SignalSource }): Promise<boolean> {
    const key = buildDedupKey(params);
    if (params.source) {
        recordSignalSource(key, params.source);
    }
    const allowed = await dedupStore.checkAndSet(key, DEDUP_TTL_MS);
    if (!allowed) {
        dedupStats.hits += 1;
        return true;
    }
    dedupStats.misses += 1;
    return false;
}

function buildOriginalSignalId(params: {
    signal?: SignalIdentity;
    tokenId: string;
    side: 'BUY' | 'SELL';
    originalTrader: string;
    originalSize: number;
    approxPrice: number;
}): string {
    const txHash = params.signal?.txHash?.toLowerCase();
    if (txHash) {
        const logIndexPart = params.signal?.logIndex !== undefined && params.signal?.logIndex !== null
            ? `:${params.signal.logIndex}`
            : '';
        return `${txHash}${logIndexPart}:${params.tokenId}:${params.side}`;
    }

    const fingerprint = [
        params.originalTrader.toLowerCase(),
        params.tokenId,
        params.side,
        params.originalSize.toFixed(6),
        params.approxPrice.toFixed(6),
    ].join(':');
    return `synthetic:${createHash('sha256').update(fingerprint).digest('hex').slice(0, 24)}`;
}

async function safeCreateCopyTrade(data: Prisma.CopyTradeCreateInput, context: string): Promise<boolean> {
    try {
        await prisma.copyTrade.create({ data });
        return true;
    } catch (error: any) {
        if (error?.code === 'P2002') {
            console.log(`[Supervisor] ♻️ Duplicate copyTrade skipped (${context}).`);
            return false;
        }
        throw error;
    }
}

// --- FILTER VALIDATION ---
interface FilterResult {
    passes: boolean;
    reason?: string;
}

interface FilterMarketMetrics {
    depthUsd: number;
    liquidity: number;
    volume24h: number;
}

const filterMetricsCache = new Map<string, { metrics: FilterMarketMetrics; fetchedAt: number }>();
const filterMetricsInFlight = new Map<string, Promise<FilterMarketMetrics | null>>();

function buildFilterMetricsKey(tokenId: string, side: 'BUY' | 'SELL'): string {
    return `${tokenId}:${side}`;
}

function toFinitePositive(value: unknown): number {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return 0;
    return num;
}

function estimateOrderbookDepthUsd(orderbook: any, side: 'BUY' | 'SELL', maxLevels: number): number {
    const levels = side === 'BUY' ? (orderbook?.asks || []) : (orderbook?.bids || []);
    let depthUsd = 0;
    for (let i = 0; i < Math.min(levels.length, maxLevels); i += 1) {
        const level = levels[i];
        const price = toFinitePositive(level?.price);
        const size = toFinitePositive(level?.size);
        if (price <= 0 || size <= 0) continue;
        depthUsd += price * size;
    }
    return depthUsd;
}

async function getFilterMarketMetrics(tokenId: string, side: 'BUY' | 'SELL'): Promise<FilterMarketMetrics | null> {
    const key = buildFilterMetricsKey(tokenId, side);
    const now = Date.now();
    const cached = filterMetricsCache.get(key);
    if (cached && now - cached.fetchedAt <= FILTER_MARKET_STATS_TTL_MS) {
        return cached.metrics;
    }

    const inFlight = filterMetricsInFlight.get(key);
    if (inFlight) return inFlight;

    const request = (async () => {
        try {
            const [metadata, orderbook] = await Promise.all([
                getMarketMetadata(tokenId).catch(() => null),
                masterTradingService.getOrderBook(tokenId).catch(() => null),
            ]);

            const depthUsd = estimateOrderbookDepthUsd(orderbook, side, FILTER_ORDERBOOK_DEPTH_LEVELS);

            let volume24h = toFinitePositive((metadata as any)?.volume);
            let liquidity = 0;

            const conditionId = metadata?.conditionId;
            const marketSlug = metadata?.marketSlug;
            let gammaMarket: any = null;
            if (conditionId && conditionId !== '0x0') {
                gammaMarket = await gammaApi.getMarketByConditionId(conditionId).catch(() => null);
            }
            if (!gammaMarket && marketSlug && !marketSlug.includes('unknown')) {
                gammaMarket = await gammaApi.getMarketBySlug(marketSlug).catch(() => null);
            }

            if (gammaMarket) {
                volume24h = toFinitePositive(gammaMarket.volume24hr ?? gammaMarket.volume ?? volume24h);
                liquidity = toFinitePositive(gammaMarket.liquidity);
            }

            const metrics: FilterMarketMetrics = {
                depthUsd,
                liquidity,
                volume24h,
            };

            if (metrics.depthUsd <= 0 && metrics.liquidity <= 0 && metrics.volume24h <= 0) {
                return null;
            }

            filterMetricsCache.set(key, { metrics, fetchedAt: Date.now() });
            return metrics;
        } finally {
            filterMetricsInFlight.delete(key);
        }
    })();

    filterMetricsInFlight.set(key, request);
    return request;
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

    if ((config.minLiquidity && config.minLiquidity > 0) || (config.minVolume && config.minVolume > 0)) {
        const metrics = await getFilterMarketMetrics(tokenId, side);
        if (!metrics) {
            return {
                passes: false,
                reason: 'market metrics unavailable for liquidity/volume filters',
            };
        }

        if (config.minLiquidity && config.minLiquidity > 0) {
            // minLiquidity 优先用 side 盘口深度，缺失时回退到 Gamma liquidity。
            const effectiveLiquidity = metrics.depthUsd > 0 ? metrics.depthUsd : metrics.liquidity;
            if (effectiveLiquidity < config.minLiquidity) {
                return {
                    passes: false,
                    reason: `minLiquidity filter failed: ${effectiveLiquidity.toFixed(2)} < ${config.minLiquidity.toFixed(2)}`,
                };
            }
        }

        if (config.minVolume && config.minVolume > 0) {
            if (metrics.volume24h < config.minVolume) {
                return {
                    passes: false,
                    reason: `minVolume filter failed: ${metrics.volume24h.toFixed(2)} < ${config.minVolume.toFixed(2)}`,
                };
            }
        }
    }

    return { passes: true };
}

async function checkQueue() {
    if (!walletManager || isDrainingQueue) return;
    isDrainingQueue = true;

    try {
        while (true) {
            const worker = walletManager.checkoutWorker();
            if (!worker) return;

            const job = await queueStore.dequeue();
            if (!job) {
                walletManager.checkinWorker(worker.address);
                return;
            }

            const lagMs = job.enqueuedAt ? (Date.now() - job.enqueuedAt) : 0;
            queueStats.dequeued += 1;
            queueStats.totalLagMs += lagMs;
            queueStats.maxLagMs = Math.max(queueStats.maxLagMs, lagMs);
            appendQueueLagSample(lagMs);

            console.log(`[Supervisor] 📥 Dequeued job for User ${job.config.walletAddress}.`);
            const originalSignalId = job.originalSignalId || buildOriginalSignalId({
                tokenId: job.tokenId,
                side: job.side,
                originalTrader: job.originalTrader,
                originalSize: job.originalSize,
                approxPrice: job.approxPrice,
            });
            void executeJobInternal(
                worker,
                job.config,
                job.side,
                job.tokenId,
                job.approxPrice,
                job.originalTrader,
                job.originalSize,
                originalSignalId,
                job.isPreflight,
                job.overrides
            );
        }
    } catch (error) {
        console.error('[Supervisor] Queue drain failed:', error);
    } finally {
        isDrainingQueue = false;
    }
}

function ownsTrader(traderAddress: string): boolean {
    if (SHARD_COUNT <= 1) return true;
    const hash = createHash('sha256').update(traderAddress.toLowerCase()).digest('hex');
    const bucket = parseInt(hash.slice(0, 8), 16) % SHARD_COUNT;
    return bucket === SHARD_INDEX_EFFECTIVE;
}

function buildActivitySubscriptionKey(addresses: string[], filtered: boolean): string {
    if (!filtered) return 'all';
    if (addresses.length === 0) return 'none';
    const sorted = [...addresses].sort();
    const hash = createHash('sha256').update(sorted.join(',')).digest('hex');
    return `filtered:${sorted.length}:${hash}`;
}

function subscribeToActivityIfNeeded(): void {
    if (!isWsSignalEnabled()) {
        if (activitySubscription) {
            activitySubscription.unsubscribe();
            activitySubscription = null;
        }
        activitySubscriptionKey = 'disabled';
        return;
    }

    const sortedAddresses = Array.from(ownedTraders).map((addr) => addr.toLowerCase()).sort();
    const shouldFilter = WS_ADDRESS_FILTER && sortedAddresses.length > 0;
    const nextKey = buildActivitySubscriptionKey(sortedAddresses, shouldFilter);

    if (nextKey === activitySubscriptionKey) return;

    if (activitySubscription) {
        activitySubscription.unsubscribe();
        activitySubscription = null;
    }

    if (!shouldFilter) {
        if (sortedAddresses.length === 0 && WS_ADDRESS_FILTER) {
            activitySubscriptionKey = 'none';
            console.log('[Supervisor] 🎧 Activity subscription paused (no monitored traders).');
            return;
        }
        activitySubscription = realtimeService.subscribeAllActivity({ onTrade: handleActivityTrade });
        activitySubscriptionKey = 'all';
        console.log('[Supervisor] 🎧 Activity subscription: all trades');
        return;
    }

    activitySubscription = realtimeService.subscribeActivity(
        { traderAddresses: sortedAddresses },
        { onTrade: handleActivityTrade }
    );
    activitySubscriptionKey = nextKey;
    console.log(`[Supervisor] 🎧 Activity subscription: filtered (${sortedAddresses.length} traders)`);
}

function getTraderCursorScope(traderAddress: string): string {
    return `trader:${traderAddress.toLowerCase()}`;
}

async function loadSignalCursor(scope: string): Promise<SignalCursorState | null> {
    const cached = signalCursorCache.get(scope);
    if (cached) return cached;
    if (!signalCursorStoreAvailable) return null;

    try {
        const rows = await prisma.$queryRaw<Array<{ scope: string; cursor: number; cursorTxHash: string | null }>>`
            SELECT "scope", "cursor", "cursorTxHash"
            FROM "SignalCursor"
            WHERE "scope" = ${scope} AND "source" = ${SIGNAL_CURSOR_SOURCE}
            LIMIT 1
        `;
        const row = rows[0];
        if (!row) return null;
        const state: SignalCursorState = {
            cursor: Number(row.cursor || 0),
            cursorTxHash: row.cursorTxHash || null,
        };
        signalCursorCache.set(scope, state);
        return state;
    } catch (error) {
        signalCursorStoreAvailable = false;
        console.warn('[Supervisor] ⚠️ Failed to read signal cursor. Falling back to in-memory cursor state.', error);
        return null;
    }
}

async function persistSignalCursor(scope: string, state: SignalCursorState): Promise<void> {
    signalCursorCache.set(scope, state);
    if (!signalCursorStoreAvailable) return;

    try {
        await prisma.$executeRaw`
            INSERT INTO "SignalCursor" ("id", "scope", "source", "cursor", "cursorTxHash", "createdAt", "updatedAt")
            VALUES (${randomUUID()}, ${scope}, ${SIGNAL_CURSOR_SOURCE}, ${state.cursor}, ${state.cursorTxHash}, NOW(), NOW())
            ON CONFLICT ("scope")
            DO UPDATE SET
                "source" = EXCLUDED."source",
                "cursor" = EXCLUDED."cursor",
                "cursorTxHash" = EXCLUDED."cursorTxHash",
                "updatedAt" = NOW()
        `;
    } catch (error) {
        signalCursorStoreAvailable = false;
        console.warn('[Supervisor] ⚠️ Failed to persist signal cursor table. Falling back to in-memory cursor state.', error);
    }
}

async function syncPollingCursorsForOwnedTraders(options: { reloadFromStore?: boolean } = {}): Promise<void> {
    if (!isPollingSignalEnabled()) return;

    const traders = Array.from(ownedTraders);
    if (traders.length === 0) return;

    const scopes = traders.map((trader) => getTraderCursorScope(trader));
    let loaded = 0;
    let initialized = 0;

    if (signalCursorStoreAvailable && options.reloadFromStore) {
        try {
            const rows = await prisma.$queryRaw<Array<{ scope: string; cursor: number; cursorTxHash: string | null }>>`
                SELECT "scope", "cursor", "cursorTxHash"
                FROM "SignalCursor"
                WHERE "source" = ${SIGNAL_CURSOR_SOURCE}
                  AND "scope" IN (${Prisma.join(scopes)})
            `;

            for (const row of rows) {
                signalCursorCache.set(row.scope, {
                    cursor: Number(row.cursor || 0),
                    cursorTxHash: row.cursorTxHash || null,
                });
            }
            loaded = rows.length;
        } catch (error) {
            signalCursorStoreAvailable = false;
            console.warn('[Supervisor] ⚠️ Failed to preload signal cursors. Falling back to in-memory cursor state.', error);
        }
    }

    const seedCursor = Math.floor(Date.now() / 1000) - POLLING_LOOKBACK_SECONDS;
    for (const scope of scopes) {
        if (signalCursorCache.has(scope)) continue;
        initialized += 1;
        await persistSignalCursor(scope, {
            cursor: seedCursor,
            cursorTxHash: null,
        });
    }

    if (loaded > 0 || initialized > 0) {
        console.log(`[Supervisor] 📍 Polling cursors synced: loaded=${loaded}, initialized=${initialized}, ownedTraders=${traders.length}`);
    }
}

async function handlePolledActivityTrade(traderAddress: string, trade: DataActivity): Promise<boolean> {
    if (!trade.transactionHash || !trade.asset || !trade.side) return false;
    const side = trade.side;
    const tokenId = trade.asset;
    const size = Number(trade.size || 0);
    const price = Number(trade.price || 0);

    if (size <= 0 || price <= 0) return false;

    if (await isEventDuplicate({ txHash: trade.transactionHash, tokenId, side, source: 'polling' })) return false;

    const subscribers = activeConfigs.filter((config) => config.traderAddress.toLowerCase() === traderAddress);
    if (subscribers.length === 0) return false;

    console.log(`[Supervisor] 🛰️ POLL DETECTED: ${traderAddress} ${side} ${tokenId} ($${price})`);

    await runWithConcurrency(subscribers, getDispatchFanoutLimit(), async (sub) => {
        await processJob(sub, side, tokenId, price, traderAddress, size, false, undefined, {
            txHash: trade.transactionHash,
        });
    });
    return true;
}

async function pollTraderActivity(traderAddress: string): Promise<{ fetched: number; processed: number; newestTimestamp: number; newestTxHash: string | null }> {
    const normalizedTrader = traderAddress.toLowerCase();
    const scope = getTraderCursorScope(normalizedTrader);
    const nowSec = Math.floor(Date.now() / 1000);

    let state = signalCursorCache.get(scope);
    if (!state) {
        state = await loadSignalCursor(scope) || {
            cursor: nowSec - POLLING_LOOKBACK_SECONDS,
            cursorTxHash: null,
        };
        signalCursorCache.set(scope, state);
    }

    const startCursor = Math.max(0, state.cursor - POLLING_LOOKBACK_SECONDS);
    let offset = 0;
    let fetched = 0;
    let processed = 0;
    let newestTimestamp = state.cursor;
    let newestTxHash = state.cursorTxHash;
    let resumeReached = !state.cursorTxHash;

    while (true) {
        const page = await dataApi.getActivity(normalizedTrader, {
            type: 'TRADE',
            start: startCursor,
            limit: POLLING_LIMIT,
            offset,
            sortBy: 'TIMESTAMP',
            sortDirection: 'ASC',
        });

        if (page.length === 0) break;
        fetched += page.length;

        for (const activity of page) {
            if (activity.type !== 'TRADE') continue;
            const timestamp = Number(activity.timestamp || 0);
            if (!Number.isFinite(timestamp) || timestamp <= 0) continue;
            if (timestamp < state.cursor) continue;
            if (timestamp === state.cursor) {
                if (!state.cursorTxHash) continue;
                if (!resumeReached) {
                    if (activity.transactionHash === state.cursorTxHash) {
                        resumeReached = true;
                    }
                    continue;
                }
            }

            const handled = await handlePolledActivityTrade(normalizedTrader, activity);
            if (handled) {
                processed += 1;
            }

            if (
                timestamp > newestTimestamp
                || (timestamp === newestTimestamp && activity.transactionHash && activity.transactionHash !== newestTxHash)
            ) {
                newestTimestamp = timestamp;
                newestTxHash = activity.transactionHash || null;
            }
        }

        if (page.length < POLLING_LIMIT || offset >= 10000) break;
        offset += POLLING_LIMIT;
    }

    const hasCursorAdvance = newestTimestamp > state.cursor
        || (newestTimestamp === state.cursor && newestTxHash !== state.cursorTxHash);
    if (hasCursorAdvance) {
        await persistSignalCursor(scope, {
            cursor: newestTimestamp,
            cursorTxHash: newestTxHash,
        });
    }

    return { fetched, processed, newestTimestamp, newestTxHash };
}

async function pollOwnedTradersOnce(): Promise<{ fetched: number; processed: number; maxLagMs: number }> {
    const traders = Array.from(ownedTraders);
    signalHealth.pollLastRunAt = Date.now();
    if (traders.length === 0) {
        if (signalHealth.pollLastEventAt > 0) {
            signalHealth.pollLagMs = Date.now() - signalHealth.pollLastEventAt;
        }
        return { fetched: 0, processed: 0, maxLagMs: signalHealth.pollLagMs };
    }

    let totalFetched = 0;
    let totalProcessed = 0;
    let newestTimestamp = 0;
    const pollConcurrency = Math.max(1, Math.min(getDispatchFanoutLimit(), 12));

    await runWithConcurrency(traders, pollConcurrency, async (traderAddress) => {
        try {
            const result = await pollTraderActivity(traderAddress);
            totalFetched += result.fetched;
            totalProcessed += result.processed;
            newestTimestamp = Math.max(newestTimestamp, result.newestTimestamp);
        } catch (error) {
            console.warn(`[Supervisor] Polling failed for trader ${traderAddress}:`, error);
        }
    });

    if (newestTimestamp > 0) {
        signalHealth.pollLagMs = Math.max(0, Date.now() - newestTimestamp * 1000);
    } else if (signalHealth.pollLastEventAt > 0) {
        signalHealth.pollLagMs = Date.now() - signalHealth.pollLastEventAt;
    }

    return { fetched: totalFetched, processed: totalProcessed, maxLagMs: signalHealth.pollLagMs };
}

function schedulePollingLoop(delayMs: number): void {
    if (isShuttingDown || !isPollingSignalEnabled()) return;
    if (pollingLoopTimer) {
        clearTimeout(pollingLoopTimer);
        pollingLoopTimer = null;
    }

    pollingLoopTimer = setTimeout(() => {
        void startPollingLoop();
    }, delayMs);
}

async function startPollingLoop(): Promise<void> {
    if (!isPollingSignalEnabled() || isShuttingDown) return;
    if (pollingLoopRunning) return;
    pollingLoopRunning = true;

    try {
        evaluateWsHealth();
        await syncPollingCursorsForOwnedTraders();
        const cycle = await pollOwnedTradersOnce();
        if (cycle.processed > 0) {
            console.log(`[Supervisor] 🛰️ Poll cycle: fetched=${cycle.fetched} processed=${cycle.processed} lag=${cycle.maxLagMs}ms`);
        }
        if (isPollingOnlyMode() || signalHealth.wsDegraded || cycle.processed > 0) {
            pollingIntervalMs = POLLING_BASE_INTERVAL_MS;
        } else {
            pollingIntervalMs = Math.min(POLLING_MAX_INTERVAL_MS, pollingIntervalMs + 1000);
        }
    } catch (error) {
        pollingIntervalMs = Math.min(POLLING_MAX_INTERVAL_MS, pollingIntervalMs * 2);
        console.error('[Supervisor] Polling loop error:', error);
    } finally {
        pollingLoopRunning = false;
        schedulePollingLoop(pollingIntervalMs);
    }
}

// --- HELPERS ---
function isConfigEligible(config: any): boolean {
    return Boolean(config?.isActive && config?.autoExecute && config?.channel === 'EVENT_LISTENER');
}

function buildActiveConfig(config: any): ActiveConfig {
    return {
        id: config.id,
        walletAddress: config.walletAddress,
        traderAddress: config.traderAddress,
        tradeSizeMode: config.tradeSizeMode,
        mode: config.mode,
        fixedAmount: config.fixedAmount || undefined,
        sizeScale: config.sizeScale || undefined,
        maxSizePerTrade: config.maxSizePerTrade,
        minSizePerTrade: config.minSizePerTrade || undefined,
        maxSlippage: config.maxSlippage,
        slippageType: config.slippageType as 'FIXED' | 'AUTO',
        autoExecute: config.autoExecute,
        executionMode: config.executionMode as 'PROXY' | 'EOA',
        encryptedKey: config.encryptedKey || undefined,
        iv: config.iv || undefined,
        apiKey: config.apiKey || undefined,
        apiSecret: config.apiSecret || undefined,
        apiPassphrase: config.apiPassphrase || undefined,
        // Filter Fields
        minLiquidity: config.minLiquidity || undefined,
        minVolume: config.minVolume || undefined,
        maxOdds: config.maxOdds || undefined
    };
}

async function refreshConfigs(options: { full?: boolean } = {}) {
    if (isRefreshingConfigs) {
        if (options.full) pendingFullRefresh = true;
        return;
    }
    isRefreshingConfigs = true;
    const startedAt = Date.now();
    const fullRefresh = options.full || !configRefreshCursor;

    try {
        let fetched: any[] = [];

        if (fullRefresh) {
            fetched = await prisma.copyTradingConfig.findMany({
                where: {
                    isActive: true,
                    autoExecute: true,
                    channel: 'EVENT_LISTENER'
                }
            });

            configCache.clear();
            for (const config of fetched) {
                configCache.set(config.id, buildActiveConfig(config));
            }
        } else {
            const cursor = configRefreshCursor || new Date(0);
            fetched = await prisma.copyTradingConfig.findMany({
                where: {
                    updatedAt: { gt: cursor }
                }
            });

            for (const config of fetched) {
                if (isConfigEligible(config)) {
                    configCache.set(config.id, buildActiveConfig(config));
                } else {
                    configCache.delete(config.id);
                }
            }
        }

        if (fetched.length > 0) {
            const latest = fetched.reduce((max, config) => {
                const updatedAt = config.updatedAt ? new Date(config.updatedAt) : null;
                if (!updatedAt) return max;
                return !max || updatedAt > max ? updatedAt : max;
            }, configRefreshCursor);
            if (latest) {
                configRefreshCursor = latest;
            }
        } else if (!configRefreshCursor) {
            configRefreshCursor = new Date();
        }

        activeConfigs = Array.from(configCache.values());
        monitoredTraders = new Set(activeConfigs.map(c => c.traderAddress.toLowerCase()));
        ownedTraders = new Set(Array.from(monitoredTraders).filter(ownsTrader));
        const ownedTradersSignature = Array.from(ownedTraders).sort().join(',');

        const stats = walletManager ? walletManager.getStats() : { total: 1, available: 1 };
        const shardInfo = SHARD_COUNT > 1 ? ` Shard ${SHARD_INDEX_EFFECTIVE + 1}/${SHARD_COUNT} (${ownedTraders.size}/${monitoredTraders.size} traders)` : '';
        const durationMs = Date.now() - startedAt;

        configRefreshStats.lastRunAt = Date.now();
        configRefreshStats.lastDurationMs = durationMs;
        configRefreshStats.lastFetched = fetched.length;
        configRefreshStats.lastMode = fullRefresh ? 'full' : 'incremental';

        console.log(`[Supervisor] Refreshed (${configRefreshStats.lastMode}): ${activeConfigs.length} strategies. Fleet: ${stats.available}/${stats.total} ready.${shardInfo}`);
        console.log(`[Supervisor] Config refresh metrics: fetched=${fetched.length} duration=${durationMs}ms at=${new Date(configRefreshStats.lastRunAt).toISOString()}`);

        // Update Mempool Detector
        if (mempoolDetector) {
            mempoolDetector.updateMonitoredTraders(ownedTraders);
        }

        subscribeToActivityIfNeeded();
        if (isPollingSignalEnabled() && ownedTradersSignature !== ownedTradersCursorSignature) {
            ownedTradersCursorSignature = ownedTradersSignature;
            await syncPollingCursorsForOwnedTraders({ reloadFromStore: true });
        }

    } catch (e) {
        console.error("[Supervisor] Config refresh failed:", e);
    } finally {
        isRefreshingConfigs = false;
        if (pendingFullRefresh) {
            pendingFullRefresh = false;
            await refreshConfigs({ full: true });
        }
    }
}

async function getMarketMetadata(tokenId: string) {
    const meta = await tokenMetadataService.getMetadata(tokenId);
    if (meta) return meta;

    // Fallback for missing simulated markets
    return {
        marketSlug: 'unknown-simulated',
        conditionId: '0x0',
        outcome: 'Yes'
    };
}

function shouldEvaluateMarketGuardrail(): boolean {
    return MARKET_DAILY_CAP_USD > 0 || MARKET_CAPS.size > 0;
}

async function getMarketSlugForGuardrail(tokenId: string): Promise<string | undefined> {
    if (!shouldEvaluateMarketGuardrail()) return undefined;

    const now = Date.now();
    const cached = marketMetaCache.get(tokenId);
    if (cached && now - cached.fetchedAt <= MARKET_META_TTL_MS) {
        const cachedSlug = cached.data.marketSlug;
        if (cachedSlug && !cachedSlug.includes('unknown')) {
            return cachedSlug.toLowerCase();
        }
        return undefined;
    }

    try {
        const meta = await getMarketMetadata(tokenId);
        const normalized = {
            marketSlug: meta.marketSlug || 'unknown-simulated',
            conditionId: meta.conditionId || '0x0',
            outcome: meta.outcome || 'Yes',
        };
        marketMetaCache.set(tokenId, { data: normalized, fetchedAt: now });
        if (normalized.marketSlug && !normalized.marketSlug.includes('unknown')) {
            return normalized.marketSlug.toLowerCase();
        }
    } catch (error) {
        console.warn(`[Supervisor] Failed to resolve market slug for guardrail (${tokenId}):`, error);
    }

    return undefined;
}

async function runWithConcurrency<T>(
    items: T[],
    limit: number,
    handler: (item: T) => Promise<void>
): Promise<void> {
    if (limit <= 1) {
        for (const item of items) {
            await handler(item);
        }
        return;
    }

    const executing = new Set<Promise<void>>();
    for (const item of items) {
        const p = handler(item).catch((err) => {
            console.error('[Supervisor] Fanout error:', err);
        });
        executing.add(p);
        p.finally(() => executing.delete(p));
        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }
    await Promise.all(executing);
}

async function prefetchMarketMetadata(tokenIds: string[]): Promise<void> {
    const unique = Array.from(new Set(tokenIds.filter(Boolean)));
    if (unique.length === 0) return;
    const limit = Math.max(1, Math.min(FANOUT_CONCURRENCY, 10));
    await runWithConcurrency(unique, limit, async (tokenId) => {
        await getMarketMetadata(tokenId);
    });
}

async function handleTransfer(
    operator: string,
    from: string,
    to: string,
    id: ethers.BigNumber,
    value: ethers.BigNumber,
    event: ethers.Event
) {
    try {
        const txHash = event.transactionHash;
        const tokenId = id.toString();
        const amountValues = value.toString();
        const rawShares = parseFloat(amountValues) / 1e6;

        // 1. Identify Trader
        let trader: string | null = null;
        let side: 'BUY' | 'SELL' | null = null;

        if (ownedTraders.has(to.toLowerCase())) {
            trader = to.toLowerCase();
            side = 'BUY';
        } else if (ownedTraders.has(from.toLowerCase())) {
            trader = from.toLowerCase();
            side = 'SELL';
        }

        if (!trader || !side) return;

        if (await isEventDuplicate({ txHash, logIndex: event.logIndex, tokenId, side, source: 'chain' })) {
            return;
        }

        console.log(`[Supervisor] 🚨 SIGNAL DETECTED: Trader ${trader} ${side} Token ${tokenId}`);

        // 2. Find subscribers
        const subscribers = activeConfigs.filter(c => c.traderAddress.toLowerCase() === trader);
        if (subscribers.length === 0) return;

        console.log(`[Supervisor] Dispatching ${subscribers.length} jobs...`);

        // 3. Fetch real market price (cached)
        const price = await getCachedPrice(tokenId, side);

        await runWithConcurrency(subscribers, getDispatchFanoutLimit(), async (sub) => {
            const { tradeShares } = normalizeTradeSizingFromShares(sub, rawShares, price);
            await processJob(sub, side!, tokenId, price, trader!, tradeShares, false, undefined, {
                txHash,
                logIndex: event.logIndex,
            });
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
    if (isMempoolDispatchPaused()) {
        recordRejectReason('MEMPOOL_PAUSED_BY_LOAD_SHEDDING');
        return;
    }

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

    try {
        const tokenId = id.toString();
        const amountValues = value.toString();
        const rawShares = parseFloat(amountValues) / 1e6;

        let trader: string | null = null;
        let side: 'BUY' | 'SELL' | null = null;

        // Sniffed data logic same as Event (SafeTransferFrom)
        if (ownedTraders.has(to.toLowerCase())) {
            trader = to.toLowerCase();
            side = 'BUY';
        } else if (ownedTraders.has(from.toLowerCase())) {
            trader = from.toLowerCase();
            side = 'SELL';
        }

        if (!trader || !side) return;

        if (await isEventDuplicate({ txHash, tokenId, side, source: 'mempool' })) {
            return;
        }

        console.log(`[Supervisor] 🦈 MEMPOOL SNIPING: Trader ${trader} ${side} Token ${tokenId} (Pending Tx: ${txHash})`);

        // Dispatch Jobs immediately
        const subscribers = activeConfigs.filter(c => c.traderAddress.toLowerCase() === trader);

        if (subscribers.length === 0) return;

        const mempoolPrice = await getStrictMempoolPrice(tokenId, side);
        if (!mempoolPrice || mempoolPrice <= 0) {
            await recordGuardrailEvent({
                reason: 'MEMPOOL_PRICE_UNAVAILABLE',
                source: 'supervisor-mempool',
                amount: rawShares,
                tradeId: txHash,
                tokenId,
            });
            console.warn(`[Supervisor] 🛡️ MEMPOOL SKIP (no valid price): token=${tokenId} side=${side} tx=${txHash}`);
            return;
        }

        await runWithConcurrency(subscribers, getDispatchFanoutLimit(), async (config) => {
            const { tradeShares } = normalizeTradeSizingFromShares(config, rawShares, mempoolPrice);
            await processJob(config, side, tokenId, mempoolPrice, trader, tradeShares, true, overrides, {
                txHash,
            });
        });

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
    overrides?: ethers.Overrides,
    signal?: SignalIdentity
) {
    if (isShuttingDown) {
        console.log(`[Supervisor] 🛑 Order Skipped (Shutting Down): ${config.walletAddress} ${side} ${tokenId}`);
        recordRejectReason('SUPERVISOR_SHUTTING_DOWN');
        recordWalletExecution(config.walletAddress, 'skipped');
        return;
    }

    const originalSignalId = buildOriginalSignalId({
        signal,
        tokenId,
        side,
        originalTrader,
        originalSize,
        approxPrice,
    });

    // 0. SELL weak-skip:
    // - cache miss 不直接跳过
    // - DB 二次确认无仓位才跳过
    if (side === 'SELL') {
        const sellDecision = await resolveSellPositionDecision(config.walletAddress, tokenId);
        if (!sellDecision.allow) {
            console.log(`[Supervisor] ⏭️  SKIPPED SELL (no position): ${config.walletAddress.substring(0, 10)}... token ${tokenId.substring(0, 20)}...`);
            recordRejectReason('SELL_NO_POSITION');
            recordWalletExecution(config.walletAddress, 'skipped');
            return;
        }
        if (sellDecision.source === 'db') {
            console.log(`[Supervisor] ♻️ SELL cache miss recovered from DB: ${config.walletAddress.substring(0, 10)}... balance=${(sellDecision.balance || 0).toFixed(4)}`);
        }
    }

    // 1) 先过业务过滤，再分配 worker，减少队列与钱包资源占用。
    const filterResult = await passesFilters(config, tokenId, side, approxPrice);
    if (!filterResult.passes) {
        console.log(`[Supervisor] 🔕 Trade skipped for ${config.walletAddress}: ${filterResult.reason}`);
        recordRejectReason(classifyFilterRejectReason(filterResult.reason || ''));
        recordWalletExecution(config.walletAddress, 'skipped');
        return;
    }

    const copyAmount = calculateCopySize(config, originalSize, approxPrice);
    if (!Number.isFinite(copyAmount) || copyAmount <= 0) {
        console.warn(`[Supervisor] ⚠️ Invalid copy size for ${config.walletAddress}. Skipping.`);
        recordRejectReason('INVALID_COPY_SIZE');
        recordWalletExecution(config.walletAddress, 'skipped');
        return;
    }
    const marketSlug = await getMarketSlugForGuardrail(tokenId);
    const preflightGuardrail = await checkExecutionGuardrails(config.walletAddress, copyAmount, {
        source: isPreflight ? 'supervisor-preflight' : 'supervisor-dispatch',
        marketSlug,
        tradeId: originalSignalId,
        tokenId,
    });
    if (!preflightGuardrail.allowed) {
        console.log(`[Supervisor] 🛡️ Guardrail blocked job for ${config.walletAddress}: ${preflightGuardrail.reason}`);
        recordWalletExecution(config.walletAddress, 'skipped');
        return;
    }

    // 2) 根据 executionMode 选择执行上下文：
    // - EOA: 用户私钥解密后独立执行
    // - PROXY: 从 worker 池借用可用执行钱包
    let worker: WorkerContext | null = null;

    if (config.executionMode === 'EOA') {
        // EOA Mode: Decrypt and Create User-Specific TradingService
        const userService = await userExecManager.getEOAService(config);
        if (!userService) {
            console.warn(`[Supervisor] ❌ EOA service unavailable for ${config.walletAddress}.`);
            recordRejectReason('EOA_SERVICE_UNAVAILABLE');
            recordWalletExecution(config.walletAddress, 'failed');
            return;
        }

        const userWallet = userService.getWallet().connect(provider);
        worker = {
            address: userWallet.address,
            signer: userWallet,
            tradingService: userService
        };
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


    // 3) 无可用 worker 时入队，避免直接丢单（队列满时才 drop）。
    if (!worker) {
        if (config.executionMode === 'EOA') {
            console.error(`[Supervisor] ❌ EOA execution skipped (no worker/service) for ${config.walletAddress}.`);
            recordRejectReason('EOA_WORKER_UNAVAILABLE');
            recordWalletExecution(config.walletAddress, 'failed');
            recordExecution('failed', 0);
            return;
        }
        const queueOverrides = overrides;
        try {
            const queued = await queueStore.enqueue({
                config,
                side,
                tokenId,
                approxPrice,
                originalTrader,
                originalSize,
                originalSignalId,
                isPreflight,
                overrides: queueOverrides,
                enqueuedAt: Date.now()
            });
            if (queued) {
                queueStats.enqueued += 1;
                const depth = await queueStore.size();
                queueStats.maxDepth = Math.max(queueStats.maxDepth, depth);
                console.warn(`[Supervisor] ⏳ All workers busy. Job QUEUED for User ${config.walletAddress}. Queue size: ${depth}`);
            } else {
                queueStats.dropped += 1;
                console.error(`[Supervisor] ❌ Job DROPPED (Queue Full) for User ${config.walletAddress}`);
                recordRejectReason('QUEUE_FULL_DROP');
                recordWalletExecution(config.walletAddress, 'failed');
                recordExecution('failed', 0);
            }
        } catch (error) {
            queueStats.dropped += 1;
            console.error(`[Supervisor] ❌ Queue enqueue failed for ${config.walletAddress}:`, error);
            recordRejectReason('QUEUE_ENQUEUE_FAILED');
            recordWalletExecution(config.walletAddress, 'failed');
            recordExecution('failed', 0);
        }
        return;
    }

    // 4. Construct Effective Worker Context
    const effectiveWorker: WorkerContext = worker;

    // 5. Execute
    await executeJobInternal(effectiveWorker, config, side, tokenId, approxPrice, originalTrader, originalSize, originalSignalId, isPreflight, overrides);
}

async function executeJobInternal(
    worker: WorkerContext,
    config: ActiveConfig,
    side: 'BUY' | 'SELL',
    tokenId: string,
    approxPrice: number,
    originalTrader: string,
    originalSize: number,
    originalSignalId: string,
    isPreflight: boolean,
    overrides?: ethers.Overrides
) {
    const workerAddress = worker.address;
    const typeLabel = isPreflight ? "🦈 MEMPOOL" : "🐢 BLOCK";
    const startTime = Date.now(); // Track latency
    console.log(`[Supervisor] 🏃 [${typeLabel}] Assigning User ${config.walletAddress} -> Worker ${workerAddress}`);

    try {
        const copyAmount = calculateCopySize(config, originalSize, approxPrice);
        if (!Number.isFinite(copyAmount) || copyAmount <= 0) {
            console.warn(`[Supervisor] ⚠️ Invalid copy size for ${config.walletAddress}. Skipping.`);
            const latencyMs = Date.now() - startTime;
            recordRejectReason('INVALID_COPY_SIZE');
            recordExecution('skipped', latencyMs);
            recordWalletExecution(config.walletAddress, 'skipped', latencyMs);
            return;
        }
        const marketSlug = await getMarketSlugForGuardrail(tokenId);
        const executionGuardrail = await checkExecutionGuardrails(config.walletAddress, copyAmount, {
            source: isPreflight ? 'supervisor-execute-preflight' : 'supervisor-execute',
            marketSlug,
            tradeId: originalSignalId,
            tokenId,
        });
        if (!executionGuardrail.allowed) {
            console.log(`[Supervisor] 🛡️ Guardrail blocked execution for ${config.walletAddress}: ${executionGuardrail.reason}`);
            const latencyMs = Date.now() - startTime;
            recordExecution('skipped', latencyMs);
            recordWalletExecution(config.walletAddress, 'skipped', latencyMs);
            return;
        }

        // Map real-time trade signature to the generalized Activity schema expected by Orchestrator
        const mappedTrade = {
            name: originalTrader,
            side: side,
            size: originalSize,
            price: approxPrice,
            asset: tokenId,
            transactionHash: originalSignalId,
            timestamp: Date.now() / 1000,
            type: 'TRADE'
        } as any; // Cast as any because Activity schema expects exact matching

        // Delegate entire complex execution pipeline to Orchestrator
        const executionResult = await tradeOrchestrator.evaluateAndExecuteTrade(
            mappedTrade,
            config,
            config.executionMode === 'EOA' ? worker.tradingService : undefined
        );
        if (executionResult.executed) {
            const resultTokenId = executionResult.tokenId || tokenId;
            const resultSide = String(executionResult.side || side).toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
            const resultShares = Number(executionResult.copyShares || 0);
            if (resultTokenId && resultShares > 0) {
                const balanceDelta = resultSide === 'BUY' ? resultShares : -resultShares;
                updatePositionCache(config.walletAddress, resultTokenId, balanceDelta);
            }
            await incrementGuardrailCounters({
                walletAddress: config.walletAddress,
                amount: executionResult.copySizeUsdc ?? copyAmount,
                marketSlug,
            });
            const latencyMs = Date.now() - startTime;
            recordExecution('success', latencyMs);
            recordWalletExecution(config.walletAddress, 'success', latencyMs);
        } else {
            const latencyMs = Date.now() - startTime;
            recordExecution('skipped', latencyMs);
            recordWalletExecution(config.walletAddress, 'skipped', latencyMs);
            recordRejectReason(executionResult.reason || 'ORCHESTRATOR_SKIPPED');
        }

    } catch (e: any) {
        // Record failed execution
        const latencyMs = Date.now() - startTime;
        recordExecution('failed', latencyMs);
        recordWalletExecution(config.walletAddress, 'failed', latencyMs);
        recordRejectReason('EXECUTION_EXCEPTION');
        console.error(`[Supervisor] 💥 Job Crashed for User ${config.walletAddress}:`, e.message);
    } finally {
        // 5. Checkin Worker AND Trigger Queue
        if (walletManager && worker && config.executionMode !== 'EOA') {
            walletManager.checkinWorker(worker.address);
            // TRIGGER NEXT JOB
            checkQueue();
        }
    }
}


// --- WEB SOCKET HANDLERS ---
async function handleActivityTrade(trade: ActivityTrade) {
    // 0. Deduplicate using shared store
    if (!trade.transactionHash) return;

    try {
        const traderAddress = trade.trader?.address?.toLowerCase();
        if (!traderAddress) return;

        // 1. Identification & Filtering
        if (!ownedTraders.has(traderAddress)) return;

        // trade.side in Activity is "BUY" or "SELL"
        const side = trade.side;
        const tokenId = trade.asset;
        const size = trade.size;
        const price = trade.price;

        if (await isEventDuplicate({ txHash: trade.transactionHash, tokenId, side, source: 'ws' })) return;

        console.log(`[Supervisor] ⚡ WS DETECTED: ${traderAddress} ${side} ${tokenId} ($${price})`);

        // 2. Find subscribers
        const subscribers = activeConfigs.filter(c => c.traderAddress.toLowerCase() === traderAddress);
        if (subscribers.length === 0) return;

        // 3. Execution
        await runWithConcurrency(subscribers, getDispatchFanoutLimit(), async (sub) => {
            try {
                await processJob(sub, side!, tokenId, price, traderAddress!, size, false, undefined, {
                    txHash: trade.transactionHash,
                });
            } catch (execError) {
                console.error(`[Supervisor] WS Execution error for ${sub.walletAddress}:`, execError);
            }
        });

    } catch (e) {
        console.error(`[Supervisor] WS Handle Error:`, e);
    }
}

function startActivityListener() {
    if (!isWsSignalEnabled()) {
        console.log('[Supervisor] 📡 WS signal source disabled by COPY_TRADING_SIGNAL_MODE.');
        return;
    }
    console.log("[Supervisor] 🔌 Connecting Activity WebSocket...");
    realtimeService.connect();
    subscribeToActivityIfNeeded();
    console.log("[Supervisor] 🎧 Listening for WS Trades...");
}

// --- MAIN ---
let mempoolDetector: MempoolDetector;

async function main() {
    console.log("Starting Copy Trading Supervisor (Enterprise)...");

    // --- INITIALIZATION ---
    await initSharedStores();

    if (MASTER_MNEMONIC) {
        walletManager = new WalletManager(
            provider,
            rateLimiter,
            cache,
            MASTER_MNEMONIC,
            WORKER_POOL_SIZE, // Pool Size
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

        // Start background autonomous loop (30 minutes)
        debtManager.startDebtRecoveryLoop(1800000);
    }

    console.log(`[Supervisor] 🧰 Worker pool size: ${WORKER_POOL_SIZE}`);
    await refreshConfigs({ full: true });

    // Pre-warm token metadata cache to prevent event-loop blocking on first WS signal
    await tokenMetadataService.prewarmCache();
    // Keep hydrated mapping every 10m
    setInterval(() => tokenMetadataService.prewarmCache(), 600000);

    // Preload user positions for fast sell-skip checks
    await preloadUserPositions();

    let selftestConfigId: string | null = null;
    if (SELFTEST_ENABLED) {
        let selectedConfig: ActiveConfig | undefined;
        if (SELFTEST_CONFIG_ID) {
            selectedConfig = activeConfigs.find((c) => c.id === SELFTEST_CONFIG_ID);
        } else if (activeConfigs.length > 0) {
            selectedConfig = activeConfigs[0];
        }

        if (!selectedConfig && SELFTEST_CREATE_CONFIG) {
            const masterWallet = masterTradingService.getWallet();
            const walletAddress = (SELFTEST_WALLET || masterWallet?.address || '').toLowerCase();
            const traderAddress = (SELFTEST_TRADER || walletAddress || '').toLowerCase();
            const executionMode = SELFTEST_EXECUTION_MODE || 'EOA';

            if (!walletAddress || !traderAddress) {
                console.warn('[Supervisor] Selftest skipped (missing wallet/trader address).');
            } else if (executionMode === 'EOA' && !MASTER_PRIVATE_KEY) {
                console.warn('[Supervisor] Selftest skipped (EOA requires TRADING_PRIVATE_KEY).');
            } else {
                let encryptedKey: string | null = null;
                let iv: string | null = null;
                if (executionMode === 'EOA' && MASTER_PRIVATE_KEY) {
                    const encrypted = EncryptionService.encrypt(MASTER_PRIVATE_KEY);
                    encryptedKey = encrypted.encryptedData;
                    iv = encrypted.iv;
                }

                const created = await prisma.copyTradingConfig.create({
                    data: {
                        walletAddress,
                        traderAddress,
                        traderName: 'selftest',
                        mode: 'PERCENTAGE',
                        sizeScale: 0.1,
                        fixedAmount: null,
                        maxSizePerTrade: 100,
                        minSizePerTrade: null,
                        infiniteMode: false,
                        takeProfit: null,
                        stopLoss: null,
                        direction: 'COPY',
                        sideFilter: null,
                        minTriggerSize: null,
                        maxDaysOut: null,
                        maxPerMarket: null,
                        minLiquidity: null,
                        minVolume: null,
                        maxOdds: null,
                        sellMode: 'SAME_PERCENT',
                        sellFixedAmount: null,
                        sellPercentage: null,
                        isActive: true,
                        autoExecute: true,
                        channel: 'EVENT_LISTENER',
                        executionMode: executionMode,
                        encryptedKey,
                        iv,
                        apiKey: null,
                        apiSecret: null,
                        apiPassphrase: null,
                    },
                });

                selftestConfigId = created.id;
                await refreshConfigs();
                selectedConfig = activeConfigs.find((c) => c.id === created.id);
            }
        }

        if (selectedConfig) {
            console.log('[Supervisor] 🧪 Running selftest trade...');
            await processJob(
                selectedConfig,
                SELFTEST_SIDE,
                SELFTEST_TOKEN_ID,
                SELFTEST_PRICE,
                (SELFTEST_TRADER || selectedConfig.traderAddress || selectedConfig.walletAddress),
                SELFTEST_SIZE,
                false
            );
        } else {
            console.warn('[Supervisor] Selftest skipped (no active config).');
        }

        if (selftestConfigId && SELFTEST_CLEANUP) {
            await prisma.copyTradingConfig.delete({ where: { id: selftestConfigId } }).catch(() => null);
        }

        if (SELFTEST_EXIT) {
            console.log('[Supervisor] Selftest complete, exiting.');
            process.exit(0);
        }
    }

    // Refresh configs loop
    setInterval(() => {
        void refreshConfigs();
    }, CONFIG_REFRESH_INTERVAL_MS);
    setInterval(() => {
        void refreshConfigs({ full: true });
    }, CONFIG_FULL_REFRESH_INTERVAL_MS);

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
    setInterval(() => {
        void logMetricsSummary();
    }, 300000); // 5 mins

    if (AUTO_LOAD_SHEDDING_ENABLED) {
        console.log(
            `[Supervisor] 🚦 Auto load shedding enabled: depth_warn=${LOAD_SHEDDING_QUEUE_DEPTH_WARN} depth_critical=${LOAD_SHEDDING_QUEUE_DEPTH_CRITICAL} p95_warn=${LOAD_SHEDDING_QUEUE_P95_WARN_MS}ms p95_critical=${LOAD_SHEDDING_QUEUE_P95_CRITICAL_MS}ms fanout=${FANOUT_CONCURRENCY}/${LOAD_SHEDDING_DEGRADED_FANOUT_LIMIT}/${LOAD_SHEDDING_CRITICAL_FANOUT_LIMIT}`
        );
        void evaluateLoadSheddingSnapshot('interval');
        setInterval(() => {
            void evaluateLoadSheddingSnapshot('interval');
        }, LOAD_SHEDDING_EVAL_INTERVAL_MS);
    }

    // SELL reconciliation loop（默认每日运行一次）
    if (SELL_RECONCILIATION_ENABLED) {
        void runSellAccountingReconciliation();
        setInterval(() => {
            void runSellAccountingReconciliation();
        }, SELL_RECONCILIATION_INTERVAL_MS);
    }

    // Queue Drain Loop
    setInterval(() => {
        void checkQueue();
    }, QUEUE_DRAIN_INTERVAL_MS);

    // Start Listeners
    if (isPollingSignalEnabled()) {
        console.log('[Supervisor] 🛰️ Starting polling signal loop...');
        void startPollingLoop();
    }

    if (!isPollingOnlyMode()) {
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
                (
                    txHash: string,
                    operator: string,
                    from: string,
                    to: string,
                    id: ethers.BigNumber,
                    value: ethers.BigNumber,
                    gasInfo?: { maxFeePerGas?: ethers.BigNumber; maxPriorityFeePerGas?: ethers.BigNumber }
                ) => {
                    void handleSniffedTx(txHash, operator, from, to, id, value, gasInfo);
                }
            );
            mempoolDetector.start();
        }
    } else {
        console.log('[Supervisor] 📡 POLLING_ONLY mode: WS/chain/mempool listeners disabled.');
    }

    // Keep alive
    process.on('SIGINT', () => {
        void shutdown('SIGINT');
    });
    process.on('SIGTERM', () => {
        void shutdown('SIGTERM');
    });
}

// Execute Main
main().catch((error) => {
    console.error('[Supervisor] Fatal startup error:', error);
    process.exit(1);
});
