/**
 * Budget-Constrained Live Copy Trading
 * 
 * Real-time tracking of a target trader with:
 * - Budget cap (default 3000 USDC) to limit total investment
 * - Proportional scaling to fit trades within budget
 * - Database recording of all copy trades
 * - Position tracking and cost basis calculation
 * - Simulated settlement (using market prices)
 * - P&L analysis report
 * 
 * Usage:
 * export $(grep -v '^#' .env | xargs)
 * MODE=1 npx tsx scripts/workers/live-copy-trading.ts
 * 
 * cd /Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/web
 * npx tsx scripts/db/wipe-copy-trading-data.ts
pkill -9 -f "tsx.*live-copy" 2>/dev/null
CHAIN_ID=137 MODE=1 nohup npx tsx scripts/workers/live-copy-trading.ts > sim.log 2>&1 &
tail -f sim.log

COPY_MODE=1 \
CHAIN_ID=137 \
LIVE_EXECUTION_MODE=EOA \
LIVE_SELL_MODE=SAME_PERCENT \
RESET_ON_START=false \
nohup npx tsx scripts/workers/live-copy-trading.ts > sim.log 2>&1 &
如果你要走代理钱包模式，把 LIVE_EXECUTION_MODE=PROXY，并确保该用户已创建 Proxy 且执行权限已配置。
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { PrismaClient, CopyTradeStatus } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { ethers } from 'ethers';
import { RealtimeServiceV2 } from '../../../sdk/src/services/realtime-service-v2.js';
import type { ActivityTrade, MarketEvent } from '../../../sdk/src/services/realtime-service-v2.js';
import { GammaApiClient } from '../../../sdk/src/index';
import { DataApiClient } from '../../../sdk/src/clients/data-api';
import { MarketService } from '../../../sdk/src/services/market-service';
import { TokenMetadataService } from '../../../sdk/src/services/token-metadata-service';
import { RateLimiter } from '../../../sdk/src/core/rate-limiter';
import { createUnifiedCache } from '../../../sdk/src/core/unified-cache';
import { getStrategyConfig, StrategyProfile } from '../../../sdk/src/config/strategy-profiles';
import { normalizeTradeSizing } from '../../../sdk/src/utils/trade-sizing.js';
import { PositionTracker } from '../../../sdk/src/core/tracking/position-tracker.js';
import { CtfEventListener } from '../../../sdk/src/services/ctf-event-listener.js';
import { TradeOrchestrator } from '../../../sdk/src/core/trade-orchestrator.js';
import { TradingService } from '../../../sdk/src/services/trading-service.js';
import { CopyTradingExecutionService } from '../../../sdk/src/services/copy-trading-execution-service.js';
import { CONTRACT_ADDRESSES, CTF_ABI } from '../../../sdk/src/core/contracts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Prefer .env.local + .env.local.secrets, fallback to .env
dotenv.config({ path: path.join(__dirname, '../..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '../..', '.env.local.secrets') });
dotenv.config({ path: path.join(__dirname, '../..', '.env') });

// --- CONFIG ---
const TARGET_TRADER = process.env.TARGET_TRADER || '0x63ce342161250d705dc0b16df89036c8e5f9ba9a';
const FOLLOWER_WALLET = process.env.FOLLOWER_WALLET || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const SIMULATION_DURATION_MS = 240 * 60 * 1000; // 4 hours
const BUY_WINDOW_MS = SIMULATION_DURATION_MS; // No separate window limit (buy for full duration)
const FIXED_COPY_AMOUNT = parseFloat(process.env.FIXED_COPY_AMOUNT || '10'); // Default $10 per trade
const SIMULATED_PROFILE = StrategyProfile.CONSERVATIVE; // Test CONSERVATIVE profile
const strategy = getStrategyConfig(SIMULATED_PROFILE);
// strategy.maxSlippage is decimal (e.g. 0.005 for 0.5%).
// Script used BPS (50 for 0.5%).
// 0.005 * 10000 = 50 BPS.
const SLIPPAGE_BPS = strategy.maxSlippage * 10000;
const ESTIMATED_GAS_FEE_USD = 0.05; // $0.05 per transaction (Polygon gas + overhead)
const COPY_MODE = (process.env.SIM_COPY_MODE || 'BUDGET_CONSTRAINED').toUpperCase();
// Default to TRADER_ONLY for live copy trading
const SIM_ACTIVITY_FILTER = (process.env.SIM_ACTIVITY_FILTER || 'TRADER_ONLY').toUpperCase();
const SIM_WS_SERVER_FILTER = (process.env.SIM_WS_SERVER_FILTER || 'false').toLowerCase() === 'true';
// COPY_MODE/MODE = 1 -> live execution path, 0 -> simulation path.
const MODE_FLAG = process.env.COPY_MODE ?? process.env.MODE ?? '1';
const IS_LIVE_MODE = MODE_FLAG === '1';
const RESET_ON_START = (process.env.RESET_ON_START || (IS_LIVE_MODE ? 'false' : 'true')).toLowerCase() === 'true';
const LIVE_SELL_MODE = (process.env.LIVE_SELL_MODE || process.env.SELL_MODE || (IS_LIVE_MODE ? 'SAME_PERCENT' : 'NO_SELL')).toUpperCase();
const LIVE_EXECUTION_MODE = (process.env.LIVE_EXECUTION_MODE || (IS_LIVE_MODE ? 'EOA' : 'PROXY')).toUpperCase() === 'PROXY'
    ? 'PROXY'
    : 'EOA';
const TX_PREFIX = IS_LIVE_MODE ? 'LIVE-' : 'SIM-';

// --- BUDGET CONSTRAINTS ---
// Maximum total investment cap (USDC)
const MAX_BUDGET = parseFloat(process.env.MAX_BUDGET || '3000');
// Estimated leader's total trading volume (for scaling calculation)
const ESTIMATED_LEADER_VOLUME = parseFloat(process.env.EST_LEADER_VOLUME || '100000');
// Scale factor: How much of leader's trade to copy (auto-calculated if BUDGET_CONSTRAINED)
const SCALE_FACTOR = MAX_BUDGET / ESTIMATED_LEADER_VOLUME; // e.g., 3000/100000 = 0.03 (3%)
// Maximum trade size per single trade
const MAX_TRADE_SIZE = parseFloat(process.env.MAX_TRADE_SIZE || '100'); // $100 max per trade

const GAMMA_API_URL = 'https://gamma-api.polymarket.com';
const CLOB_API_URL = 'https://clob.polymarket.com';
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || process.env.POLYGON_RPC_URL || 'http://127.0.0.1:8545';
const CLOB_API_KEY = process.env.POLY_API_KEY || process.env.CLOB_API_KEY;
const CLOB_API_SECRET = process.env.POLY_API_SECRET || process.env.CLOB_API_SECRET;
const CLOB_API_PASSPHRASE = process.env.POLY_API_PASSPHRASE || process.env.CLOB_API_PASSPHRASE;
const clobCredentials = CLOB_API_KEY && CLOB_API_SECRET && CLOB_API_PASSPHRASE
    ? { key: CLOB_API_KEY, secret: CLOB_API_SECRET, passphrase: CLOB_API_PASSPHRASE }
    : undefined;

// --- MARKET-AWARE LATENCY THRESHOLDS ---
// Max tolerable detection delay before skipping a trade (simulates FOK rejection when price has moved)
const LATENCY_THRESHOLDS: Array<{ pattern: RegExp; maxMs: number; label: string }> = [
    { pattern: /btc-updown-5m/, maxMs: 2_000, label: '5m' },
    { pattern: /btc-updown-15m/, maxMs: 5_000, label: '15m' },
    { pattern: /btc-updown-1h/, maxMs: 15_000, label: '1h' },
    { pattern: /.*/, maxMs: 30_000, label: 'other' }, // Events/news markets
];

