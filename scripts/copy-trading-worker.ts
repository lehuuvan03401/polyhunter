
/**
 * Copy Trading Real-time Worker
 * 
 * This script runs as a persistent process to monitor Polymarket WebSocket events
 * and execute copy trades with minimal latency (<100ms detection).
 * 
 * Usage: 
 *   From poly-hunter root: npx tsx scripts/copy-trading-worker.ts
 *   From frontend: npx tsx ../scripts/copy-trading-worker.ts
 * 
 * Features:
 * - Real-time trade detection via Activity WebSocket
 * - Automatic filtering based on CopyTradingConfig settings
 * - Immediate execution via API or direct TradingService
 * - Graceful shutdown handling
 * 
 * Environment Variables:
 * - COPY_TRADING_API_URL: API base URL (default: http://localhost:3000)
 * - TRADING_PRIVATE_KEY: Private key for server-side execution (optional)
 * - CHAIN_ID: Chain ID for trading (default: 137 for Polygon)
 * - DATABASE_URL: Prisma database URL
 * - ENABLE_REAL_TRADING: Master switch for real execution (default: false)
 * - COPY_TRADING_DAILY_CAP_USD: Global daily cap for real execution (optional)
 * - COPY_TRADING_WALLET_DAILY_CAP_USD: Per-wallet daily cap for real execution (optional)
 * - COPY_TRADING_MARKET_DAILY_CAP_USD: Per-market daily cap for real execution (optional)
 * - COPY_TRADING_MARKET_CAPS: Per-market override caps (slug=cap) (optional)
 * - COPY_TRADING_RPC_URL: RPC URL for copy-trading execution (optional)
 * - COPY_TRADING_WS_FILTER_BY_ADDRESS: Use address-filtered activity subscription when supported (optional)
 * - COPY_TRADING_EXECUTION_ALLOWLIST: Comma-separated wallet allowlist for real execution (optional)
 * - COPY_TRADING_WORKER_ALLOWLIST: Comma-separated worker allowlist for real execution (optional)
 * - COPY_TRADING_MAX_TRADE_USD: Per-trade max notional cap for real execution (optional)
 * - COPY_TRADING_MAX_TRADES_PER_WINDOW: Max trades per time window (optional)
 * - COPY_TRADING_TRADE_WINDOW_MS: Time window for max trades (optional)
 * - COPY_TRADING_EMERGENCY_PAUSE: Emergency pause switch (optional)
 * - COPY_TRADING_DRY_RUN: Dry-run mode (optional)
 * - COPY_TRADING_PRICE_TTL_MS: Max age for price quotes in ms (default: 5000)
 * - COPY_TRADING_IDEMPOTENCY_BUCKET_MS: Time bucket for idempotency fallback (default: 5000)
 * - COPY_TRADING_RPC_URLS: Comma-separated RPC list for failover (optional)
 * - COPY_TRADING_WORKER_KEYS: Comma-separated private keys for worker pool (optional)
 * - COPY_TRADING_WORKER_INDEX: Index into worker pool for this process (optional)
 * - COPY_TRADING_METRICS_INTERVAL_MS: Metrics/alerts interval in ms (default: 300000)
 * - COPY_TRADING_BOT_USDC_WARN: Warn if bot USDC below this threshold
 * - COPY_TRADING_BOT_MATIC_WARN: Warn if bot MATIC below this threshold
 * - COPY_TRADING_PROXY_USDC_WARN: Warn if proxy USDC below this threshold
 * - COPY_TRADING_PROXY_CHECK_LIMIT: Max proxies to check per interval (default: 5)
 * - COPY_TRADING_MAX_RETRY_ATTEMPTS: Max retry attempts for transient failures (default: 2)
 * - COPY_TRADING_RETRY_BACKOFF_MS: Base backoff for retries (default: 60000)
 * - COPY_TRADING_RETRY_INTERVAL_MS: Retry scan interval (default: 60000)
 */

import { RealtimeServiceV2 } from '../src/services/realtime-service-v2.js';
import type { ActivityTrade, MarketEvent, Subscription } from '../src/services/realtime-service-v2.js';
import { TradingService, RateLimiter, createUnifiedCache, CopyTradingExecutionService, GammaApiClient } from '../src/index.js';
import type { DebtLogger } from '../src/services/copy-trading-execution-service.js';
import { ethers } from 'ethers';
import { createHash } from 'crypto';
import { CTF_ABI, CONTRACT_ADDRESSES, USDC_DECIMALS } from '../src/core/contracts.js';
import { normalizeTradeSizing } from '../src/utils/trade-sizing.js';

// Dynamic import for Prisma to handle different runtime contexts
let prisma: any = null;

// ============================================================================
// Configuration
// ============================================================================

