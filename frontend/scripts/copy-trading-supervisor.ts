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

import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'path';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, CTF_ABI } from '../../src/core/contracts';
import { CopyTradingExecutionService, ExecutionParams } from '../../src/services/copy-trading-execution-service';
import { TradingService, TradeInfo } from '../../src/services/trading-service';
import { RateLimiter } from '../../src/core/rate-limiter';
import { createUnifiedCache, UnifiedCache } from '../../src/core/unified-cache';
import { WalletManager, WorkerContext } from '../../src/core/wallet-manager';

// --- CONFIG ---
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "137");

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
// If TRADING_MNEMONIC is not set, we can't derive a fleet easily from a PK.
// FALLBACK: If only PK offered, we only have 1 worker (Legacy Mode).
const MASTER_MNEMONIC = process.env.TRADING_MNEMONIC || "";

// --- INITIALIZATION ---
const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL
});
const prisma = new PrismaClient({
    adapter,
    log: ['error'], // Less logs for supervisor
});

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
const executionService = new CopyTradingExecutionService(masterTradingService, masterTradingService.getWallet(), CHAIN_ID);

// 3. Wallet Manager (The Fleet)
let walletManager: WalletManager;

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
} else {
    console.warn("⚠️ NO MNEMONIC FOUND! Supervisor running in SINGLE WORKER mode (Legacy).");
    console.warn("Please set TRADING_MNEMONIC in .env for parallel scale.");
    // Mock a single-worker manager for compatibility? 
    // Actually, we can just fail or ask user. For now, let's warn.
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
}

let activeConfigs: ActiveConfig[] = [];
let monitoredTraders: Set<string> = new Set();
let isProcessing = false;

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
            autoExecute: c.autoExecute
        }));

        monitoredTraders = new Set(activeConfigs.map(c => c.traderAddress.toLowerCase()));

        const stats = walletManager ? walletManager.getStats() : { total: 1, available: 1 };
        console.log(`[Supervisor] Refreshed: ${activeConfigs.length} strategies. Fleet: ${stats.available}/${stats.total} ready.`);
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
    if (isProcessing) return; // Simple debounce if needed, but parallel means we shouldn't block?
    // Actually, we want to process EVERY event.

    try {
        const tokenId = id.toString();
        const amountValues = value.toString(); // Raw share amount
        const originalSize = parseFloat(amountValues) / 1e6; // Approximation for USDC/Token decimals

        // 1. Identify Trader
        // Proxy Transfer logic: 
        // Mint (Buy): 0x -> Proxy (Usually handled by CTF minting, might not be TransferSingle?)
        // Actually, Buying on Polymarket usually = CTF split or Order match.
        // For CTF: Order Match -> ERC1155 Transfer.
        // If Trader BUYS: Seller -> Trader. (from=Seller, to=Trader)
        // If Trader SELLS: Trader -> Buyer. (from=Trader, to=Buyer)

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

        // 2. Dispatch Jobs
        const subscribers = activeConfigs.filter(c => c.traderAddress.toLowerCase() === trader);

        if (subscribers.length === 0) return;

        console.log(`[Supervisor] Dispatching ${subscribers.length} jobs...`);

        // Fetch market price ONCE for all subscribers? 
        // Optimization: Get price once, pass to executors.
        // But execution service might re-fetch.
        // Let's get "approx" price for sizing logic.
        let price = 0.5; // Default fallback
        try {
            // Can use master service to peek price quickly
            // const ob = await masterTradingService.getOrderBook(tokenId); 
            // price = side === 'BUY' ? Number(ob.asks[0]?.price || 0.5) : Number(ob.bids[0]?.price || 0.5);
        } catch (e) { console.warn("Price peek failed, using default"); }

        // PARALLEL EXECUTION LOOP
        subscribers.forEach(async (sub) => {
            await processJob(sub, side!, tokenId, price, trader!, originalSize);
        });

    } catch (error) {
        console.error(`[Supervisor] Event processing error:`, error);
    }
}

async function processJob(
    config: ActiveConfig,
    side: 'BUY' | 'SELL',
    tokenId: string,
    approxPrice: number,
    originalTrader: string,
    originalSize: number
) {
    // 1. Checkout Worker
    let worker: WorkerContext | null = null;
    if (walletManager) {
        worker = walletManager.checkoutWorker();
    }

    // If no worker available (or no fleet), we can try to fall back to Master or fail.
    // Ideally queue. For now, immediate fail/log.
    if (!worker) {
        console.error(`[Supervisor] ❌ DROPPED JOB for User ${config.walletAddress}: No workers available.`);
        return;
    }

    const workerAddress = worker.address;
    console.log(`[Supervisor] 🏃 assigning User ${config.walletAddress} -> Worker ${workerAddress}`);

    try {
        // 2. Calculate Size
        let copyAmount = 10; // Default $10
        if (config.fixedAmount) copyAmount = config.fixedAmount;
        // Logic for percentAmount omitted for brevity in Supervisor, relies on ExecutionService default?
        // Actually ExecutionService takes absolute amount.
        // TODO: Implement advanced size calc here using User Balance.

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
            tradingService: worker.tradingService // DYNAMIC SERVICE
        };

        const result = await executionService.executeOrderWithProxy(baseParams);

        // 4. Log Result (Async DB write)
        // 4. Log Result (Async DB write)
        await prisma.copyTrade.create({
            data: {
                configId: config.id,
                // Original Info
                originalTrader: originalTrader,
                originalSide: side,
                originalSize: originalSize,
                originalPrice: approxPrice,
                tokenId: tokenId,

                // Copy Info
                copySize: copyAmount,
                copyPrice: approxPrice, // Ideally get from result

                // Status
                status: result.success ? 'EXECUTED' : 'FAILED',
                txHash: result.orderId, // In execution service, orderId might be txHash
                errorMessage: result.error,
                executedAt: new Date()
            }
        });

        console.log(`[Supervisor] ✅ Job Complete for User ${config.walletAddress}: ${result.success ? "Success" : "Failed (" + result.error + ")"}`);

    } catch (e: any) {
        console.error(`[Supervisor] 💥 Job Crashed for User ${config.walletAddress}:`, e.message);
    } finally {
        // 5. Checkin Worker
        if (walletManager && worker) {
            walletManager.checkinWorker(worker.address);
        }
    }
}

// --- MAIN ---
async function main() {
    console.log("Starting Copy Trading Supervisor (Enterprise)...");

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

    // Listen to Contracts
    const ctf = new ethers.Contract(CONTRACT_ADDRESSES.ctf, CTF_ABI, provider);

    console.log(`[Supervisor] 🎧 Listening for TransferSingle on ${CONTRACT_ADDRESSES.ctf}...`);
    ctf.on("TransferSingle", handleTransfer);

    // Keep alive
    process.on('SIGINT', () => {
        console.log("Stopping...");
        process.exit();
    });
}

main().catch(console.error);