// --- MARKET-TYPE SIZE CAPS ---
// Shorter markets resolve faster → smaller stake, less risk if signal is stale
const MARKET_SIZE_CAPS: Array<{ pattern: RegExp; maxUsdc: number }> = [
    { pattern: /btc-updown-5m/, maxUsdc: 10 },
    { pattern: /btc-updown-15m/, maxUsdc: 30 },
    { pattern: /btc-updown-1h/, maxUsdc: 50 },
    { pattern: /.*/, maxUsdc: MAX_TRADE_SIZE }, // Default for all other markets
];

function getMarketMaxSize(slug: string): number {
    for (const rule of MARKET_SIZE_CAPS) {
        if (rule.pattern.test(slug)) return rule.maxUsdc;
    }
    return MAX_TRADE_SIZE;
}

function getLatencyThreshold(slug: string): { maxMs: number; label: string } {
    for (const rule of LATENCY_THRESHOLDS) {
        if (rule.pattern.test(slug)) return { maxMs: rule.maxMs, label: rule.label };
    }
    return { maxMs: 30_000, label: 'other' };
}

// No validation needed - using local dev.db

console.log('═══════════════════════════════════════════════════════════════');
console.log('💰 BUDGET-CONSTRAINED COPY TRADING');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`Target Trader: ${TARGET_TRADER}`);
console.log(`Follower Wallet: ${FOLLOWER_WALLET}`);
console.log(`Duration: ${(SIMULATION_DURATION_MS / 1000 / 60).toFixed(0)} minutes`);
console.log(`💵 MAX BUDGET: $${MAX_BUDGET.toLocaleString()} USDC`);
console.log(`📉 Scale Factor: ${(SCALE_FACTOR * 100).toFixed(2)}% of leader trades`);
console.log(`📊 Max Trade Size: $${MAX_TRADE_SIZE} per trade`);
console.log(`Strategy Profile: ${SIMULATED_PROFILE} (Slippage: ${strategy.maxSlippage * 100}%)`);
console.log(`Copy Mode: ${COPY_MODE}`);
console.log(`Order Mode: ${IS_LIVE_MODE ? '🟢 Live' : '🟡 Simulation'}`);
console.log(`Execution Mode: ${LIVE_EXECUTION_MODE}`);
console.log(`Sell Mode: ${LIVE_SELL_MODE}`);
console.log(`Reset On Start: ${RESET_ON_START}`);
console.log('═══════════════════════════════════════════════════════════════\n');