const REFRESH_INTERVAL_MS = 60_000; // Refresh active configs every minute
const API_BASE_URL = process.env.COPY_TRADING_API_URL || 'http://localhost:3000';
const TRADING_PRIVATE_KEY = process.env.TRADING_PRIVATE_KEY;
const WORKER_KEYS = (process.env.COPY_TRADING_WORKER_KEYS || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
const WORKER_INDEX = parseInt(process.env.COPY_TRADING_WORKER_INDEX || '0', 10);
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '137');
const PENDING_EXPIRY_MINUTES = 10;
const EXECUTION_RPC_URLS = (process.env.COPY_TRADING_RPC_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
const EXECUTION_RPC_URL = process.env.COPY_TRADING_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://polygon-rpc.com';
const WS_ADDRESS_FILTER = process.env.COPY_TRADING_WS_FILTER_BY_ADDRESS === 'true';
const EXECUTION_ALLOWLIST = (process.env.COPY_TRADING_EXECUTION_ALLOWLIST || '')
    .split(',')
    .map((addr) => addr.trim().toLowerCase())
    .filter(Boolean);
const WORKER_ALLOWLIST = (process.env.COPY_TRADING_WORKER_ALLOWLIST || '')
    .split(',')
    .map((addr) => addr.trim().toLowerCase())
    .filter(Boolean);
const MAX_TRADE_USD = Number(process.env.COPY_TRADING_MAX_TRADE_USD || '0');
const METRICS_INTERVAL_MS = parseInt(process.env.COPY_TRADING_METRICS_INTERVAL_MS || '300000', 10);
const BOT_USDC_WARN = Number(process.env.COPY_TRADING_BOT_USDC_WARN || '0');
const BOT_MATIC_WARN = Number(process.env.COPY_TRADING_BOT_MATIC_WARN || '0');
const PROXY_USDC_WARN = Number(process.env.COPY_TRADING_PROXY_USDC_WARN || '0');
const PROXY_CHECK_LIMIT = parseInt(process.env.COPY_TRADING_PROXY_CHECK_LIMIT || '5', 10);
const MAX_RETRY_ATTEMPTS = parseInt(process.env.COPY_TRADING_MAX_RETRY_ATTEMPTS || '2', 10);
const RETRY_BACKOFF_MS = parseInt(process.env.COPY_TRADING_RETRY_BACKOFF_MS || '60000', 10);
const RETRY_INTERVAL_MS = parseInt(process.env.COPY_TRADING_RETRY_INTERVAL_MS || '60000', 10);
const ENABLE_REAL_TRADING = process.env.ENABLE_REAL_TRADING === 'true';
const EMERGENCY_PAUSE = process.env.COPY_TRADING_EMERGENCY_PAUSE === 'true';
const DRY_RUN = process.env.COPY_TRADING_DRY_RUN === 'true';
const GLOBAL_DAILY_CAP_USD = Number(process.env.COPY_TRADING_DAILY_CAP_USD || '0');
const WALLET_DAILY_CAP_USD = Number(process.env.COPY_TRADING_WALLET_DAILY_CAP_USD || '0');
const MARKET_DAILY_CAP_USD = Number(process.env.COPY_TRADING_MARKET_DAILY_CAP_USD || '0');
const MAX_TRADES_PER_WINDOW = Number(process.env.COPY_TRADING_MAX_TRADES_PER_WINDOW || '0');
const TRADE_WINDOW_MS = Number(process.env.COPY_TRADING_TRADE_WINDOW_MS || '600000');
const PRICE_TTL_MS = parseInt(process.env.COPY_TRADING_PRICE_TTL_MS || '5000', 10);
const IDEMPOTENCY_BUCKET_MS = parseInt(process.env.COPY_TRADING_IDEMPOTENCY_BUCKET_MS || '5000', 10);
const MARKET_CAPS_RAW = process.env.COPY_TRADING_MARKET_CAPS || '';
const DEBT_RECOVERY_INTERVAL_MS = 5 * 60 * 1000;

// EIP-1559 Aggressive Gas Settings for Polygon (To avoid stuck copy trades)
const GAS_SETTINGS = {
    maxPriorityFeePerGas: ethers.utils.parseUnits('40', 'gwei'),
    maxFeePerGas: ethers.utils.parseUnits('600', 'gwei'),
};

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

// ============================================================================
// Initialize Clients
// ============================================================================

const realtimeService = new RealtimeServiceV2({ debug: false });

// Trading service for direct execution (if private key is available)
let tradingService: TradingService | null = null;
let executionService: CopyTradingExecutionService | null = null;
let executionSigner: ethers.Wallet | null = null;
let activeWorkerKey: string | null = null;
let activeWorkerAddress: string | null = null;
const rateLimiter = new RateLimiter();
const cache = createUnifiedCache();
const gammaClient = new GammaApiClient(rateLimiter, cache);
// Rate Limiting & Concurrency classes (Ported from Bot)
class MinuteLimiter {
    private timestamps: number[] = [];
    private maxPerMinute: number;

    constructor(maxPerMinute: number) {
        this.maxPerMinute = maxPerMinute;
    }

    allow(): boolean {
        const now = Date.now();
        const oneMinuteAgo = now - 60_000;
        this.timestamps = this.timestamps.filter((t: number) => t >= oneMinuteAgo);
        if (this.timestamps.length >= this.maxPerMinute) return false;
        this.timestamps.push(now);
        return true;
    }
}

class InflightGate {
    private inflight = 0;
    private maxInflight: number;

    constructor(maxInflight: number) {
        this.maxInflight = maxInflight;
    }

    tryEnter(): boolean {
        if (this.inflight >= this.maxInflight) return false;
        this.inflight++;
        return true;
    }

    exit() {
        this.inflight = Math.max(0, this.inflight - 1);
    }
}

const limiter = new MinuteLimiter(90); // Default to 90 orders/min (CLOB limit)
const gate = new InflightGate(8); // Default to 8 concurrent orders

interface WatchedConfig {
    id: string;
    walletAddress: string;
    traderAddress: string;
    mode: string;
    sizeScale: number | null;
    fixedAmount: number | null;
    maxSizePerTrade: number;
    minSizePerTrade: number | null;
    sideFilter: string | null;
    minTriggerSize: number | null;
    maxOdds: number | null;
    direction: string;
    slippageType: string;
    maxSlippage: number;
    tradeSizeMode?: 'SHARES' | 'NOTIONAL' | null;
}

let activeConfigs: Map<string, WatchedConfig[]> = new Map(); // traderAddress -> configs[]
let watchedAddresses: Set<string> = new Set();
let isRunning = true;
let activitySubscription: Subscription | null = null;
let activityHandlers: { onTrade: (trade: ActivityTrade) => void; onError?: (error: Error) => void } | null = null;
let lastSubscriptionKey = '';
let lastSubscriptionMode: 'filtered' | 'all' | null = null;

class PrismaDebtLogger implements DebtLogger {
    private prisma: any;

    constructor(prismaClient: any) {
        this.prisma = prismaClient;
    }

    async logDebt(debt: {
        proxyAddress: string;
        botAddress: string;
        amount: number;
        currency: string;
        error: string;
    }): Promise<void> {
        if (!this.prisma) return;
        try {
            await this.prisma.debtRecord.create({
                data: {
                    proxyAddress: debt.proxyAddress,
                    botAddress: debt.botAddress,
                    amount: debt.amount,
                    currency: debt.currency,
                    status: 'PENDING',
                    errorLog: debt.error
                }
            });
        } catch (e) {
            console.error('[PrismaDebtLogger] Failed to persist debt record:', e);
        }
    }
}

// Stats
const stats = {
    startTime: Date.now(),
    tradesDetected: 0,
    tradesProcessed: 0,
    tradesCreated: 0,
    tradesExecuted: 0,
    tradesFailed: 0,
    tradesSkipped: 0,
};

const metrics = {
    executions: 0,
    successes: 0,
    failures: 0,
    totalLatencyMs: 0,
    failureReasons: new Map<string, number>(),
};

// ============================================================================
// Config Management
// ============================================================================

async function refreshConfigs(): Promise<void> {
    try {
        console.log('[Worker] Refreshing active copy trading configs...');
        const configs = await prisma.copyTradingConfig.findMany({
            where: { isActive: true },
            select: {
                id: true,
                walletAddress: true,
                traderAddress: true,
                mode: true,
                sizeScale: true,
                fixedAmount: true,
                maxSizePerTrade: true,
                minSizePerTrade: true,
                sideFilter: true,
                minTriggerSize: true,
                maxOdds: true,
                direction: true,
                slippageType: true,
                maxSlippage: true,
                tradeSizeMode: true,
            }
        });

        // Group by trader address
        const newMap = new Map<string, WatchedConfig[]>();
        const newSet = new Set<string>();

        for (const config of configs) {
            const addr = config.traderAddress.toLowerCase();
            if (!newMap.has(addr)) {
                newMap.set(addr, []);
                newSet.add(addr);
            }
            newMap.get(addr)?.push(config as WatchedConfig);
        }

        activeConfigs = newMap;
        watchedAddresses = newSet;

        console.log(`[Worker] Updated: Monitoring ${configs.length} configs for ${newSet.size} traders.`);

        // Refresh WS subscription if we are using address filters
        subscribeToActivityIfNeeded();
    } catch (error) {
        console.error('[Worker] Failed to refresh configs:', error);
    }
}

// ============================================================================
// Copy Size Calculation
// ============================================================================

function calculateCopySize(
    config: WatchedConfig,
    originalSize: number,
    originalPrice: number
): number {
    const originalValue = originalSize * originalPrice;

    if (config.mode === 'FIXED_AMOUNT' && config.fixedAmount) {
        return Math.min(config.fixedAmount, config.maxSizePerTrade);
    }

    // PERCENTAGE mode - scale based on original trade size
    const scaledValue = originalValue * (config.sizeScale || 1);

    // Range mode - clamp between min and max
    const minSize = config.minSizePerTrade ?? 0;
    const clampedValue = Math.max(minSize, Math.min(scaledValue, config.maxSizePerTrade));

    return clampedValue;
}

function getAddressKey(addresses: Set<string>): string {
    return Array.from(addresses)
        .map((addr) => addr.toLowerCase())
        .sort()
        .join(',');
}

function selectWorkerKey(): { privateKey: string; index: number; total: number } | null {
    if (WORKER_KEYS.length > 0) {
        if (Number.isNaN(WORKER_INDEX) || WORKER_INDEX < 0 || WORKER_INDEX >= WORKER_KEYS.length) {
            throw new Error(`COPY_TRADING_WORKER_INDEX out of range (0-${WORKER_KEYS.length - 1})`);
        }
        return { privateKey: WORKER_KEYS[WORKER_INDEX], index: WORKER_INDEX, total: WORKER_KEYS.length };
    }

    if (TRADING_PRIVATE_KEY) {
        return { privateKey: TRADING_PRIVATE_KEY, index: 0, total: 1 };
    }

    return null;
}

async function selectExecutionRpc(timeoutMs: number = 2000): Promise<string> {
    const candidates = EXECUTION_RPC_URLS.length > 0 ? EXECUTION_RPC_URLS : [EXECUTION_RPC_URL];

    for (const url of candidates) {
        try {
            const provider = new ethers.providers.JsonRpcProvider(url);
            await Promise.race([
                provider.getBlockNumber(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), timeoutMs)),
            ]);
            return url;
        } catch (error) {
            console.warn(`[Worker] RPC unhealthy, skipping: ${url}`);
        }
    }

    return EXECUTION_RPC_URL;
}

function subscribeToActivityIfNeeded(): void {
    if (!activityHandlers || !realtimeService) return;

    const canFilter = WS_ADDRESS_FILTER && watchedAddresses.size > 0;
    const nextMode: 'filtered' | 'all' = canFilter ? 'filtered' : 'all';
    const nextKey = canFilter ? getAddressKey(watchedAddresses) : 'all';

    if (activitySubscription && nextMode === lastSubscriptionMode && nextKey === lastSubscriptionKey) {
        return;
    }

    if (activitySubscription) {
        activitySubscription.unsubscribe();
        activitySubscription = null;
    }

    if (canFilter) {
        const addresses = Array.from(watchedAddresses);
        activitySubscription = realtimeService.subscribeActivity(
            { traderAddresses: addresses },
            activityHandlers
        );
        console.log(`[Worker] Activity subscription: filtered (${addresses.length} traders)`);
    } else {
        activitySubscription = realtimeService.subscribeAllActivity(activityHandlers);
        console.log('[Worker] Activity subscription: all-activity');
    }

    lastSubscriptionKey = nextKey;
    lastSubscriptionMode = nextMode;
}

// ========================================================================
// Idempotency + Guardrails
// ========================================================================

function normalizeNumber(value: number, decimals: number = 6): string {
    if (!Number.isFinite(value)) return '0';
    return Number(value).toFixed(decimals);
}

function buildIdempotencyKey(configId: string, trade: ActivityTrade, side: string): string {
    const txHash = trade.transactionHash?.toLowerCase();
    if (txHash) {
        return createHash('sha256')
            .update(`tx:${configId}:${txHash}`)
            .digest('hex');
    }

    const bucket = Math.floor((trade.timestamp * 1000) / IDEMPOTENCY_BUCKET_MS);
    const raw = [
        'fallback',
        configId,
        trade.asset || 'unknown',
        side,
        normalizeNumber(trade.size, 6),
        normalizeNumber(trade.price, 6),
        String(bucket),
    ].join('|');

    return createHash('sha256').update(raw).digest('hex');
}

