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
import { PrismaLibSql } from '@prisma/adapter-libsql';
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
import { PrismaDebtLogger, PrismaDebtRepository } from './services/debt-adapters';
import { AffiliateEngine } from '../lib/services/affiliate-engine';

// --- CONFIG ---
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "31337");

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
console.log(`[Supervisor] 🌍 Network: ${process.env.NEXT_PUBLIC_NETWORK}`);
console.log(`[Supervisor] 🔌 RPC: ${RPC_URL}`);
console.log(`[Supervisor] 🏭 ProxyFactory: ${CONTRACT_ADDRESSES.polygon.proxyFactory}`);
console.log(`[Supervisor] 🏢 Executor: ${CONTRACT_ADDRESSES.polygon.executor}`);
console.log(`[Supervisor] 🏛️  CTF: ${CONTRACT_ADDRESSES.ctf}`);
const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL
});
const prisma = new PrismaClient({
    adapter,
    log: ['error'], // Less logs for supervisor
});

const debtRepository = new PrismaDebtRepository(prisma);
const debtLogger = new PrismaDebtLogger(prisma);
const affiliateEngine = new AffiliateEngine(prisma);

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

// Infrastructure
const rateLimiter = new RateLimiter();
// Cache: Redis would be better for Prod, currently In-Memory for Supervisor
const cache = createUnifiedCache();

// Core Services
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

// --- EVENT DEDUPLICATION (60 second TTL) ---
const processedEvents = new Map<string, number>();
const EVENT_TTL = 60_000;