// --- PRISMA ---
console.log('DEBUG: DATABASE_URL loaded:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: [] });

// --- SERVICES ---
const rateLimiter = new RateLimiter();
const cache = createUnifiedCache();
const gammaClient = new GammaApiClient(rateLimiter, cache);
const dataApi = new DataApiClient(rateLimiter, cache);
const chainId = parseInt(process.env.CHAIN_ID || "31337");
const marketService = new MarketService(gammaClient, dataApi, rateLimiter, cache, { chainId });
const tokenMetadataService = new TokenMetadataService(marketService, cache);

// Shared TradingService for both simulation and live EOA execution.
const fallbackTradingService = new TradingService(rateLimiter, cache, {
    privateKey: process.env.TRADING_PRIVATE_KEY!,
    chainId: chainId,
    credentials: clobCredentials
});
const executionSigner = process.env.TRADING_PRIVATE_KEY
    ? new ethers.Wallet(process.env.TRADING_PRIVATE_KEY, new ethers.providers.JsonRpcProvider(RPC_URL))
    : null;
const executionService = executionSigner
    ? new CopyTradingExecutionService(fallbackTradingService, executionSigner, chainId)
    : null;

// Relaxed speed profile for copy trading: skip spread + depth checks.
// - Spread: leader already did price discovery for us
// - Depth: simulation uses a synthetic orderbook (depth = copySizeUsdc×10×leaderPrice)
//   which is meaningless for guardrail purposes. Real depth is captured by getSimulationPrice().
const COPY_TRADING_SPEED_PROFILE = {
    name: 'CopyTrading',
    maxSpreadBps: 0,     // Disabled: see above
    depthLevels: 3,
    minDepthUsd: 0,      // Disabled: synthetic book depth is not meaningful
    minDepthRatio: 0,    // Disabled: same reason
};

const tradeOrchestrator = new TradeOrchestrator(
    executionService as any,
    tokenMetadataService,
    fallbackTradingService,
    prisma,
    COPY_TRADING_SPEED_PROFILE,
    false,
    !IS_LIVE_MODE
);

// --- TRACKING STATE ---
// --- TRACKING STATE ---
const tracker = new PositionTracker();
const positionMetadata = new Map<string, { marketSlug: string; outcome: string; conditionId?: string }>();
let configId: string;
let activeConfig: Awaited<ReturnType<typeof seedConfig>> | null = null;

// --- METRICS ---
let tradesRecorded = 0;
let totalBuyVolume = 0;
let totalSellVolume = 0;
let realizedPnL = 0;
let totalFeesPaid = 0; // Accumulated Polymarket taker fees
let budgetUsed = 0; // Track how much of budget has been used
let tradesSkippedBudget = 0; // Track trades skipped due to budget

// --- SIGNAL STATS ---
const signalStats = {
    total: 0,
    ctf: 0,          // Detected by CTF on-chain listener
    ws: 0,           // Detected by WebSocket activity feed
    stale: 0,        // Skipped: detection latency exceeded threshold
    noMeta: 0,       // Skipped: no token metadata
    duplicate: 0,    // Skipped: duplicate tx hash (race condition)
    executed: 0,     // Successfully executed
    failed: 0,       // Execution failed (non-FOK)
    fokRejected: 0,  // Simulated FOK rejection (insufficient depth)
    latencySum: 0,   // Sum of all detection latencies (ms) for avg calculation
    latencyCount: 0, // Count of valid latency readings
};

const startTime = Date.now();
const seenTrades = new Set<string>();

// --- RETRY FETCH HELPER ---
async function fetchWithRetry(
    url: string,
    options: RequestInit = {},
    maxRetries = 5,
    baseDelayMs = 1000
): Promise<Response> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeout);
            return response;
        } catch (error: any) {
            lastError = error;

            // Check if it's a retryable error
            const isRetryable =
                error.code === 'ECONNRESET' ||
                error.code === 'ETIMEDOUT' ||
                error.code === 'ENOTFOUND' ||
                error.cause?.code === 'ECONNRESET' ||
                error.message?.includes('fetch failed') ||
                error.name === 'AbortError';

            if (!isRetryable || attempt === maxRetries - 1) {
                throw error;
            }

            // Exponential backoff with jitter
            const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

const ORDERS_LOG_PATH = process.env.ORDERS_LOG_PATH || './logs/orders.ndjson';

// --- HELPERS ---
function ensureDir(filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function appendNdjson(filePath: string, obj: unknown) {
    ensureDir(filePath);
    const line = JSON.stringify(obj) + "\n";
    fs.promises.appendFile(filePath, line).catch((err) => console.error('Log Error:', err));
}

// --- SEED CONFIG ---
async function seedConfig() {
    console.log('📝 Setting up copy trading config...');

    const targetLower = TARGET_TRADER.toLowerCase();
    const followerLower = FOLLOWER_WALLET.toLowerCase();

    if (RESET_ON_START) {
        // Delete existing config for clean slate
        await prisma.copyTradingConfig.deleteMany({
            where: {
                walletAddress: followerLower,
                traderAddress: targetLower,
            }
        });

        // Delete previous copy trades
        await prisma.copyTrade.deleteMany({
            where: {
                config: {
                    walletAddress: followerLower,
                    traderAddress: targetLower,
                }
            }
        });

        // Delete previous positions
        await prisma.userPosition.deleteMany({
            where: {
                walletAddress: followerLower,
            }
        });
    }

    const baseConfigData = {
        traderName: IS_LIVE_MODE ? '0x8dxd (Live)' : '0x8dxd (Simulation)',
        maxSlippage: 2.0,
        slippageType: 'AUTO',
        autoExecute: false, // Script drives execution directly.
        channel: 'EVENT_LISTENER',
        mode: 'PERCENTAGE',
        sizeScale: SCALE_FACTOR,
        fixedAmount: FIXED_COPY_AMOUNT,
        maxSizePerTrade: MAX_TRADE_SIZE,
        sellMode: LIVE_SELL_MODE,
        executionMode: LIVE_EXECUTION_MODE,
        isActive: true,
    } as const;

    let config = null;
    if (!RESET_ON_START) {
        const existing = await prisma.copyTradingConfig.findFirst({
            where: { walletAddress: followerLower, traderAddress: targetLower },
            orderBy: { createdAt: 'desc' },
        });
        if (existing) {
            config = await prisma.copyTradingConfig.update({
                where: { id: existing.id },
                data: baseConfigData,
            });
        }
    }
    if (!config) {
        config = await prisma.copyTradingConfig.create({
            data: {
                walletAddress: followerLower,
                traderAddress: targetLower,
                ...baseConfigData
            }
        });
    }

    configId = config.id;
    activeConfig = config;
    console.log(`✅ Created config: ${configId}\n`);
    return config;
}

// --- POSITION MANAGEMENT ---
// --- POSITION MANAGEMENT ---
function updatePositionOnBuy(tokenId: string, shares: number, price: number, marketSlug: string, outcome: string, conditionId?: string) {
    tracker.onBuy(tokenId, shares, price);
    if (!positionMetadata.has(tokenId)) {
        positionMetadata.set(tokenId, { marketSlug, outcome, conditionId });
    }
}

function updatePositionOnSell(tokenId: string, shares: number, price: number): number {
    return tracker.onSell(tokenId, shares, price);
}

// Obsolete functions (fetchMarketFromClob, enrichTradeMetadata, recordCopyTrade) removed because TradeOrchestrator handles metadata and DB recording natively.

// --- TRADE HANDLER ---
async function handleTrade(trade: ActivityTrade, source: 'CTF' | 'WS' = 'WS') {
    const traderAddress = trade.trader?.address?.toLowerCase();
    const targetLower = TARGET_TRADER.toLowerCase();

    if (traderAddress !== targetLower) return;

    signalStats.total++;
    if (source === 'CTF') signalStats.ctf++; else signalStats.ws++;

    // // Filter for 15m Options only (as requested by User)
    // if (!trade.marketSlug?.includes('-15m-')) {
    //     // console.log(`[DEBUG] ⏭️  Skipped (Not 15m): ${trade.marketSlug}`);
    //     return;
    // }

    // Safety Filter: Exclude outdated/political keywords to ensure realism
    const lowerSlug = (trade.marketSlug || '').toLowerCase();
    // if (lowerSlug.includes('biden') || lowerSlug.includes('trump') || lowerSlug.includes('election') || lowerSlug.includes('coronavirus')) {
    //     console.log(`[DEBUG] ⏭️  Skipped Outdated/Political: ${trade.marketSlug}`);
    //     return;
    // }

    // Check for weird slugs (Optional debugging)
    // console.log(`[DEBUG] 🔎 Detected trade for target: ${trade.marketSlug} | Side: ${trade.side}`);

    // --- FIX: ENRICH METADATA EARLY ---
    // CtfEventListener (On-Chain) trades have no metadata initially. We must fetch it now.
    if (!trade.conditionId && !trade.marketSlug) {
        // console.log(`[DEBUG] 🔍 Enriching metadata for token ${trade.asset}...`);
        const enriched = await tokenMetadataService.getMetadata(trade.asset);
        if (enriched?.conditionId) trade.conditionId = enriched.conditionId;
        if (enriched?.marketSlug) trade.marketSlug = enriched.marketSlug;
        if (enriched?.outcome) trade.outcome = enriched.outcome;
    }

    // Skip trades without conditionId (can't get metadata)
    if (!trade.conditionId && !trade.marketSlug) {
        signalStats.noMeta++;
        console.log(`\n⏭️  SKIPPED (no metadata): tokenId ${trade.asset.slice(0, 20)}...`);
        return;
    }

    // --- LATENCY FILTER ---
    // Skip signals that are too stale for the given market type (simulates FOK rejection)
    const detectionLatencyMs = trade.timestamp
        ? Math.max(0, Date.now() - (trade.timestamp > 1e10 ? trade.timestamp : trade.timestamp * 1000))
        : 0;
    if (detectionLatencyMs > 0) {
        signalStats.latencySum += detectionLatencyMs;
        signalStats.latencyCount++;
    }
    const slug = trade.marketSlug || '';
    const latencyThreshold = getLatencyThreshold(slug);
    if (detectionLatencyMs > latencyThreshold.maxMs) {
        signalStats.stale++;
        // Only log 1 in 10 stale skips to avoid spam
        if (signalStats.stale % 10 === 1) {
            const latStr = detectionLatencyMs >= 1000 ? `${(detectionLatencyMs / 1000).toFixed(1)}s` : `${detectionLatencyMs}ms`;
            console.log(`⏭️  STALE_SIGNAL (${latStr} > ${latencyThreshold.maxMs / 1000}s limit for ${latencyThreshold.label}): ${slug.substring(0, 40)}`);
        }
        return;
    }

    const dedupeKey = trade.transactionHash ? `${configId}:${trade.transactionHash}` : null;
    if (dedupeKey && seenTrades.has(dedupeKey)) {
        return;
    }
    if (dedupeKey) {
        const existing = await prisma.copyTrade.findUnique({
            where: {
                configId_originalTxHash: {
                    configId,
                    originalTxHash: trade.transactionHash!,
                }
            }
        });
        if (existing) {
            seenTrades.add(dedupeKey);
            return;
        }
    }

    const now = new Date();
    const elapsedMs = Date.now() - startTime;
    const elapsed = (elapsedMs / 1000).toFixed(0);

    // Stop buying after window closes
    if (trade.side === 'BUY' && elapsedMs > BUY_WINDOW_MS) {
        console.log(`\n🛑 Buy window closed (${(elapsedMs / 60000).toFixed(1)}m elapsed). Skipping BUY for ${trade.marketSlug}...`);
        return;
    }

    if (!activeConfig) {
        console.warn('⚠️  Active config missing, skipping trade.');
        return;
    }

    // Optional NO_SELL mode: hold to expiry and ignore leader exits.
    if (trade.side === 'SELL' && (activeConfig.sellMode || LIVE_SELL_MODE) === 'NO_SELL') {
        signalStats.duplicate++; // Count as deduped/ignored, not failed
        return;
    }

    // --- BUDGET-CONSTRAINED SIZING CAPPED BY MARKET TYPE ---
    const marketMaxSize = getMarketMaxSize(slug);
    let configForExecution = { ...activeConfig };
    if (COPY_MODE === 'BUDGET_CONSTRAINED' || COPY_MODE === 'PERCENTAGE') {
        if (trade.side === 'BUY') {
            const remainingBudget = MAX_BUDGET - budgetUsed;
            if (remainingBudget <= 0) {
                console.log(`\n💸 BUDGET EXHAUSTED! Used: $${budgetUsed.toFixed(2)}/$${MAX_BUDGET}. Skipping BUY...`);
                tradesSkippedBudget++;
                return;
            }
            // Apply the tighter of: remaining budget, market type cap, global cap
            configForExecution.maxSizePerTrade = Math.min(marketMaxSize, remainingBudget);
        } else {
            configForExecution.maxSizePerTrade = MAX_TRADE_SIZE;
        }
    }

    // Delegate to TradeOrchestrator (Simulation Mode)
    // Orchestrator handles Guardrails, Sizing, DB Writing, Slippage.
    const result = await tradeOrchestrator.evaluateAndExecuteTrade(trade as any, configForExecution, fallbackTradingService);

    if (!result.executed) {
        if (result.reason === 'DUPLICATE_TX_HASH') {
            signalStats.duplicate++;
        } else if (result.reason === 'SIM_FOK_REJECTED') {
            signalStats.fokRejected++;
            console.log(`\n❌ FOK REJECTED: ${trade.marketSlug || trade.asset.substring(0, 20)}...`);
        } else {
            signalStats.failed++;
            console.log(`\n⏭️  SKIPPED (${result.reason}): ${trade.marketSlug || trade.asset.substring(0, 20)}...`);
        }
        return;
    }

    const { copyShares, copySizeUsdc: copyAmount, execPrice, leaderPrice: resultLeaderPrice, slippageBps, latencyMs, feePaid, side: execSide, tokenId, txHash } = result;
    if (!copyShares || !copyAmount || !execPrice || !execSide || !tokenId) return;

    if (dedupeKey) seenTrades.add(dedupeKey);
    tradesRecorded++;
    signalStats.executed++;

    // Track simulated metrics
    let tradePnL: number | undefined = undefined;
    let positionLine: string | null = null;
    let pnlLine: string | null = null;
    let remainingLine: string | null = null;

    if (execSide === 'BUY') {
        // Use actual cost per share (copyAmount / copyShares) instead of VWAP execPrice.
        // This ensures tracker.costUSDC exactly equals the USDC amount spent,
        // preventing inflated loss calculations during settlement.
        const trueAvgCost = copyShares > 0 ? copyAmount / copyShares : execPrice;
        updatePositionOnBuy(tokenId, copyShares, trueAvgCost, trade.marketSlug || '', trade.outcome || '', trade.conditionId || undefined);
        totalBuyVolume += copyAmount;
        budgetUsed += copyAmount; // Track budget usage
        const pos = tracker.metrics(tokenId);
        positionLine = `   💼 Position: ${pos.shares.toFixed(2)} shares @ avg $${pos.avgPrice.toFixed(4)}`;
    } else {
        tradePnL = updatePositionOnSell(tokenId, copyShares, execPrice);
        realizedPnL += tradePnL;
        totalSellVolume += copyAmount;
        const pos = tracker.metrics(tokenId);
        const remaining = pos ? pos.shares.toFixed(2) : '0';
        pnlLine = `   💰 Gross P&L: $${tradePnL >= 0 ? '+' : ''}${tradePnL.toFixed(4)}`;
        remainingLine = `   💼 Remaining: ${remaining} shares`;
    }

    // Accumulate fees for session summary
    if (feePaid && feePaid > 0) {
        totalFeesPaid += feePaid;
    }

    // Optional: High-Frequency Logging (NDJSON)
    appendNdjson(ORDERS_LOG_PATH, {
        t: Date.now(),
        status: 'EXECUTED',
        side: execSide,
        tokenID: tokenId,
        shares: trade.size, // Leader size
        copyShares: copyShares,
        price: trade.price,
        execPrice: execPrice,
        notionalUSDC: trade.size * trade.price,
        copyUSDC: copyAmount,
        marketSlug: trade.marketSlug,
        outcome: trade.outcome,
        tx: txHash,
        pnl: tradePnL
    });

    const budgetRemaining = MAX_BUDGET - budgetUsed;
    const budgetPercent = ((budgetUsed / MAX_BUDGET) * 100).toFixed(1);

    console.log('\\n🎯 ═══════════════════════════════════════════════════════════');
    const sourceLabel = source === 'CTF' ? '[CTF⛓️]' : '[WS📡]';
    console.log(`   [${elapsed}s] COPY TRADE EXECUTED (#${tradesRecorded}) ${sourceLabel}`);
    console.log('   ───────────────────────────────────────────────────────────');
    console.log(`   ⏰ ${now.toISOString()}`);
    console.log(`   📊 Leader: ${trade.size.toFixed(2)} shares ($${(trade.size * trade.price).toFixed(2)})`);
    console.log(`   📊 Copy:   ${execSide} ${copyShares.toFixed(2)} shares ($${copyAmount.toFixed(2)}) | Cap: $${marketMaxSize}`);
    // Price line: show real slippage vs leader if available
    const slippageStr = (slippageBps !== undefined && slippageBps !== null)
        ? ` | Slippage: ${slippageBps >= 0 ? '+' : ''}${slippageBps} bps`
        : '';
    const leaderPx = resultLeaderPrice ?? trade.price;
    console.log(`      Price: $${leaderPx.toFixed(4)} → Exec: $${execPrice.toFixed(4)}${slippageStr}`);
    if (latencyMs && latencyMs > 0) {
        const latStr = latencyMs >= 1000 ? `${(latencyMs / 1000).toFixed(1)}s` : `${latencyMs}ms`;
        console.log(`      ⏱  Detection latency: ${latStr}`);
    }
    if (feePaid && feePaid > 0) {
        console.log(`      💸 Taker fee: $${feePaid.toFixed(4)}`);
    }
    console.log(`   💵 Budget: $${budgetUsed.toFixed(2)}/$${MAX_BUDGET} used (${budgetPercent}%) | Remaining: $${budgetRemaining.toFixed(2)}`);
    console.log(`   📈 Market: ${trade.marketSlug || 'N/A'}`);
    console.log(`   🎯 Outcome: ${trade.outcome || 'N/A'}`);
    console.log(`   🔗 TX: ${txHash?.substring(0, 30)}...`);
    if (positionLine) console.log(positionLine);
    if (pnlLine) console.log(pnlLine);
    if (remainingLine) console.log(remainingLine);
    console.log('   ═══════════════════════════════════════════════════════════\\n');
}

// --- SETTLEMENT HANDLER ---

const SETTLEMENT_CACHE = new Set<string>();
const SETTLED_TOKENS = new Set<string>();
const SETTLEMENT_IN_FLIGHT = new Set<string>();
const SETTLEMENT_QUEUE: string[] = [];
let isProcessingSettlement = false;

function startSettlement(tokenId: string): boolean {
    if (SETTLED_TOKENS.has(tokenId) || SETTLEMENT_IN_FLIGHT.has(tokenId)) return false;
    SETTLEMENT_IN_FLIGHT.add(tokenId);
    return true;
}

function finishSettlement(tokenId: string, success: boolean): void {
    SETTLEMENT_IN_FLIGHT.delete(tokenId);
    if (success) {
        SETTLED_TOKENS.add(tokenId);
    }
}

function handleMarketResolution(event: MarketEvent): void {
    if (event.type !== 'resolved') return;
    if (IS_LIVE_MODE) return;

    const conditionId = event.conditionId;
    if (SETTLEMENT_CACHE.has(conditionId)) return;
    SETTLEMENT_CACHE.add(conditionId);

    console.log(`\n⚖️ [Settlement] Market Resolved: ${conditionId}. Queueing for async settlement.`);
    SETTLEMENT_QUEUE.push(conditionId);
}

async function processSettlementQueue() {
    if (IS_LIVE_MODE) return;
    if (isProcessingSettlement || SETTLEMENT_QUEUE.length === 0) return;
    isProcessingSettlement = true;

    try {
        const conditionId = SETTLEMENT_QUEUE.shift();
        if (conditionId) {
            await resolveSimulatedPositions(conditionId);
        }
    } catch (error) {
        console.error(`   ❌ Failed to settle positions:`, error);
    } finally {
        isProcessingSettlement = false;
    }
}

// Start background settlement processor
setInterval(processSettlementQueue, 5000);

async function resolveSimulatedPositions(conditionId: string): Promise<void> {
    console.log(`\n🔍 Resolving positions for condition ${conditionId}...`);

    try {
        // Wait a bit for Gamma API to update
        await new Promise(resolve => setTimeout(resolve, 3000));
        const market = await gammaClient.getMarketByConditionId(conditionId);

        if (!market) {
            console.warn(`   ⚠️ Market not found in Gamma API: ${conditionId}`);
            return;
        }

        console.log(`   Market: ${market.question}`);
        console.log(`   Outcomes: ${market.outcomes.join(', ')}`);
        console.log(`   Prices: ${market.outcomePrices.join(', ')}`);

        // Map Outcomes to Token IDs from our local cache or DB
        // The simulation script records trades, so we can query DB for tokenIds associated with this condition
        const relevantTrades = await prisma.copyTrade.findMany({
            where: { conditionId: conditionId, configId: configId },
            select: { tokenId: true, outcome: true },
            distinct: ['tokenId']
        });

        const outcomeToTokenMap = new Map<string, string>();
        relevantTrades.forEach((t) => {
            if (t.outcome && t.tokenId) {
                outcomeToTokenMap.set(t.outcome, t.tokenId);
            }
        });

        // Determine winners and settle
        for (let i = 0; i < market.outcomes.length; i++) {
            const outcomeName = market.outcomes[i];
            const price = market.outcomePrices[i];
            const tokenId = outcomeToTokenMap.get(outcomeName);

            if (!tokenId) continue;

            // Check if we hold this token
            // Check if we hold this token
            const metrics = tracker.metrics(tokenId);
            if (!metrics || metrics.shares <= 0) continue;
            const meta = positionMetadata.get(tokenId);

            // Shim compatible object
            const pos = {
                balance: metrics.shares,
                totalCost: metrics.costUSDC,
                shares: metrics.shares,
                ...meta
            };

            if (!startSettlement(tokenId)) continue;

            let settlementValue: number | null = null;
            const tokenInfo = (market as any).tokens?.find((t: any) => t.tokenId === tokenId || t.token_id === tokenId);
            const isWinner = tokenInfo?.winner;

            if (isWinner === true) settlementValue = 1.0;
            else if (isWinner === false && market.closed) settlementValue = 0.0;
            else if (price >= 0.95) settlementValue = 1.0;
            else if (price <= 0.05 && market.closed) settlementValue = 0.0;

            if (settlementValue === null) {
                finishSettlement(tokenId, false);
                continue;
            }

            console.log(`   Processing Position: ${pos.balance.toFixed(2)} shares of '${outcomeName}'. Value: $${settlementValue}`);

            try {
                // Settle it
                const proceeds = pos.balance * settlementValue;
                const costBasis = pos.totalCost;
                const pnl = proceeds - costBasis;

                // Update Metrics
                realizedPnL += pnl;
                totalSellVolume += proceeds;

                console.log(`     ✅ Settled! PnL: $${pnl.toFixed(4)} (Proceeds: $${proceeds.toFixed(2)} - Cost: $${costBasis.toFixed(2)})`);

                // Log Settlement Trade
                await prisma.copyTrade.create({
                    data: {
                        configId: configId,
                        originalTrader: 'POLYMARKET_SETTLEMENT',
                        originalSide: 'SELL',
                        originalSize: pos.shares,
                        originalPrice: settlementValue,
                        marketSlug: market.slug,
                        conditionId: conditionId,
                        tokenId: tokenId,
                        outcome: outcomeName,
                        copySize: proceeds,
                        copyPrice: settlementValue,
                        status: CopyTradeStatus.EXECUTED,
                        executedAt: new Date(),
                        txHash: `${TX_PREFIX}settlement-${Date.now()}`,
                        realizedPnL: pnl,
                        errorMessage: `Computed PnL: $${pnl.toFixed(4)}`
                    }
                });

                // Remove from DB Position
                await prisma.userPosition.deleteMany({
                    where: {
                        walletAddress: FOLLOWER_WALLET.toLowerCase(),
                        tokenId: tokenId
                    }
                });

                // Remove from Local Map
                tracker.remove(tokenId);
                positionMetadata.delete(tokenId);
                finishSettlement(tokenId, true);
            } catch (err) {
                finishSettlement(tokenId, false);
                throw err;
            }
        }

    } catch (error) {
        console.error(`   ❌ Error in resolveSimulatedPositions:`, error);
    }
}

async function redeemWinningPositionOnChain(conditionId: string, outcomeIndex: number): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const mode = activeConfig?.executionMode || LIVE_EXECUTION_MODE;
    if (mode === 'EOA') {
        if (!executionSigner) {
            return { success: false, error: 'EOA signer unavailable' };
        }
        try {
            const addresses = chainId === 137 ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;
            const ctf = new ethers.Contract(CONTRACT_ADDRESSES.ctf, CTF_ABI, executionSigner);
            const tx = await ctf.redeemPositions(
                addresses.usdc,
                ethers.constants.HashZero,
                conditionId,
                [1 << outcomeIndex]
            );
            const receipt = await tx.wait();
            return { success: true, txHash: receipt.transactionHash };
        } catch (error: any) {
            return { success: false, error: error?.message || 'EOA redeem failed' };
        }
    }

    if (!executionService) {
        return { success: false, error: 'Proxy execution service unavailable' };
    }
    const proxyAddress = await executionService.resolveProxyAddress(FOLLOWER_WALLET.toLowerCase());
    if (!proxyAddress) {
        return { success: false, error: 'Proxy not found' };
    }
    return executionService.redeemPositions(proxyAddress, conditionId, [1 << outcomeIndex]);
}

// --- REDEMPTION LOGIC ---
async function processRedemptions() {
    console.log('\n🔄 Processing Settlements (Wins & Losses)...');
    const activeTokenIds = tracker.getAllPositions().map(p => p.tokenId);
    if (activeTokenIds.length === 0) return;

    for (const tokenId of activeTokenIds) {
        const metrics = tracker.metrics(tokenId);
        const meta = positionMetadata.get(tokenId);
        if (!metrics || !meta) continue;

        // Merge for compatibility
        const pos = { ...meta, shares: metrics.shares, totalCost: metrics.costUSDC, conditionId: meta.conditionId };

        try {
            // Check if market is resolved and we WON
            if (pos.marketSlug) {
                // Use /events endpoint which is more reliable than /markets
                const url = `${GAMMA_API_URL}/events?slug=${pos.marketSlug}`;

                // console.log(`   [Debug] Checking settlement for ${pos.marketSlug} ...`);
                const resp = await fetchWithRetry(url);
                if (resp.ok) {
                    const data = await resp.json();
                    // Gamma returns Event or Event[]
                    const event = Array.isArray(data) ? data[0] : data;

                    // Find the specific market within the event
                    let m: any = null;
                    if (event && event.markets) {
                        if (pos.conditionId) {
                            m = event.markets.find((mk: any) => mk.conditionId === pos.conditionId || mk.condition_id === pos.conditionId);
                        }
                        if (!m) {
                            m = event.markets[0]; // Fallback to first market
                        }
                    }

                    if (m) {
                        // console.log(`   [Debug] Market Found: ${m.slug}. Closed: ${m.closed}`);
                        let price = undefined;

                        // Re-use matching logic (Token ID or Outcome match)
                        let outcomeIndex = -1;
                        const token = (m.tokens || []).find((t: any) => t.tokenId === tokenId || t.token_id === tokenId);
                        if (token && token.price) {
                            price = Number(token.price);
                        }
                        if (m.outcomes && m.outcomePrices && pos.outcome) {
                            const outcomes: string[] = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : m.outcomes;
                            const prices: number[] = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices).map(Number) : m.outcomePrices.map(Number);
                            const myOutcome = parseOutcome(pos.outcome);
                            const idx = outcomes.findIndex((o: string) => parseOutcome(o) === myOutcome);

                            if (idx !== -1 && prices[idx] !== undefined) {
                                outcomeIndex = idx;
                                if (price === undefined) {
                                    price = prices[idx];
                                }
                            }
                            if (outcomeIndex < 0 && token) {
                                const tokenIdx = (m.tokens || []).findIndex((t: any) => t.tokenId === tokenId || t.token_id === tokenId);
                                if (tokenIdx >= 0) {
                                    outcomeIndex = tokenIdx;
                                }
                            }
                        }

                        // Check for 'winner' flag in token data
                        let isWinner: boolean | undefined = undefined;
                        if (token && token.winner !== undefined) {
                            isWinner = token.winner;
                        }

                        // STRICT SETTLEMENT LOGIC: Only settle if market is CLOSED
                        if (!m.closed) continue;

                        // Check for Win (Explicit Winner or Price is effectively 1)
                        if (isWinner === true || (price !== undefined && price >= 0.95)) {
                            if (!startSettlement(tokenId)) continue;
                            console.log(`   🎉 Redeeming WIN for ${pos.marketSlug} (${pos.outcome}). Shares: ${pos.shares.toFixed(2)}`);

                            // 1. Credit Realized PnL (Value - Cost)
                            // Redemption gives $1.00 per share.
                            const redemptionValue = pos.shares;
                            const profit = redemptionValue - pos.totalCost;
                            realizedPnL += profit;
                            totalSellVolume += redemptionValue;

                            // 2. Record Trade
                            const execPrice = 1.0;
                            let settlementStatus: CopyTradeStatus = CopyTradeStatus.EXECUTED;
                            let settlementTxHash = `${TX_PREFIX}redeem-${Date.now()}`;
                            let settlementError = `Redeemed Profit: $${profit.toFixed(4)}`;
                            if (IS_LIVE_MODE) {
                                if (!pos.conditionId) {
                                    settlementStatus = CopyTradeStatus.FAILED;
                                    settlementError = 'Live redemption skipped: missing conditionId';
                                } else if (outcomeIndex < 0) {
                                    settlementStatus = CopyTradeStatus.FAILED;
                                    settlementError = 'Live redemption skipped: unresolved outcome index';
                                } else {
                                    const redeemResult = await redeemWinningPositionOnChain(pos.conditionId, outcomeIndex);
                                    if (redeemResult.success && redeemResult.txHash) {
                                        settlementTxHash = redeemResult.txHash;
                                    } else {
                                        settlementStatus = CopyTradeStatus.FAILED;
                                        settlementError = redeemResult.error || 'Live redemption failed';
                                    }
                                }
                            }
                            await prisma.copyTrade.create({
                                data: {
                                    configId: configId,
                                    marketSlug: pos.marketSlug,
                                    tokenId: tokenId,
                                    outcome: pos.outcome,
                                    originalSide: 'REDEEM',
                                    copySize: redemptionValue, // Total Value Out
                                    copyPrice: execPrice,
                                    originalTrader: 'PROTOCOL',
                                    originalSize: 0,
                                    originalPrice: 1.0,
                                    status: settlementStatus,
                                    executedAt: new Date(),
                                    txHash: settlementTxHash,
                                    errorMessage: settlementError,
                                    realizedPnL: settlementStatus === CopyTradeStatus.EXECUTED ? profit : undefined,
                                    conditionId: pos.conditionId // Important: persist conditionId
                                }
                            });

                            if (settlementStatus !== CopyTradeStatus.EXECUTED) {
                                console.warn(`      ⚠️ Redemption failed for ${tokenId}: ${settlementError}`);
                                finishSettlement(tokenId, false);
                                continue;
                            }

                            // 3. Remove Position
                            await prisma.userPosition.deleteMany({
                                where: { walletAddress: FOLLOWER_WALLET.toLowerCase(), tokenId: tokenId }
                            });
                            tracker.remove(tokenId);
                            positionMetadata.delete(tokenId);
                            finishSettlement(tokenId, true);

                            console.log(`      💰 Credited $${redemptionValue.toFixed(2)} (Profit: $${profit.toFixed(2)})`);
                        }
                        // Check for Loss (Explicit Loser or Price is effectively 0)
                        else if (isWinner === false || (price !== undefined && price <= 0.05)) {
                            if (!startSettlement(tokenId)) continue;
                            console.log(`   💀 Settle LOSS for ${pos.marketSlug} (${pos.outcome}). Shares: ${pos.shares.toFixed(2)}`);

                            const settlementValue = 0;
                            const profit = -pos.totalCost; // 100% Loss
                            realizedPnL += profit;
                            totalSellVolume += 0;

                            // Record Trade
                            const execPrice = 0.0;
                            await prisma.copyTrade.create({
                                data: {
                                    configId: configId,
                                    marketSlug: pos.marketSlug,
                                    tokenId: tokenId,
                                    outcome: pos.outcome,
                                    originalSide: 'SELL', // Close position
                                    copySize: 0, // Proceeds at $0
                                    copyPrice: execPrice,
                                    originalTrader: 'PROTOCOL',
                                    originalSize: pos.shares,
                                    originalPrice: 0.0,
                                    status: CopyTradeStatus.EXECUTED,
                                    executedAt: new Date(),
                                    txHash: `${TX_PREFIX}settle-loss-${Date.now()}`,
                                    realizedPnL: profit,
                                    errorMessage: `Realized Loss: $${Math.abs(profit).toFixed(4)}`
                                }
                            });

                            // Remove Position
                            await prisma.userPosition.deleteMany({
                                where: { walletAddress: FOLLOWER_WALLET.toLowerCase(), tokenId: tokenId }
                            });
                            tracker.remove(tokenId);
                            positionMetadata.delete(tokenId);
                            finishSettlement(tokenId, true);

                            console.log(`      📉 Realized Loss: $${Math.abs(profit).toFixed(2)}`);
                        }
                    }
                }
            }
        } catch (e: any) {
            // Silent skip for network errors - these are common and will be retried next cycle
            const isNetworkError = e?.code === 'ECONNRESET' ||
                e?.cause?.code === 'ECONNRESET' ||
                e?.message?.includes('fetch failed');
            if (!isNetworkError) {
                console.error(`   ❌ Redemption check failed for ${tokenId}:`, e);
            }
            finishSettlement(tokenId, false);
        }
    }
}