async function fetchFreshPrice(tokenId: string, side: 'BUY' | 'SELL'): Promise<{ price: number; fetchedAt: number; source: string } | null> {
    if (!tradingService) return null;

    try {
        const fetchedAt = Date.now();
        const orderbook = await tradingService.getOrderBook(tokenId);

        const bestAsk = Number(orderbook.asks?.[0]?.price || 0);
        const bestBid = Number(orderbook.bids?.[0]?.price || 0);

        let price = side === 'BUY' ? bestAsk : bestBid;
        if (!price && bestAsk && bestBid) {
            price = (bestAsk + bestBid) / 2;
        }
        if (!price) price = bestAsk || bestBid;

        if (!price || !Number.isFinite(price)) return null;
        return { price, fetchedAt, source: 'orderbook' };
    } catch (error) {
        console.warn(`[Worker] Failed to fetch orderbook price for ${tokenId}:`, error);
        return null;
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

async function recordGuardrailEvent(params: {
    reason: string;
    source: string;
    walletAddress?: string;
    amount?: number;
    tradeId?: string;
    tokenId?: string;
}) {
    if (!prisma) return;
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
        console.warn('[Guardrail] Failed to persist guardrail event:', error);
    }
}

async function checkExecutionGuardrails(
    walletAddress: string,
    amount: number,
    context: { source?: string; marketSlug?: string; tradeId?: string; tokenId?: string } = {}
): Promise<{ allowed: boolean; reason?: string }> {
    const source = context.source || 'worker';
    const marketSlug = context.marketSlug?.toLowerCase();

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

    if (WORKER_ALLOWLIST.length > 0) {
        const worker = activeWorkerAddress?.toLowerCase();
        if (!worker || !WORKER_ALLOWLIST.includes(worker)) {
            await recordGuardrailEvent({ reason: 'WORKER_ALLOWLIST_BLOCKED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
            return { allowed: false, reason: 'WORKER_ALLOWLIST_BLOCKED' };
        }
    }

    if (MAX_TRADE_USD > 0 && amount > MAX_TRADE_USD) {
        await recordGuardrailEvent({ reason: 'MAX_TRADE_EXCEEDED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
        return { allowed: false, reason: `MAX_TRADE_EXCEEDED (${amount.toFixed(2)} > ${MAX_TRADE_USD})` };
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (GLOBAL_DAILY_CAP_USD > 0) {
        const globalUsed = await getExecutedTotalSince(since);
        if (globalUsed + amount > GLOBAL_DAILY_CAP_USD) {
            await recordGuardrailEvent({ reason: 'GLOBAL_DAILY_CAP_EXCEEDED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
            return {
                allowed: false,
                reason: `GLOBAL_DAILY_CAP_EXCEEDED (${globalUsed.toFixed(2)} + ${amount.toFixed(2)} > ${GLOBAL_DAILY_CAP_USD})`,
            };
        }
    }

    if (WALLET_DAILY_CAP_USD > 0) {
        const walletUsed = await getExecutedTotalSince(since, walletAddress);
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
            const marketUsed = await getExecutedTotalForMarketSince(since, marketSlug);
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
        const tradeCount = await getExecutedCountSince(windowStart);
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

async function preflightExecution(
    walletAddress: string,
    proxyAddress: string | null,
    side: 'BUY' | 'SELL',
    tokenId: string,
    copySize: number,
    price: number
): Promise<{ allowed: boolean; reason?: string; adjustedCopySize: number; adjustedCopyShares: number }> {
    if (!executionService || !executionSigner) {
        return { allowed: true, adjustedCopySize: copySize, adjustedCopyShares: copySize / price };
    }

    if (!proxyAddress) {
        return { allowed: false, reason: 'NO_PROXY', adjustedCopySize: copySize, adjustedCopyShares: copySize / price };
    }

    if (!price || price <= 0) {
        return { allowed: false, reason: 'INVALID_PRICE', adjustedCopySize: copySize, adjustedCopyShares: 0 };
    }

    const allowanceCheck = await executionService.checkProxyAllowance({
        proxyAddress,
        side,
        tokenId,
        amount: copySize,
        signer: executionSigner,
    });
    if (!allowanceCheck.allowed) {
        return {
            allowed: false,
            reason: allowanceCheck.reason || 'ALLOWANCE_MISSING',
            adjustedCopySize: copySize,
            adjustedCopyShares: copySize / price,
        };
    }

    if (side === 'BUY') {
        const [proxyBalance, botBalance] = await Promise.all([
            executionService.getProxyUsdcBalance(proxyAddress, executionSigner).catch(() => 0),
            executionService.getBotUsdcBalance(executionSigner).catch(() => 0),
        ]);

        if (proxyBalance < copySize && botBalance < copySize) {
            return {
                allowed: false,
                reason: `INSUFFICIENT_FUNDS proxy=${proxyBalance.toFixed(2)} bot=${botBalance.toFixed(2)}`,
                adjustedCopySize: copySize,
                adjustedCopyShares: copySize / price,
            };
        }

        if (proxyBalance < copySize && botBalance >= copySize) {
            console.warn(`[Worker] ⚠️ Proxy balance low (${proxyBalance.toFixed(2)}), bot float will be used.`);
        }

        return { allowed: true, adjustedCopySize: copySize, adjustedCopyShares: copySize / price };
    }

    const ctf = new ethers.Contract(CONTRACT_ADDRESSES.ctf, CTF_ABI, executionSigner);
    const balanceRaw = await ctf.balanceOf(proxyAddress, tokenId);
    const actualShares = Number(ethers.utils.formatUnits(balanceRaw, USDC_DECIMALS));

    const requestedShares = copySize / price;
    const adjustedShares = Math.min(requestedShares, actualShares);

    if (adjustedShares <= 0) {
        return { allowed: false, reason: 'NO_SHARES_AVAILABLE', adjustedCopySize: 0, adjustedCopyShares: 0 };
    }

    if (adjustedShares < requestedShares) {
        console.log(`[Worker] ⚠️ Capping sell size: requested ${requestedShares.toFixed(2)}, available ${actualShares.toFixed(2)}`);
    }

    return {
        allowed: true,
        adjustedCopySize: adjustedShares * price,
        adjustedCopyShares: adjustedShares,
    };
}

// ========================================================================
// Position Tracking Helpers
// ========================================================================

async function recordBuyPosition(
    walletAddress: string,
    tokenId: string,
    shares: number,
    price: number,
    totalCost: number
): Promise<void> {
    if (shares <= 0) return;
    const normalizedWallet = walletAddress.toLowerCase();

    await prisma.$executeRaw`
        INSERT INTO "UserPosition" ("id", "walletAddress", "tokenId", "balance", "avgEntryPrice", "totalCost", "createdAt", "updatedAt")
        VALUES (
            gen_random_uuid(),
            ${normalizedWallet},
            ${tokenId},
            ${shares},
            ${price},
            ${totalCost},
            NOW(),
            NOW()
        )
        ON CONFLICT ("walletAddress", "tokenId")
        DO UPDATE SET
            "balance" = "UserPosition"."balance" + ${shares},
            "totalCost" = "UserPosition"."totalCost" + ${totalCost},
            "avgEntryPrice" = ("UserPosition"."totalCost" + ${totalCost}) / ("UserPosition"."balance" + ${shares}),
            "updatedAt" = NOW();
    `;
}

async function recordSellPosition(
    walletAddress: string,
    tokenId: string,
    requestedShares: number,
    price: number
): Promise<{ realizedPnL: number; sharesSold: number; proceeds: number }> {
    if (requestedShares <= 0) {
        return { realizedPnL: 0, sharesSold: 0, proceeds: 0 };
    }

    const normalizedWallet = walletAddress.toLowerCase();

    return prisma.$transaction(async (tx: any) => {
        const position = await tx.userPosition.findUnique({
            where: { walletAddress_tokenId: { walletAddress: normalizedWallet, tokenId } }
        });

        if (!position || position.balance <= 0) {
            return { realizedPnL: 0, sharesSold: 0, proceeds: 0 };
        }

        const sharesSold = Math.min(requestedShares, position.balance);
        const proceeds = sharesSold * price;
        const costBasis = sharesSold * position.avgEntryPrice;
        const realizedPnL = proceeds - costBasis;

        await tx.$executeRaw`
            UPDATE "UserPosition"
            SET 
                "balance" = GREATEST(0, "balance" - ${sharesSold}),
                "totalCost" = GREATEST(0, "balance" - ${sharesSold}) * "avgEntryPrice",
                "updatedAt" = NOW()
            WHERE "walletAddress" = ${normalizedWallet} AND "tokenId" = ${tokenId}
        `;

        return { realizedPnL, sharesSold, proceeds };
    });
}

async function resolveConfigIdForPosition(walletAddress: string, tokenId: string): Promise<string | null> {
    const normalizedWallet = walletAddress.toLowerCase();

    const recentTrade = await prisma.copyTrade.findFirst({
        where: {
            tokenId,
            config: { walletAddress: normalizedWallet }
        },
        orderBy: { detectedAt: 'desc' },
        select: { configId: true }
    });

    if (recentTrade?.configId) return recentTrade.configId;

    const config = await prisma.copyTradingConfig.findFirst({
        where: { walletAddress: normalizedWallet },
        orderBy: { createdAt: 'desc' },
        select: { id: true }
    });

    return config?.id || null;
}

// ============================================================================
// Trade Handler
// ============================================================================

async function handleRealtimeTrade(trade: ActivityTrade): Promise<void> {
    // 1. Quick Gate Check (Fast Fail)
    if (!gate.tryEnter()) return;

    try {
        // Get trader address from the trade
        const traderAddr = trade.trader?.address?.toLowerCase();
        if (!traderAddr) return;

        // Quick check: is this trader being watched?
        if (!watchedAddresses.has(traderAddr)) return;


        stats.tradesDetected++;

        const configs = activeConfigs.get(traderAddr);
        if (!configs || configs.length === 0) return;

        console.log(`\n🎯 [${new Date().toISOString()}] Trade detected from ${traderAddr.slice(0, 10)}...`);
        console.log(`   ${trade.side} ${trade.size} @ ${trade.price} (${trade.marketSlug || trade.conditionId})`);

        // Process each matching config
        for (const config of configs) {
            stats.tradesProcessed++;

            try {
                // ========================================
                // Apply Filters (same logic as detect/route.ts)
                // ========================================

                // Filter 1: Side filter (BUY/SELL only)
                if (config.sideFilter && trade.side !== config.sideFilter) {
                    stats.tradesSkipped++;
                    continue;
                }

                const { tradeShares, tradeNotional } = normalizeTradeSizing(config, trade.size, trade.price);

                // Filter 2: Minimum trigger size ($)
                if (config.minTriggerSize && tradeNotional < config.minTriggerSize) {
                    stats.tradesSkipped++;
                    continue;
                }

                // Filter 3: Max odds (skip trades on highly likely outcomes)
                if (config.maxOdds && trade.price > config.maxOdds) {
                    stats.tradesSkipped++;
                    continue;
                }

                // Filter 4: Direction handling (COPY vs COUNTER)
                let copySide = trade.side;
                if (config.direction === 'COUNTER') {
                    copySide = trade.side === 'BUY' ? 'SELL' : 'BUY';
                }

                // Calculate copy size
                const copySize = calculateCopySize(config, tradeShares, trade.price); // USDC amount

                if (copySize <= 0) {
                    stats.tradesSkipped++;
                    continue;
                }

                // Polymarket minimum is $1
                if (copySize < 1) {
                    stats.tradesSkipped++;
                    continue;
                }

                const idempotencyKey = buildIdempotencyKey(config.id, trade, copySide);

                // OPTIMIZATION: Check DB async (don't block if we can help it, but uniqueness is strict)
                // We'll trust the gate and in-memory checks more for speed, but idempotency prevents dups.
                const existingByKey = await prisma.copyTrade.findUnique({
                    where: { idempotencyKey },
                    select: { id: true },
                });

                if (existingByKey) {
                    console.log(`   [Config ${config.id.slice(0, 8)}] Duplicate (idempotency), skipping.`);
                    continue;
                }

                if (trade.transactionHash) {
                    const existingByTx = await prisma.copyTrade.findUnique({
                        where: { configId_originalTxHash: { configId: config.id, originalTxHash: trade.transactionHash } },
                        select: { id: true },
                    });
                    if (existingByTx) {
                        console.log(`   [Config ${config.id.slice(0, 8)}] Duplicate (txHash), skipping.`);
                        continue;
                    }
                }

                const canAttemptExecution = Boolean(activeWorkerKey && executionService && executionSigner && trade.asset);
                let basePrice = trade.price;
                let priceSource = 'trade';
                let priceGuardError: string | null = null;
                let adjustedCopySize = copySize;
                let adjustedCopyShares = 0;
                let proxyAddress: string | null = null;

                // OPTIMIZATION: Parallelize Preflight Checks
                if (canAttemptExecution && trade.asset) {
                    // 1. Price Check
                    const quotePromise = fetchFreshPrice(trade.asset, copySide as 'BUY' | 'SELL');

                    // 2. Proxy Resolution
                    const proxyPromise = executionService!.resolveProxyAddress(config.walletAddress, executionSigner!).catch(() => null);

                    const [quote, resolvedProxy] = await Promise.all([quotePromise, proxyPromise]);
                    proxyAddress = resolvedProxy;

                    if (!quote) {
                        priceGuardError = 'PRICE_QUOTE_UNAVAILABLE';
                    } else {
                        const priceAgeMs = Date.now() - quote.fetchedAt;
                        if (priceAgeMs > PRICE_TTL_MS) {
                            priceGuardError = 'PRICE_QUOTE_STALE';
                        }
                        basePrice = quote.price;
                        priceSource = quote.source;
                        if (trade.price > 0) {
                            const maxDeviation = (config.maxSlippage ?? 0) / 100;
                            if (maxDeviation > 0) {
                                const deviation = Math.abs(basePrice - trade.price) / trade.price;
                                if (deviation > maxDeviation) {
                                    priceGuardError = `PRICE_DEVIATION_${(deviation * 100).toFixed(2)}%`;
                                }
                            }
                        }
                    }

                    // 3. Preflight logic (sync math + async checks)
                    if (proxyAddress && !priceGuardError) {
                        const preflight = await preflightExecution(
                            config.walletAddress,
                            proxyAddress,
                            copySide as 'BUY' | 'SELL',
                            trade.asset!,
                            copySize,
                            basePrice
                        );

                        if (!preflight.allowed) {
                            // Skip logic handled below
                        } else {
                            adjustedCopySize = preflight.adjustedCopySize;
                            adjustedCopyShares = preflight.adjustedCopyShares;
                        }
                    }
                }

                const fixedSlippage = config.slippageType === 'FIXED' ? (config.maxSlippage / 100) : 0;
                const execPrice = copySide === 'BUY'
                    ? basePrice * (1 + fixedSlippage)
                    : basePrice * (1 - fixedSlippage);
                const copyShares = execPrice > 0 ? (adjustedCopySize / execPrice) : 0;

                if (adjustedCopySize < 1) {
                    stats.tradesSkipped++;
                    continue;
                }

                let guardrailReason: string | undefined;
                let guardrailAllowed = true;
                if (canAttemptExecution && !priceGuardError && proxyAddress) {
                    const guardrail = await checkExecutionGuardrails(config.walletAddress, adjustedCopySize, {
                        marketSlug: trade.marketSlug || undefined,
                        tokenId: trade.asset || undefined,
                    });
                    guardrailAllowed = guardrail.allowed;
                    guardrailReason = guardrail.reason;
                }

                // Prewrite BEFORE execution to avoid orphan orders.
                let executionPromise: Promise<any> | null = null;
                let fastTracked = false;
                let rateLimited = false;
                const shouldExecuteCandidate = Boolean(canAttemptExecution && !priceGuardError && proxyAddress && guardrailAllowed);
                const initialSkipReason = shouldExecuteCandidate
                    ? null
                    : (guardrailReason
                        || priceGuardError
                        || (!ENABLE_REAL_TRADING ? 'REAL_TRADING_DISABLED' : undefined)
                        || (!proxyAddress ? 'NO_PROXY' : undefined)
                        || 'CHECKS_FAILED');

                // ========================================
                // Create PENDING CopyTrade Record (Prewrite)
                // ========================================
                let copyTrade;
                try {
                    copyTrade = await prisma.copyTrade.create({
                        data: {
                            configId: config.id,
                            idempotencyKey,
                            originalTrader: traderAddr,
                            originalSide: copySide,
                            leaderSide: trade.side,
                            originalSize: tradeShares,
                            originalPrice: trade.price,
                            marketSlug: trade.marketSlug || null,
                            conditionId: trade.conditionId || null,
                            tokenId: trade.asset || null,
                            outcome: trade.outcome || null,
                            originalTxHash: trade.transactionHash || null,
                            copySize: adjustedCopySize,
                            copyPrice: execPrice,
                            status: shouldExecuteCandidate ? 'PENDING' : 'SKIPPED',
                            errorMessage: shouldExecuteCandidate ? null : (initialSkipReason || 'Checks failed'),
                            expiresAt: new Date(Date.now() + PENDING_EXPIRY_MINUTES * 60 * 1000),
                        },
                    });
                    stats.tradesCreated++;
                } catch (error: any) {
                    if (error?.code === 'P2002') {
                        console.log(`   [Config ${config.id.slice(0, 8)}] Duplicate (unique constraint) during prewrite.`);
                        stats.tradesSkipped++;
                    } else {
                        console.error(`   ❌ Prewrite failed for config ${config.id}:`, error);
                    }
                    continue;
                }

                if (shouldExecuteCandidate) {
                    if (!limiter.allow()) {
                        console.log(`   ⏳ Rate limit hit, skipping execution.`);
                        rateLimited = true;
                        await prisma.copyTrade.update({
                            where: { id: copyTrade.id },
                            data: { status: 'SKIPPED', errorMessage: 'RATE_LIMIT' },
                        });
                    } else {
                        fastTracked = true;
                        const execStart = Date.now();
                        console.log(`   🚀 [FastTrack] Executing via Service for ${config.walletAddress}...`);

                        executionPromise = executionService!.executeOrderWithProxy({
                            tradeId: copyTrade.id,
                            walletAddress: config.walletAddress,
                            tokenId: trade.asset!,
                            side: copySide as 'BUY' | 'SELL',
                            amount: adjustedCopySize,
                            price: basePrice,
                            overrides: GAS_SETTINGS,
                            proxyAddress: proxyAddress || undefined,
                            slippage: config.slippageType === 'FIXED' ? (config.maxSlippage / 100) : undefined,
                            maxSlippage: config.maxSlippage,
                            slippageMode: config.slippageType as 'FIXED' | 'AUTO',
                            orderType: 'market',
                        }).then(res => ({ ...res, execStart }));
                    }
                }

                // ========================================
                // Handle Execution Result
                // ========================================

                if (fastTracked && executionPromise && copyTrade) {
                    try {
                        const result = await executionPromise;
                        const latency = Date.now() - result.execStart;

                        // Update DB with result
                        if (result.success) {
                            metrics.executions += 1;
                            metrics.successes += 1;
                            metrics.totalLatencyMs += latency;

                            let isSettled = false;
                            if (copySide === 'BUY') {
                                isSettled = Boolean(result.tokenPushTxHash);
                            } else {
                                isSettled = Boolean(result.returnTransferTxHash);
                            }

                            // Settlement / Position Logic (Async - don't block loop)
                            (async () => {
                                try {
                                    if (copySide === 'BUY') {
                                        await recordBuyPosition(config.walletAddress, trade.asset!, adjustedCopyShares, execPrice, adjustedCopySize);
                                    } else {
                                        await recordSellPosition(config.walletAddress, trade.asset!, adjustedCopyShares, execPrice);
                                    }
                                } catch (e) { console.warn('Position update failed', e); }
                            })();

                            await prisma.copyTrade.update({
                                where: { id: copyTrade.id },
                                data: {
                                    status: isSettled ? 'EXECUTED' : 'SETTLEMENT_PENDING',
                                    executedAt: new Date(),
                                    txHash: result.transactionHashes?.[0] || result.orderId,
                                    errorMessage: isSettled ? null : "Settlement Pending",
                                    usedBotFloat: result.usedBotFloat ?? false,
                                    executedBy: activeWorkerAddress ?? undefined
                                },
                            });
                            stats.tradesExecuted++;
                            console.log(`   ✅ [FastTrack] Executed! Order: ${result.orderId} (${latency}ms)`);

                        } else {
                            metrics.executions += 1;
                            metrics.failures += 1;
                            await prisma.copyTrade.update({
                                where: { id: copyTrade.id },
                                data: {
                                    status: 'FAILED',
                                    errorMessage: result.error || 'EXECUTION_FAILED',
                                },
                            });
                            stats.tradesFailed++;
                            console.log(`   ❌ [FastTrack] Failed: ${result.error}`);
                        }

                    } catch (execError: any) {
                        console.error(`   ❌ [FastTrack] Execution exception:`, execError);
                        await prisma.copyTrade.update({
                            where: { id: copyTrade.id },
                            data: { status: 'FAILED', errorMessage: execError.message },
                        });
                    }
                } else if (!fastTracked && copyTrade) {
                    // Log why we didn't execute
                    if (!ENABLE_REAL_TRADING) console.log(`   ⛔ Real trading disabled.`);
                    if (priceGuardError) console.log(`   ⛔ Price guard: ${priceGuardError}`);
                    if (!proxyAddress) console.log(`   ⛔ No proxy found.`);
                    if (rateLimited) console.log(`   ⛔ Rate limit hit.`);
                }

            } catch (error) {
                console.error(`   ❌ Error processing config ${config.id}:`, error);
                stats.tradesFailed++;
            }
        }

    } finally {
        gate.exit();
    }
}

// ============================================================================
// Recovery Handler
// ============================================================================

async function recoverPendingTrades(): Promise<void> {
    if (!executionService) return;

    try {
        const pendingTrades = await prisma.copyTrade.findMany({
            where: { status: 'SETTLEMENT_PENDING' },
            include: { config: true }, // Need wallet address
            take: 10 // Batch size
        });

        if (pendingTrades.length === 0) return;

        console.log(`\n🚑 [Recovery] Found ${pendingTrades.length} pending settlements...`);

        for (const trade of pendingTrades) {
            console.log(`   Processing Trade ${trade.id} (${trade.copySize} ${trade.originalSide})...`);

            // We need to infer 'usedBotFloat'. 
            // Ideally we store this in DB, but for now we can infer or retry safely.
            // Only BUYs use float. If we used float, we need to reimburse.
            // Recovery method handles logic: checks if push needed, checks if reimburse needed.
            // But wait, `recoverSettlement` relies on us passing `usedBotFloat`.
            // Without DB column, we might assume NO (safer for Bot, worse for Proxy if we double charge? No).
            // If we assume NO (standard), we just Push Tokens/USDC. We DONT reimburse.
            // If we assume YES (float), we reimburse.

            // RISK: If we used Float but claim NO, Bot loses money (never reimbursed).
            // FIX: We should add `usedFloat` to CopyTrade model or `metadata`. 
            // FOR NOW: We will assume logic based on `trade.errorMessage`. 
            // Or better, just try standard push (safe for User). Bot eats loss if Float failed.
            // The User asked for "Safety". Primary safety is User funds.

            const isBuy = trade.originalSide === 'BUY'; // Wait, need copySide? Saved in originalSide?
            // originalSide is what Trader did. copySide might be diff (Counter).
            // CopyTrade record doesn't store 'copySide' explicitly except in logs?
            // Ah, schema has `originalSide`. But `handleRealtimeTrade` uses `copySide`.
            // Is `originalSide` in DB actually the executed side?
            // Line 255: `originalSide: copySide`. Yes, it stores the side WE EXECUTED.

            const proxyAddress = await executionService.resolveProxyAddress(trade.config.walletAddress);
            const priceForRecovery = trade.copyPrice || trade.originalPrice;

            if (!proxyAddress || !trade.tokenId || !priceForRecovery || priceForRecovery <= 0) {
                console.warn(`   ⚠️ Recovery skipped due to missing data (proxy/token/price).`);
                continue;
            }

            const result = await executionService.recoverSettlement(
                proxyAddress,
                trade.originalSide as 'BUY' | 'SELL',
                trade.tokenId,
                trade.copySize,
                priceForRecovery, // use executed price when available
                trade.usedBotFloat === true
            );

            if (result.success) {
                console.log(`   ✅ Recovery Successful: ${result.txHash}`);
                await prisma.copyTrade.update({
                    where: { id: trade.id },
                    data: {
                        status: 'EXECUTED',
                        executedAt: new Date(), // Or keep original?
                        txHash: result.txHash, // Update with settlement hash
                        errorMessage: null
                    }
                });
            } else {
                console.error(`   ❌ Recovery Failed: ${result.error}`);
            }
        }

    } catch (e) {
        console.error('[Recovery] Error scanning pending trades:', e);
    }
}

async function expireStalePendingTrades(): Promise<void> {
    if (!prisma) return;
    try {
        const now = new Date();
        const staleTrades = await prisma.copyTrade.findMany({
            where: {
                status: 'PENDING',
                expiresAt: { lt: now },
            },
            take: 25,
        });

        if (staleTrades.length === 0) return;

        console.log(`\n⏳ [Recovery] Expiring ${staleTrades.length} stale PENDING trades...`);

        for (const trade of staleTrades) {
            await prisma.copyTrade.update({
                where: { id: trade.id },
                data: {
                    status: 'FAILED',
                    errorMessage: 'PENDING_EXPIRED',
                },
            });
        }
    } catch (e) {
        console.error('[Recovery] Error expiring stale PENDING trades:', e);
    }
}

async function recoverPendingDebts(): Promise<void> {
    if (!executionService || !executionSigner || !activeWorkerAddress || !prisma) return;

    try {
        const debts = await prisma.debtRecord.findMany({
            where: {
                status: 'PENDING',
                botAddress: activeWorkerAddress,
            },
            take: 10,
        });

        if (debts.length === 0) return;

        console.log(`\n🩺 [Debt] Found ${debts.length} pending debts for ${activeWorkerAddress.slice(0, 8)}...`);

        for (const debt of debts) {
            if (debt.currency && debt.currency !== 'USDC') {
                continue;
            }

            const proxyBalance = await executionService.getProxyUsdcBalance(debt.proxyAddress, executionSigner).catch(() => 0);
            if (proxyBalance < debt.amount) continue;

            const result = await executionService.transferFromProxy(debt.proxyAddress, debt.amount, executionSigner);
            if (result.success) {
                await prisma.debtRecord.update({
                    where: { id: debt.id },
                    data: {
                        status: 'REPAID',
                        repaidAt: new Date(),
                    },
                });
                console.log(`[Debt] ✅ Recovered $${debt.amount} from ${debt.proxyAddress.slice(0, 8)}...`);
            } else {
                await prisma.debtRecord.update({
                    where: { id: debt.id },
                    data: {
                        errorLog: result.error || 'Recovery failed',
                    },
                });
                console.warn(`[Debt] ❌ Recovery failed: ${result.error}`);
            }
        }
    } catch (e) {
        console.error('[Debt] Recovery scan failed:', e);
    }
}

// ============================================================================
// Retry Handler
// ============================================================================

async function retryFailedTrades(): Promise<void> {
    if (!executionService || !executionSigner || !activeWorkerKey) return;

    try {
        const now = new Date();
        const failedTrades = await prisma.copyTrade.findMany({
            where: {
                status: 'FAILED',
                retryCount: { lt: MAX_RETRY_ATTEMPTS },
                OR: [
                    { nextRetryAt: null },
                    { nextRetryAt: { lte: now } },
                ],
            },
            include: { config: true },
            orderBy: { nextRetryAt: 'asc' },
            take: 5,
        });

        if (failedTrades.length === 0) return;

        console.log(`\n🔁 [Retry] Attempting ${failedTrades.length} failed trades...`);

        for (const trade of failedTrades) {
            if (!trade.tokenId) continue;
            const basePrice = trade.copyPrice ?? trade.originalPrice;

            if (!basePrice || basePrice <= 0) {
                await prisma.copyTrade.update({
                    where: { id: trade.id },
                    data: {
                        retryCount: trade.retryCount + 1,
                        nextRetryAt: new Date(Date.now() + RETRY_BACKOFF_MS),
                        errorMessage: 'RETRY_INVALID_PRICE',
                    },
                });
                continue;
            }

            const guardrail = await checkExecutionGuardrails(trade.config.walletAddress, trade.copySize, {
                marketSlug: trade.marketSlug || undefined,
                tokenId: trade.tokenId || undefined,
                tradeId: trade.id,
            });
            if (!guardrail.allowed) {
                await prisma.copyTrade.update({
                    where: { id: trade.id },
                    data: {
                        retryCount: MAX_RETRY_ATTEMPTS,
                        nextRetryAt: null,
                        errorMessage: guardrail.reason || 'GUARDRAIL_BLOCKED',
                    },
                });
                continue;
            }

            const proxyAddress = await executionService.resolveProxyAddress(trade.config.walletAddress, executionSigner);
            const preflight = await preflightExecution(
                trade.config.walletAddress,
                proxyAddress,
                trade.originalSide as 'BUY' | 'SELL',
                trade.tokenId,
                trade.copySize,
                basePrice
            );

            if (!preflight.allowed) {
                await prisma.copyTrade.update({
                    where: { id: trade.id },
                    data: {
                        retryCount: trade.retryCount + 1,
                        nextRetryAt: new Date(Date.now() + RETRY_BACKOFF_MS),
                        errorMessage: `RETRY_PREFLIGHT_${preflight.reason || 'FAILED'}`,
                    },
                });
                continue;
            }

            const execStart = Date.now();
            try {
                const result = await executionService.executeOrderWithProxy({
                    tradeId: trade.id,
                    walletAddress: trade.config.walletAddress,
                    tokenId: trade.tokenId,
                    side: trade.originalSide as 'BUY' | 'SELL',
                    amount: trade.copySize,
                    price: basePrice,
                    proxyAddress: proxyAddress || undefined,
                    slippage: trade.config.slippageType === 'FIXED' ? (trade.config.maxSlippage / 100) : undefined,
                    maxSlippage: trade.config.maxSlippage,
                    slippageMode: trade.config.slippageType as 'FIXED' | 'AUTO',
                    orderType: 'limit',
                });

                if (result.success) {
                    metrics.executions += 1;
                    metrics.successes += 1;
                    metrics.totalLatencyMs += Date.now() - execStart;

                    let isSettled = false;
                    if (trade.originalSide === 'BUY') {
                        isSettled = Boolean(result.tokenPushTxHash);
                    } else {
                        isSettled = Boolean(result.returnTransferTxHash);
                    }

                    const newStatus = isSettled ? 'EXECUTED' : 'SETTLEMENT_PENDING';

                    let realizedPnL: number | null = null;
                    let finalCopySize = trade.copySize;

                    try {
                        if (trade.originalSide === 'BUY') {
                            const shares = trade.copySize / basePrice;
                            await recordBuyPosition(trade.config.walletAddress, trade.tokenId, shares, basePrice, trade.copySize);
                        } else {
                            const shares = trade.copySize / basePrice;
                            const sellResult = await recordSellPosition(trade.config.walletAddress, trade.tokenId, shares, basePrice);
                            realizedPnL = sellResult.realizedPnL;
                            if (sellResult.proceeds > 0 && sellResult.proceeds < finalCopySize) {
                                finalCopySize = sellResult.proceeds;
                            }
                        }
                    } catch (positionErr) {
                        console.warn(`   ⚠️ Retry position update failed for ${trade.config.walletAddress}:`, positionErr);
                    }

                    await prisma.copyTrade.update({
                        where: { id: trade.id },
                        data: {
                            status: newStatus,
                            executedAt: new Date(),
                            txHash: result.transactionHashes?.[0] || result.orderId,
                            errorMessage: isSettled ? null : "Settlement Pending: Funds/Tokens not returned",
                            realizedPnL: realizedPnL ?? undefined,
                            copySize: finalCopySize,
                            copyPrice: basePrice,
                            usedBotFloat: result.usedBotFloat ?? false,
                            executedBy: activeWorkerAddress ?? undefined,
                            nextRetryAt: null,
                        },
                    });
                    stats.tradesExecuted++;
                    console.log(`   ✅ Retry executed ${trade.id}`);
                } else {
                    metrics.executions += 1;
                    metrics.failures += 1;
                    metrics.totalLatencyMs += Date.now() - execStart;
                    recordFailureReason(result.error || 'RETRY_FAILED');

                    const failureMessage = result.error || 'RETRY_FAILED';
                    const shouldRetry = isTransientError(failureMessage) && MAX_RETRY_ATTEMPTS > 0;
                    const nextRetryCount = shouldRetry ? trade.retryCount + 1 : trade.retryCount;
                    const retryAllowed = shouldRetry && nextRetryCount <= MAX_RETRY_ATTEMPTS;

                    await prisma.copyTrade.update({
                        where: { id: trade.id },
                        data: {
                            status: 'FAILED',
                            errorMessage: failureMessage,
                            retryCount: nextRetryCount,
                            nextRetryAt: retryAllowed ? new Date(Date.now() + RETRY_BACKOFF_MS * Math.pow(2, Math.max(0, nextRetryCount - 1))) : null,
                        },
                    });
                    stats.tradesFailed++;
                    console.log(`   ❌ Retry failed: ${failureMessage}`);
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                metrics.executions += 1;
                metrics.failures += 1;
                metrics.totalLatencyMs += Date.now() - execStart;
                recordFailureReason(errorMsg);

                const shouldRetry = isTransientError(errorMsg) && MAX_RETRY_ATTEMPTS > 0;
                const nextRetryCount = shouldRetry ? trade.retryCount + 1 : trade.retryCount;
                const retryAllowed = shouldRetry && nextRetryCount <= MAX_RETRY_ATTEMPTS;

                await prisma.copyTrade.update({
                    where: { id: trade.id },
                    data: {
                        status: 'FAILED',
                        errorMessage: errorMsg,
                        retryCount: nextRetryCount,
                        nextRetryAt: retryAllowed ? new Date(Date.now() + RETRY_BACKOFF_MS * Math.pow(2, Math.max(0, nextRetryCount - 1))) : null,
                    },
                });
                stats.tradesFailed++;
                console.log(`   ❌ Retry error: ${errorMsg}`);
            }
        }
    } catch (error) {
        console.error('[Retry] Failed to process retry queue:', error);
    }
}

// ============================================================================
// Settlement Handler
// ============================================================================

const SETTLEMENT_CACHE = new Set<string>(); // Prevent repeated WS processing
const SETTLEMENT_IN_FLIGHT = new Set<string>();

async function handleMarketResolution(event: MarketEvent): Promise<void> {
    // Only care about resolution
    if (event.type !== 'resolved') return;

    const conditionId = event.conditionId;
    if (SETTLEMENT_CACHE.has(conditionId) || SETTLEMENT_IN_FLIGHT.has(conditionId)) return;
    SETTLEMENT_IN_FLIGHT.add(conditionId);

    console.log(`\n⚖️ [Settlement] Market Resolved: ${conditionId}`);

    // Data usually contains the winning outcome index or ID.
    // For YES/NO markets, we usually get an index or a price vector.
    // Let's inspect the data slightly or generalize.
    // If we assume binary markets for now (Polymarket standard).
    console.log('   Resolution Data:', JSON.stringify(event.data));

    try {
        const success = await resolvePositions(conditionId);
        if (success) {
            SETTLEMENT_CACHE.add(conditionId);
        }
    } catch (error) {
        console.error(`   ❌ Failed to settle positions for ${conditionId}:`, error);
    } finally {
        SETTLEMENT_IN_FLIGHT.delete(conditionId);
    }
}

async function resolvePositions(conditionId: string): Promise<boolean> {
    console.log(`\n🔍 Resolving positions for condition ${conditionId}...`);

    try {
        // 1. Fetch Market Details from Gamma (source of truth for results)
        // We wait a few seconds to ensure Gamma API has updated (if the event came from Clob)
        await new Promise(resolve => setTimeout(resolve, 3000));

        const market = await gammaClient.getMarketByConditionId(conditionId);

        if (!market) {
            console.warn(`   ⚠️ Market not found in Gamma API: ${conditionId}`);
            return false;
        }

        if (!market.closed) {
            console.log(`   ℹ️ Market is not marked as CLOSED yet in Gamma. Waiting...`);
            // It might be resolved but not 'closed' in Gamma struct?
            // Let's trust outcomePrices if one is 1.0 (or close to it)
        }

        console.log(`   Market: ${market.question}`);
        console.log(`   Outcomes: ${market.outcomes.join(', ')}`);
        console.log(`   Prices: ${market.outcomePrices.join(', ')}`);

        // 2. Map Outcomes to Token IDs (prefer Gamma tokens, fallback to DB)
        const outcomeToTokenMap = new Map<string, string>();
        const tokenInfoById = new Map<string, any>();

        if (Array.isArray((market as any).tokens)) {
            (market as any).tokens.forEach((t: any) => {
                const tokenId = t.tokenId || t.token_id;
                if (!tokenId) return;
                tokenInfoById.set(tokenId, t);
                if (t.outcome) {
                    outcomeToTokenMap.set(t.outcome, tokenId);
                }
            });
        }

        if (outcomeToTokenMap.size === 0) {
            const relevantTrades = await prisma.copyTrade.findMany({
                where: { conditionId: conditionId },
                select: { tokenId: true, outcome: true },
                distinct: ['tokenId']
            });

            relevantTrades.forEach((t: any) => {
                if (t.outcome && t.tokenId) {
                    outcomeToTokenMap.set(t.outcome, t.tokenId);
                }
            });
        }

        // 3. Process each outcome
        let settledCount = 0;
        let hadFailure = false;

        for (let i = 0; i < market.outcomes.length; i++) {
            const outcomeName = market.outcomes[i];
            const price = market.outcomePrices[i];
            const tokenId = outcomeToTokenMap.get(outcomeName);

            if (!tokenId) continue;

            const tokenInfo = tokenInfoById.get(tokenId);
            const isWinner = tokenInfo?.winner;

            let settlementType: 'WIN' | 'LOSS' | 'NONE' = 'NONE';
            let settlementValue = 0.0;

            if (isWinner === true || price >= 0.95) {
                settlementType = 'WIN';
                settlementValue = 1.0;
            } else if ((isWinner === false && market.closed) || (price <= 0.05 && market.closed)) {
                settlementType = 'LOSS';
                settlementValue = 0.0;
            } else {
                continue;
            }

            const positions = await prisma.userPosition.findMany({
                where: { tokenId: tokenId, balance: { gt: 0 } }
            });

            if (positions.length === 0) continue;

            console.log(`   Processing ${positions.length} positions for '${outcomeName}' (Token: ${tokenId.slice(0, 10)}...). Type: ${settlementType}`);

            for (const pos of positions) {
                const proceeds = pos.balance * settlementValue;
                const pnl = proceeds - pos.totalCost;

                const configId = await resolveConfigIdForPosition(pos.walletAddress, tokenId);
                if (!configId) {
                    console.warn(`     ⚠️ No config found for ${pos.walletAddress}. Skipping settlement record.`);
                    continue;
                }

                let status: 'EXECUTED' | 'FAILED' = 'EXECUTED';
                let txHash = settlementType === 'WIN' ? 'redeem-pending' : 'settled-loss';
                let errorMsg: string | null = null;

                if (settlementType === 'WIN') {
                    if (!executionService) {
                        status = 'FAILED';
                        errorMsg = 'No execution service available for redemption';
                    } else {
                        const proxyAddress = await executionService.resolveProxyAddress(pos.walletAddress);
                        if (!proxyAddress) {
                            status = 'FAILED';
                            errorMsg = 'No proxy found for wallet';
                        } else {
                            const indexSet = [1 << i];
                            const result = await executionService.redeemPositions(
                                proxyAddress,
                                conditionId,
                                indexSet
                            );

                            if (result.success) {
                                txHash = result.txHash || 'redeem-tx';
                            } else {
                                status = 'FAILED';
                                errorMsg = result.error || 'Redemption failed';
                            }
                        }
                    }
                }

                const settlementData = {
                    configId: configId,
                    originalTrader: 'POLYMARKET_SETTLEMENT',
                    originalSide: 'SELL',
                    originalSize: pos.balance,
                    originalPrice: settlementValue,
                    marketSlug: market.slug,
                    conditionId: conditionId,
                    tokenId: tokenId,
                    outcome: outcomeName,
                    copySize: proceeds,
                    copyPrice: settlementValue,
                    status: status,
                    executedAt: new Date(),
                    txHash: txHash,
                    realizedPnL: status === 'EXECUTED' ? pnl : undefined,
                    errorMessage: errorMsg || (settlementType === 'WIN' ? `Redeemed (PnL $${pnl.toFixed(2)})` : `Settled Loss ($${pnl.toFixed(2)})`)
                };

                const existingSettlement = await prisma.copyTrade.findFirst({
                    where: {
                        configId: configId,
                        tokenId: tokenId,
                        conditionId: conditionId,
                        originalTrader: 'POLYMARKET_SETTLEMENT',
                        originalSide: 'SELL'
                    },
                    orderBy: { executedAt: 'desc' }
                });

                if (existingSettlement?.status === 'FAILED') {
                    await prisma.copyTrade.update({
                        where: { id: existingSettlement.id },
                        data: settlementData
                    });
                } else if (!existingSettlement) {
                    await prisma.copyTrade.create({ data: settlementData });
                }

                if (status === 'EXECUTED' || settlementType === 'LOSS') {
                    await prisma.userPosition.delete({
                        where: { id: pos.id }
                    });
                } else {
                    hadFailure = true;
                    console.warn(`     ⚠️ Redemption failed, keeping position for retry.`);
                }

                console.log(`     ✅ Settled position for ${pos.walletAddress.slice(0, 8)}: ${pos.balance} shares @ $${settlementValue}`);
                settledCount++;
            }
        }

        if (settledCount > 0) {
            console.log(`   ✅ Successfully settled ${settledCount} positions.`);
        } else {
            console.log(`   ℹ️ No active positions found to settle.`);
        }

        return !hadFailure;
    } catch (error) {
        console.error(`   ❌ Error in resolvePositions:`, error);
        return false;
    }
}

async function reconcileResolvedPositions(): Promise<void> {
    if (!prisma) return;

    try {
        const positions = await prisma.userPosition.findMany({
            where: { balance: { gt: 0 } },
            select: { tokenId: true }
        });

        if (positions.length === 0) return;

        const tokenIds = Array.from(new Set(positions.map(p => p.tokenId).filter(Boolean)));
        if (tokenIds.length === 0) return;

        const trades = await prisma.copyTrade.findMany({
            where: {
                tokenId: { in: tokenIds },
                conditionId: { not: null }
            },
            select: { tokenId: true, conditionId: true, detectedAt: true },
            orderBy: { detectedAt: 'desc' }
        });

        const tokenToCondition = new Map<string, string>();
        for (const trade of trades) {
            if (trade.tokenId && trade.conditionId && !tokenToCondition.has(trade.tokenId)) {
                tokenToCondition.set(trade.tokenId, trade.conditionId);
            }
        }

        const conditionIds = Array.from(new Set(tokenToCondition.values()));
        if (conditionIds.length === 0) return;

        console.log(`\n🔁 [Reconcile] Checking ${conditionIds.length} conditions for settlement...`);

        for (const conditionId of conditionIds) {
            if (SETTLEMENT_IN_FLIGHT.has(conditionId)) continue;
            SETTLEMENT_IN_FLIGHT.add(conditionId);
            try {
                await resolvePositions(conditionId);
            } finally {
                SETTLEMENT_IN_FLIGHT.delete(conditionId);
            }
        }
    } catch (error) {
        console.error('[Reconcile] Failed to reconcile settled positions:', error);
    }
}


// ============================================================================
// Stats Display
// ============================================================================

function displayStats(): void {
    const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    console.log('\n📊 Worker Stats:');
    console.log(`   Uptime: ${hours}h ${minutes}m ${seconds}s`);
    console.log(`   Watching: ${watchedAddresses.size} traders, ${Array.from(activeConfigs.values()).flat().length} configs`);
    console.log(`   Trades Detected: ${stats.tradesDetected}`);
    console.log(`   Trades Processed: ${stats.tradesProcessed}`);
    console.log(`   Trades Created: ${stats.tradesCreated}`);
    console.log(`   Trades Executed: ${stats.tradesExecuted}`);
    console.log(`   Trades Failed: ${stats.tradesFailed}`);
    console.log(`   Trades Skipped: ${stats.tradesSkipped}`);
}

function recordFailureReason(reason: string | null | undefined): void {
    if (!reason) return;
    const key = reason.slice(0, 120);
    metrics.failureReasons.set(key, (metrics.failureReasons.get(key) || 0) + 1);
}

function isTransientError(message: string): boolean {
    const lowered = message.toLowerCase();
    return (
        lowered.includes('timeout') ||
        lowered.includes('timed out') ||
        lowered.includes('rate limit') ||
        lowered.includes('429') ||
        lowered.includes('rpc') ||
        lowered.includes('network') ||
        lowered.includes('nonce too low') ||
        lowered.includes('replacement fee too low') ||
        lowered.includes('econnreset') ||
        lowered.includes('etimedout')
    );
}

function logMetricsSummary(): void {
    if (metrics.executions === 0) {
        console.log('\n📈 Metrics: No executions in the last interval.');
        return;
    }

    const successRate = metrics.executions > 0 ? (metrics.successes / metrics.executions) * 100 : 0;
    const avgLatency = metrics.executions > 0 ? metrics.totalLatencyMs / metrics.executions : 0;

    console.log('\n📈 Metrics Summary:');
    console.log(`   Executions: ${metrics.executions}`);
    console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`   Avg Latency: ${avgLatency.toFixed(0)}ms`);

    if (metrics.failureReasons.size > 0) {
        const topReasons = Array.from(metrics.failureReasons.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        console.log('   Top Failures:');
        for (const [reason, count] of topReasons) {
            console.log(`     - ${reason}: ${count}`);
        }
    }

    metrics.executions = 0;
    metrics.successes = 0;
    metrics.failures = 0;
    metrics.totalLatencyMs = 0;
    metrics.failureReasons.clear();
}

async function checkBalanceAlerts(): Promise<void> {
    if (!executionService || !executionSigner) return;

    try {
        if (BOT_USDC_WARN > 0) {
            const botUsdc = await executionService.getBotUsdcBalance(executionSigner);
            if (botUsdc < BOT_USDC_WARN) {
                console.warn(`[Alerts] ⚠️ Bot USDC low: $${botUsdc.toFixed(2)} < ${BOT_USDC_WARN}`);
            }
        }

        if (BOT_MATIC_WARN > 0 && executionSigner.provider) {
            const balance = await executionSigner.provider.getBalance(await executionSigner.getAddress());
            const matic = Number(ethers.utils.formatEther(balance));
            if (matic < BOT_MATIC_WARN) {
                console.warn(`[Alerts] ⚠️ Bot MATIC low: ${matic.toFixed(4)} < ${BOT_MATIC_WARN}`);
            }
        }

        if (PROXY_USDC_WARN > 0 && activeConfigs.size > 0) {
            const wallets = Array.from(activeConfigs.values())
                .flat()
                .map((config) => config.walletAddress.toLowerCase());
            const uniqueWallets = Array.from(new Set(wallets)).slice(0, PROXY_CHECK_LIMIT);

            for (const wallet of uniqueWallets) {
                const proxy = await executionService.resolveProxyAddress(wallet, executionSigner);
                if (!proxy) continue;
                const proxyUsdc = await executionService.getProxyUsdcBalance(proxy, executionSigner);
                if (proxyUsdc < PROXY_USDC_WARN) {
                    console.warn(`[Alerts] ⚠️ Proxy USDC low for ${wallet.slice(0, 8)}: $${proxyUsdc.toFixed(2)} < ${PROXY_USDC_WARN}`);
                }
            }
        }
    } catch (error) {
        console.warn('[Alerts] Balance check failed:', error);
    }
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

async function shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down worker...');
    isRunning = false;

    displayStats();

    realtimeService.disconnect();
    await prisma.$disconnect();

    console.log('✅ Shutdown complete.');
    process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ============================================================================
// Main Entry Point
// ============================================================================

async function start(): Promise<void> {
    console.log('🚀 Starting Copy Trading Worker...');
    console.log(`   API Base URL: ${API_BASE_URL}`);
    const workerSelection = selectWorkerKey();
    console.log(`   Trading Key: ${workerSelection ? 'Configured ✅' : 'Not configured ⚠️'}`);
    if (workerSelection && workerSelection.total > 1) {
        console.log(`   Worker Pool: ${workerSelection.index + 1}/${workerSelection.total}`);
    }
    console.log(`   Real Trading: ${ENABLE_REAL_TRADING ? 'Enabled ✅' : 'Disabled ⛔'}`);
    console.log(`   Chain ID: ${CHAIN_ID}`);
    const selectedRpc = await selectExecutionRpc();
    console.log(`   Execution RPC: ${selectedRpc}`);

    // Initialize Prisma dynamically
    try {
        const prismaModule = await import('@prisma/client');
        prisma = new prismaModule.PrismaClient();
        console.log('   Prisma: Connected ✅');
    } catch (error) {
        console.error('   ❌ Failed to initialize Prisma. Make sure DATABASE_URL is set.');
        console.error('   Run from frontend directory or set DATABASE_URL environment variable.');
        process.exit(1);
    }

    // Initialize TradingService if private key is available
    if (workerSelection) {
        try {
            const rateLimiter = new RateLimiter();
            const cache = createUnifiedCache();
            tradingService = new TradingService(rateLimiter, cache, {
                privateKey: workerSelection.privateKey,
                chainId: CHAIN_ID,
            });
            await tradingService.initialize();

            // Initialize Execution Service
            const provider = new ethers.providers.JsonRpcProvider(selectedRpc);
            const signer = new ethers.Wallet(workerSelection.privateKey, provider);
            executionSigner = signer;
            const debtLogger = new PrismaDebtLogger(prisma);
            executionService = new CopyTradingExecutionService(tradingService, signer, CHAIN_ID, debtLogger);
            activeWorkerKey = workerSelection.privateKey;
            activeWorkerAddress = await signer.getAddress();

            console.log(`   Trading Wallet: ${tradingService.getAddress()}`);
            console.log(`   Execution Worker: ${activeWorkerAddress}`);
            console.log(`   Execution Service: Ready ✅`);

            await recoverPendingDebts();
        } catch (error) {
            console.error('   ⚠️ Failed to initialize TradingService:', error);
            tradingService = null;
            executionService = null;
            activeWorkerKey = null;
            activeWorkerAddress = null;
        }
    }

    // Initial config load
    await refreshConfigs();

    // Set up periodic config refresh
    setInterval(async () => {
        if (isRunning) {
            await refreshConfigs();
        }
    }, REFRESH_INTERVAL_MS);

    // Set up periodic stats + metrics + alerts
    setInterval(() => {
        if (!isRunning) return;
        displayStats();
        logMetricsSummary();
        void checkBalanceAlerts();
    }, METRICS_INTERVAL_MS);

    // Set up periodic RECOVERY task
    setInterval(async () => {
        if (!isRunning) return;
        await expireStalePendingTrades();
        if (executionService) {
            await recoverPendingTrades();
        }
    }, 2 * 60 * 1000); // Every 2 minutes

    // Set up periodic RETRY task
    setInterval(async () => {
        if (isRunning && executionService) {
            await retryFailedTrades();
        }
    }, RETRY_INTERVAL_MS);

    // Set up periodic debt recovery task
    setInterval(async () => {
        if (!isRunning) return;
        await recoverPendingDebts();
    }, DEBT_RECOVERY_INTERVAL_MS);

    // Periodic settlement reconciliation (in case WS missed or redemption failed)
    setInterval(async () => {
        if (isRunning) {
            await reconcileResolvedPositions();
        }
    }, 5 * 60 * 1000); // Every 5 minutes

    // Connect to WebSocket and subscribe to ALL activity
    console.log('\n📡 Connecting to Polymarket WebSocket...');
    realtimeService.connect();

    // OPTIMIZATION: Crash-only mode. If WS drops, exit so supervisor restarts.
    realtimeService.on('disconnected', () => {
        console.error('❌ WebSocket disconnected. Exiting for restart...');
        process.exit(1);
    });

    realtimeService.on('error', (err: any) => {
        console.error('❌ WebSocket error. Exiting for restart...', err);
        process.exit(1);
    });

    // Wait for connection
    await new Promise<void>((resolve) => {
        realtimeService.once('connected', () => {
            console.log('✅ WebSocket connected!');
            resolve();
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            console.log('⚠️ WebSocket connection timeout, continuing anyway...');
            resolve();
        }, 10000);
    });

    // Subscribe to Market Events (Resolution)
    console.log('📡 Subscribing to market lifecycle events...');
    realtimeService.subscribeMarketEvents({
        onMarketEvent: async (event: MarketEvent) => {
            try {
                await handleMarketResolution(event);
            } catch (error) {
                console.error('Error in market event handler:', error);
            }
        }
    });

    // Subscribe to trading activity
    console.log('📡 Subscribing to trading activity...');
    activityHandlers = {
        onTrade: async (trade: ActivityTrade) => {
            try {
                await handleRealtimeTrade(trade);
            } catch (error) {
                console.error('Error in trade handler:', error);
            }
        },
        onError: (error: Error) => {
            console.error('Activity subscription error:', error);
        },
    };

    subscribeToActivityIfNeeded();

    if (activitySubscription) {
        console.log(`✅ Subscribed to activity (ID: ${activitySubscription.id})`);
    }
    console.log('\n🟢 Worker is running. Press Ctrl+C to exit.\n');
}

// Start the worker
start().catch((error) => {
    console.error('Fatal error starting worker:', error);
    process.exit(1);
});