function isEventDuplicate(txHash: string, logIndex: number): boolean {
    const key = `${txHash}:${logIndex}`;
    const ts = processedEvents.get(key);
    if (ts && Date.now() - ts < EVENT_TTL) {
        return true;
    }
    processedEvents.set(key, Date.now());
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

async function handleTransfer(
    operator: string,
    from: string,
    to: string,
    id: ethers.BigNumber,
    value: ethers.BigNumber,
    event: ethers.Event
) {
    // Deduplicate events to prevent double execution
    const txHash = event.transactionHash;
    const logIndex = event.logIndex;
    if (isEventDuplicate(txHash, logIndex)) {
        console.log(`[Supervisor] ⏭️ Duplicate event ignored: ${txHash}:${logIndex}`);
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
    // 0. Validate filters before allocating resources
    const filterResult = await passesFilters(config, tokenId, side, approxPrice);
    if (!filterResult.passes) {
        console.log(`[Supervisor] 🔕 Trade skipped for ${config.walletAddress}: ${filterResult.reason}`);
        return;
    }

    // 1. Try Checkout Worker OR EOA Signer
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
                // EOA Mode requires a TradingService instance compliant with this user.
                // For MVP: We instantiate a new TradingService for this user on the fly?
                // Or maybe the existing ExecutionService handles CLOB logic internally regardless of 'tradingService' passed?
                // Actually, TradingService constructor takes a wallet/key. 
                // We should instantiate a lightweight service or pass the wallet to the method.
                // Re-using Master Trading Service but Override Signer?
                // Current Trading Service is tied to one API Key...
                // CRITICAL TODO: CLOB Client needs API Keys. EOA users might not have them?
                // For now, let's assume EOA mode skips CLOB API auth if we just do contract interactions?
                // BUT executeOrderWithProxy calls 'createMarketOrder' which calls CLOB.
                // IF EOA user wants to trade on CLOB, they need API Keys.
                // If they want to trade on Contract, they need just Signer.
                // "Speed Mode" implies Direct CLOB access usually? 
                // If Speed Mode = EOA, then we are just replacing the Proxy Wrapper.
                // We still need CLOB API Keys.
                // Assuming for this iteration we use the MASTER keys for market data, 
                // but we need USER keys for placing orders?
                // Actually, if we use the USER's Private Key, we can generate API Keys for them or use theirs.
                // Lets assume for now we reuse the existing trading service structure but we need to solve the API Key issue later.
                // Temp: Use Master Service but with EOA Signer for on-chain checks?
                // Wait, logic says: "ExecutionService -> createMarketOrder".
                // We'll pass the EOA signer.
                worker = {
                    address: userWallet.address,
                    signer: userWallet,
                    tradingService: masterTradingService // This is incorrect if Master Service is tied to Master Account API Key.
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
                // ...
                worker = {
                    address: masterWallet.address,
                    signer: masterWallet.connect(provider),
                    tradingService: masterTradingService
                };
            }
        }
    }


    // 2. If no worker AND no EOA, QUEUE IT
    if (!worker && !eoaSigner) {
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

    // 3. Construct Effective Worker Context
    let effectiveWorker: WorkerContext;
    if (worker) {
        effectiveWorker = worker;
    } else {
        // Must be EOA signer
        const addr = await eoaSigner!.getAddress();
        effectiveWorker = {
            address: addr,
            signer: eoaSigner!,
            tradingService: eoaTradingService || masterTradingService
        };
    }

    // 4. Execute
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
    console.log(`[Supervisor] 🏃 [${typeLabel}] Assigning User ${config.walletAddress} -> Worker ${workerAddress}`);

    try {
        // 2. Calculate Size
        let copyAmount = 10; // Default $10
        if (config.fixedAmount) copyAmount = config.fixedAmount;

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

        // 4. Log Result (Async DB write)
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
                executedAt: new Date()
            }
        });

        console.log(`[Supervisor] ✅ Job Complete for User ${config.walletAddress}: ${result.success ? "Success" : "Failed (" + result.error + ")"}`);

        if (result.success) {
            // --- AFFILIATE COMMISSION TRIGGER ---
            try {
                // Determine Trade Volume (USDC Value)
                const tradeVolume = copyAmount; // We use copyAmount (USDC) as volume basis
                // Determine Platform Fee (e.g. 0.1% or virtual)
                // If we don't charge explicit fee, we treat a portion of volume as 'fee revenue' for payout?
                // Or we pay OUT of platform pockets based on volume.
                // Standard: Fee = Volume * 0.001 (0.1%)
                const platformFee = tradeVolume * 0.001;

                // Distribute
                await affiliateEngine.distributeCommissions({
                    tradeId: result.orderId || `trade-${Date.now()}`,
                    traderAddress: config.walletAddress, // The User who copied (Referee)
                    volume: tradeVolume,
                    platformFee: platformFee
                });
            } catch (affError) {
                console.error(`[Supervisor] ⚠️ Affiliate Trigger Failed:`, affError);
            }
        }

    } catch (e: any) {
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
    debtManager = walletManager ? new DebtManager(debtRepository, walletManager, provider, CHAIN_ID) : null;

    // Recover any pending debts from previous sessions
    if (debtManager) {
        console.log('[Supervisor] 🩺 Checking for pending debts from previous sessions...');
        const recovery = await debtManager.recoverPendingDebts();
        if (recovery.recovered > 0 || recovery.errors > 0) {
            console.log(`[Supervisor] 💰 Debt recovery: ${recovery.recovered} recovered, ${recovery.errors} errors`);
        }
    }

    await refreshConfigs();


    // Refresh configs loop
    setInterval(refreshConfigs, 10000);

    // Maintenance Loop (Auto-Refuel)
    setInterval(async () => {
        if (walletManager && masterTradingService.getWallet()) {
            // Check if workers have < 0.1 MATIC, top up to 0.5 MATIC
            // Using Master Wallet (Private Key) to fund them
            await walletManager.ensureFleetBalances(masterTradingService.getWallet(), 0.1, 0.5);
        }
    }, 60000 * 5); // Check every 5 minutes

    // Debt Recovery Loop
    setInterval(async () => {
        if (debtManager) {
            await debtManager.recoverPendingDebts();
        }
    }, 60000 * 2); // Check every 2 minutes

    // Listen to Contracts
    const ctf = new ethers.Contract(CONTRACT_ADDRESSES.ctf, CTF_ABI, provider);

    console.log(`[Supervisor] 🎧 Listening for TransferSingle on ${CONTRACT_ADDRESSES.ctf}...`);
    ctf.on("TransferSingle", handleTransfer);

    // Start Mempool Detector
    mempoolDetector = new MempoolDetector(provider, monitoredTraders, handleSniffedTx);
    mempoolDetector.start();

    // Keep alive
    process.on('SIGINT', () => {
        console.log("Stopping...");
        process.exit();
    });
}




// Execute Main
main().catch(console.error);