function parseOutcome(outcome: string | null | undefined): string {
    if (!outcome) return 'N/A';
    const lower = outcome.trim().toLowerCase();
    if (lower === 'yes') return 'Up';
    if (lower === 'no') return 'Down';
    return outcome.charAt(0).toUpperCase() + outcome.slice(1);
}

// --- PRINT SUMMARY ---
async function printSummary() {
    const duration = (Date.now() - startTime) / 1000 / 60;

    // Calculate unrealized PnL with LIVE prices
    let unrealizedPnL = 0;

    // Batch fetch prices for summary using ROBUST matching logic (Slug + Outcome)
    const activeTokenIds = tracker.getAllPositions().map(p => p.tokenId);
    const priceMap = new Map<string, number>();

    if (activeTokenIds.length > 0) {
        console.log(`\n🔎 Fetching live prices for ${activeTokenIds.length} active positions...`);
        try {
            for (const tokenId of activeTokenIds) {
                const meta = positionMetadata.get(tokenId);
                if (!meta) continue;
                const pos = { ...meta };
                try {
                    // 0. Try CLOB Price first (Alignment with Frontend)
                    try {
                        const clobResp = await fetch(`${CLOB_API_URL}/book?token_id=${tokenId}`);
                        if (clobResp.ok) {
                            const book = await clobResp.json();
                            if (book.bids && book.bids.length > 0) {
                                const bestBid = Number(book.bids[0].price);
                                priceMap.set(tokenId, bestBid);
                                continue; // Found price, skip Gamma
                            }
                        }
                    } catch (e) { } // Ignore CLOB errors, fallthrough to Gamma

                    if (pos.marketSlug || pos.conditionId) {
                        let url = `${GAMMA_API_URL}/markets?slug=${pos.marketSlug}`;
                        if (pos.conditionId) {
                            url = `${GAMMA_API_URL}/markets?condition_id=${pos.conditionId}`;
                        }
                        const resp = await fetch(url);
                        if (resp.ok) {
                            const data = await resp.json();
                            const m = Array.isArray(data) ? data[0] : data;
                            if (m) {
                                // 1. Check for Explicit Resolution FIRST
                                let isWinner: boolean | undefined = undefined;
                                const token = (m.tokens || []).find((t: any) => t.tokenId === tokenId || t.token_id === tokenId);

                                if (token && token.winner !== undefined) {
                                    isWinner = token.winner;
                                }

                                if (isWinner === true) {
                                    priceMap.set(tokenId, 1.0);
                                    continue;
                                } else if (isWinner === false && m.closed) {
                                    priceMap.set(tokenId, 0.0);
                                    continue;
                                }

                                // 2. Try Token ID Match (Real Price)
                                let price = undefined;
                                if (token && token.price) {
                                    price = Number(token.price);
                                }
                                // 3. Fallback: Outcome Match
                                else if (m.outcomes && m.outcomePrices && pos.outcome) {
                                    const outcomes: string[] = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : m.outcomes;
                                    const prices: number[] = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices).map(Number) : m.outcomePrices.map(Number);

                                    const myOutcome = parseOutcome(pos.outcome);
                                    const idx = outcomes.findIndex((o: string) => parseOutcome(o) === myOutcome);
                                    if (idx !== -1 && prices[idx] !== undefined) {
                                        price = prices[idx];
                                    }
                                }

                                // Robust Settlement Check
                                if (price !== undefined) {
                                    if (price >= 0.95) price = 1.0;
                                    if (price <= 0.05 && m.closed) price = 0.0;
                                    priceMap.set(tokenId, price);
                                }
                            }
                        }
                    }
                } catch (e) { }
            }
        } catch (e) {
            console.warn('   ⚠️ Failed to fetch live prices for summary');
        }
    }
    for (const posMetrics of tracker.getAllPositions()) {
        if (posMetrics.shares > 0) {
            // Use live price if available, else entry price
            const livePrice = priceMap.get(posMetrics.tokenId) ?? posMetrics.avgPrice;
            const marketValue = posMetrics.shares * livePrice;
            unrealizedPnL += marketValue - posMetrics.costUSDC;
        }
    }

    // Get trades from DB
    const dbTrades = await prisma.copyTrade.findMany({
        where: { configId },
        orderBy: { executedAt: 'asc' }
    });

    const dbPositions = await prisma.userPosition.findMany({
        where: { walletAddress: FOLLOWER_WALLET.toLowerCase() }
    });

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 BUDGET-CONSTRAINED COPY TRADING SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Duration: ${duration.toFixed(1)} minutes`);
    console.log(`Mode: ${IS_LIVE_MODE ? '🟢 Live' : '🟡 Simulation'}`);
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`💵 BUDGET STATUS`);
    console.log(`  Max Budget: $${MAX_BUDGET.toLocaleString()}`);
    console.log(`  Budget Used: $${budgetUsed.toFixed(2)} (${((budgetUsed / MAX_BUDGET) * 100).toFixed(1)}%)`);
    console.log(`  Budget Remaining: $${(MAX_BUDGET - budgetUsed).toFixed(2)}`);
    console.log(`  Trades Skipped (Budget): ${tradesSkippedBudget}`);
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`📊 TRADE STATISTICS`);
    console.log(`  Total Orders Recorded: ${dbTrades.length}`);
    console.log(`  Total Buy Volume: $${totalBuyVolume.toFixed(2)}`);
    console.log(`  Total Sell Volume: $${totalSellVolume.toFixed(2)}`);
    const totalFees = tradesRecorded * ESTIMATED_GAS_FEE_USD;
    const netPnL = realizedPnL - totalFees;
    const totalPnL = netPnL + unrealizedPnL;

    console.log('───────────────────────────────────────────────────────────────');
    console.log(`💰 P&L SUMMARY`);
    console.log(`  Realized P&L (Gross): $${realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(4)}`);
    console.log(`  Unrealized P&L:       $${unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(4)}`);
    console.log(`  Est. Fees (Gas):      -$${totalFees.toFixed(2)}`);
    console.log(`  Est. Fees (CLOB):     -$${totalFeesPaid.toFixed(4)}  (0.1% taker)`);
    const netPnLAfterFees = netPnL - totalFeesPaid;
    console.log(`  Net P&L (After Fees): $${netPnLAfterFees >= 0 ? '+' : ''}${netPnLAfterFees.toFixed(4)}`);
    console.log(`  TOTAL P&L:            $${(totalPnL - totalFeesPaid) >= 0 ? '+' : ''}${(totalPnL - totalFeesPaid).toFixed(4)}`);
    console.log('═══════════════════════════════════════════════════════════════');

    console.log('\n📁 DATABASE RECORDS');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`CopyTrade records: ${dbTrades.length}`);
    console.log(`UserPosition records: ${dbPositions.length}`);

    if (dbPositions.length > 0) {
        console.log('\n📈 OPEN POSITIONS');
        console.log('───────────────────────────────────────────────────────────────');
        for (const pos of dbPositions) {
            if (pos.balance > 0) {
                console.log(`Token: ${pos.tokenId.substring(0, 25)}...`);
                console.log(`  Balance: ${pos.balance.toFixed(2)} shares`);
                console.log(`  Avg Price: $${pos.avgEntryPrice.toFixed(4)}`);
                console.log(`  Total Cost: $${pos.totalCost.toFixed(4)}`);
            }
        }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    if (tradesRecorded > 0) {
        console.log(`✅ ${IS_LIVE_MODE ? 'LIVE' : 'SIMULATION'} COMPLETE - Data saved to database`);
    } else {
        console.log('⚠️  No trades detected during simulation period');
    }
    console.log('═══════════════════════════════════════════════════════════════\n');
}

// --- LIVE STATS (every 60s) ---
function printLiveStats() {
    const uptimeMin = ((Date.now() - startTime) / 60000).toFixed(1);
    const total = signalStats.total;
    const hitRate = total > 0 ? ((signalStats.executed / total) * 100).toFixed(1) : '0.0';
    const staleRate = total > 0 ? ((signalStats.stale / total) * 100).toFixed(1) : '0.0';
    const avgLatencyMs = signalStats.latencyCount > 0
        ? (signalStats.latencySum / signalStats.latencyCount)
        : 0;
    const avgLatStr = avgLatencyMs >= 1000
        ? `${(avgLatencyMs / 1000).toFixed(1)}s`
        : `${avgLatencyMs.toFixed(0)}ms`;
    const budgetPct = ((budgetUsed / MAX_BUDGET) * 100).toFixed(1);

    const fokRate = total > 0 ? ((signalStats.fokRejected / total) * 100).toFixed(1) : '0.0';

    console.log(`\n📊 [${uptimeMin}m] SESSION STATS`);
    console.log(`   Signals:   ${total} total | CTF⛓️ ${signalStats.ctf} / WS📡 ${signalStats.ws}`);
    console.log(`   Executed:  ${signalStats.executed} (${hitRate}%) | Failed/Skip: ${signalStats.failed}`);
    console.log(`   FOK Reject:${signalStats.fokRejected} (${fokRate}%) | Stale: ${signalStats.stale} (${staleRate}%) | Dupes: ${signalStats.duplicate}`);
    console.log(`   Latency:   avg ${avgLatStr} (incl ~2.5s exec delay)`);
    console.log(`   Budget:    $${budgetUsed.toFixed(2)} / $${MAX_BUDGET} used (${budgetPct}%)`);
    console.log(`   Fees:      -$${totalFeesPaid.toFixed(3)} taker | PnL: $${(realizedPnL - totalFeesPaid).toFixed(3)}`);
}

// --- MAIN ---
async function main() {
    // 1. Setup
    if (!process.env.TRADING_PRIVATE_KEY) {
        throw new Error('TRADING_PRIVATE_KEY is required');
    }
    if (IS_LIVE_MODE && !clobCredentials) {
        console.warn('⚠️ Running live mode without explicit CLOB API credentials. Ensure TradingService can initialize credentials.');
    }
    if (IS_LIVE_MODE) {
        await fallbackTradingService.initialize();
        console.log('✅ TradingService initialized for live EOA execution.');
    }

    await seedConfig();

    console.log('🔌 Pre-warming initial metadata cache... This might take ~5 seconds.');
    await tokenMetadataService.prewarmCache();
    // Re-hydrate mapping incrementally every 10 mins
    setInterval(() => tokenMetadataService.prewarmCache(), 600000);

    // 2. Connect to WebSocket
    const realtimeService = new RealtimeServiceV2({
        // Use manual reconnect w/ backoff to avoid rapid reconnect storms (EADDRNOTAVAIL)
        autoReconnect: false,
        debug: false,
    });

    // 2b. Setup Event Listener (Deterministic source of truth)
    // HTTP polling (POLYGON_RPC_URL) is preferred over WebSocket to avoid the ethers v5
    // phantom-callback crash. Falls back to POLYGON_WS if that's all we have.
    const polygonRpc = process.env.POLYGON_RPC_URL || process.env.POLYGON_WS;
    let eventListener: CtfEventListener | null = null;

    function startCtfListener() {
        if (!polygonRpc) return;
        if (eventListener) {
            try { eventListener.stop(); } catch (_) { }
        }
        console.log('🔌 Initializing CTF Event Listener (Safety Net)...');
        eventListener = new CtfEventListener(polygonRpc, TARGET_TRADER);
        eventListener.start((trade) => handleTrade(trade, 'CTF'));
    }

    if (polygonRpc) {
        startCtfListener();
    } else {
        console.log('⚠️  No POLYGON_RPC_URL or POLYGON_WS provided. CTF Event Listener disabled (relying on API only).');
    }

    // Guard against the ethers v5 WebSocketProvider phantom-callback uncaughtException.
    // When the WS reconnects, pending RPC requests lose their callback entries, and any
    // late-arriving message throws "Cannot read properties of undefined (reading 'callback')".
    // This error escapes all try/catch because it fires inside the WS `onmessage` handler.
    process.on('uncaughtException', (err: Error) => {
        const isEthersCbBug =
            err instanceof TypeError &&
            err.message.includes("reading 'callback'") &&
            err.stack?.includes('websocket-provider');
        if (isEthersCbBug) {
            console.warn('\n⚠️  [CtfEvent] ethers v5 WS phantom-callback error — restarting listener...');
            // Restart the listener after a short delay to let the stale WS fully close
            setTimeout(() => startCtfListener(), 3000);
        } else {
            // Re-throw unknown errors so they still surface
            console.error('\n💥 Uncaught Exception:', err);
            process.exit(1);
        }
    });

    console.log('🔌 Connecting to Polymarket WebSocket...');
    realtimeService.connect();

    // Manual reconnect with exponential backoff
    let reconnectAttempts = 0;
    let reconnectTimer: NodeJS.Timeout | null = null;
    const scheduleReconnect = () => {
        if (reconnectTimer) return;
        const base = 1000; // 1s
        const max = 30000; // 30s
        const delay = Math.min(max, base * 2 ** reconnectAttempts);
        const jitter = Math.floor(Math.random() * 500);
        reconnectAttempts += 1;
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            console.warn(`🔁 Reconnecting WebSocket (attempt ${reconnectAttempts})...`);
            realtimeService.connect();
        }, delay + jitter);
    };

    realtimeService.on('disconnected', scheduleReconnect);
    realtimeService.on('connected', () => {
        reconnectAttempts = 0;
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    });

    // 3. Subscribe to ALL activity
    const shouldUseServerFilter = SIM_ACTIVITY_FILTER === 'TRADER_ONLY' && SIM_WS_SERVER_FILTER;
    const activityFilter = shouldUseServerFilter
        ? { traderAddress: TARGET_TRADER }
        : {};

    if (shouldUseServerFilter) {
        realtimeService.subscribeActivity(activityFilter, {
            onTrade: handleTrade,
            onError: (err) => {
                console.error('❌ WebSocket error:', err.message);
            }
        });
    } else {
        realtimeService.subscribeAllActivity({
            onTrade: handleTrade,
            onError: (err) => {
                console.error('❌ WebSocket error:', err.message);
            }
        });
    }

    // 4. Subscribe to Market Events (Settlement)
    console.log('🔌 Subscribing to Market Events (Resolutions)...');
    realtimeService.subscribeMarketEvents({
        onMarketEvent: async (event) => {
            try {
                await handleMarketResolution(event);
            } catch (err) {
                console.error('[Sim] Error handling market event:', err);
            }
        }
    });

    const filterLabel = SIM_ACTIVITY_FILTER === 'ALL'
        ? 'ALL activity'
        : (SIM_WS_SERVER_FILTER ? 'TRADER_ONLY (server filter)' : 'TRADER_ONLY (local filter)');
    console.log(`🎧 Live Trading started - tracking ${filterLabel}...`);
    console.log(`   (Will run for ${(SIMULATION_DURATION_MS / 1000 / 60).toFixed(0)} minutes)\n`);

    // 4. Live stats every 60s (signal quality dashboard)
    const progressInterval = setInterval(async () => {
        printLiveStats();
        await processRedemptions();
    }, 60000);

    // 5. Run for configured duration
    await new Promise(resolve => setTimeout(resolve, SIMULATION_DURATION_MS));

    // 6. Cleanup and report
    clearInterval(progressInterval);
    console.log('🔄 Running final settlement check...');
    await processRedemptions();
    await printSummary();

    if (eventListener) (eventListener as CtfEventListener).stop();
    realtimeService.disconnect();
    await prisma.$disconnect();

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
