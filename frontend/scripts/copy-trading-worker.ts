
/**
 * Copy Trading Worker (Standalone)
 * 
 * Listens to Real-time Blockchain Events to trigger Copy Trades immediately.
 * 
 * Usage: npx ts-node scripts/copy-trading-worker.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'path';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, CTF_ABI } from '../../src/core/contracts';
import { CopyTradingExecutionService } from '../../src/services/copy-trading-execution-service';
import { TradingService } from '../../src/services/trading-service';
import { RateLimiter } from '../../src/core/rate-limiter';
import { createUnifiedCache } from '../../src/core/unified-cache';
import { PositionService } from '../lib/services/position-service';

// --- CONFIG ---
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
const TRADING_PRIVATE_KEY = process.env.TRADING_PRIVATE_KEY;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '137');
const POLL_INTERVAL_MS = 30000; // Refresh configs every 30s

if (!TRADING_PRIVATE_KEY) {
    console.error('Missing TRADING_PRIVATE_KEY env var');
    process.exit(1);
}

// --- INITIALIZATION ---
const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || 'file:./dev.db',
});
const prisma = new PrismaClient({
    adapter,
    log: ['info', 'warn', 'error'],
});
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(TRADING_PRIVATE_KEY, provider);

// Services
const rateLimiter = new RateLimiter();
const cache = createUnifiedCache();
const positionService = new PositionService(prisma);
const tradingService = new TradingService(rateLimiter, cache, {
    privateKey: TRADING_PRIVATE_KEY,
    chainId: CHAIN_ID,
});
const executionService = new CopyTradingExecutionService(tradingService, signer, CHAIN_ID);

// State
let activeConfigs: any[] = [];
let monitoredAddresses: Set<string> = new Set();
let isProcessing = false;

// --- HELPERS ---

async function refreshConfigs() {
    try {
        const configs = await prisma.copyTradingConfig.findMany({
            where: {
                isActive: true,
                autoExecute: true
            }
        });

        activeConfigs = configs;
        monitoredAddresses = new Set(configs.map(c => c.traderAddress.toLowerCase()));

        console.log(`[Worker] Refreshed configs: ${configs.length} active auto-execute strategies.`);
        console.log(`[Worker] Monitoring ${monitoredAddresses.size} unique traders.`);
    } catch (e) {
        console.error('[Worker] Failed to refresh configs:', e);
    }
}

async function getPrice(tokenId: string): Promise<number> {
    try {
        const orderbook = await tradingService.getOrderBook(tokenId);
        // Mid price or best ask/bid depending on side? 
        // For simplicity, use mid price of best bid/ask
        const bestAsk = Number(orderbook.asks[0]?.price || 0);
        const bestBid = Number(orderbook.bids[0]?.price || 0);

        if (bestAsk && bestBid) return (bestAsk + bestBid) / 2;
        return bestAsk || bestBid || 0.5; // Fallback
    } catch (e) {
        console.warn(`[Worker] Failed to fetch price for ${tokenId}, defaulting to 0.5`);
        return 0.5;
    }
}

async function getMarketMetadata(tokenId: string): Promise<{ marketSlug: string; conditionId: string; outcome: string; marketQuestion: string }> {
    try {
        // 1. Get Condition ID from Orderbook (CLOB)
        const orderbook = await tradingService.getOrderBook(tokenId) as any;
        const conditionId = orderbook.market;

        if (!conditionId) {
            console.warn(`[Worker] ⚠️ No conditionId found in orderbook for ${tokenId}`);
            return { marketSlug: '', conditionId: '', outcome: 'Yes', marketQuestion: '' };
        }

        // 2. Get Market Details from CLOB Client
        // Ensure initialized (usually is by startListener)
        if (!tradingService.isInitialized()) await tradingService.initialize();
        const client = tradingService.getClobClient();
        if (!client) {
            console.warn(`[Worker] ⚠️ CLOB client not available`);
            return { marketSlug: '', conditionId: '', outcome: 'Yes', marketQuestion: '' };
        }

        const market = await client.getMarket(conditionId) as any;

        // 3. Determine Outcome
        // ClobMarket tokens: [{token_id, outcome}, ...]
        const tokenData = market.tokens?.find((t: any) => t.token_id === tokenId);
        const outcome = tokenData?.outcome || 'Yes';
        const slug = market.market_slug || '';
        const question = market.question || '';

        return {
            marketSlug: slug,
            conditionId: conditionId,
            outcome: outcome,
            marketQuestion: question
        };
    } catch (e) {
        console.warn(`[Worker] ⚠️ Metadata fetch failed for ${tokenId}:`, e);
        return { marketSlug: '', conditionId: '', outcome: 'Yes', marketQuestion: '' };
    }
}

/**
 * Calculate Copy Size (Duplicated from detect logic, ideally shared)
 */
function calculateCopySize(config: any, originalSize: number, originalPrice: number): number {
    const originalValue = originalSize * originalPrice;

    if (config.mode === 'FIXED_AMOUNT' && config.fixedAmount) {
        return Math.min(config.fixedAmount, config.maxSizePerTrade);
    }

    // PROPORTIONAL
    const scaledValue = originalValue * (config.sizeScale || 1);
    const minSize = config.minSizePerTrade ?? 0;
    return Math.max(minSize, Math.min(scaledValue, config.maxSizePerTrade));
}

// --- EVENT LISTENER ---

async function startListener() {
    // 1. Initialize Services
    await tradingService.initialize();
    await refreshConfigs();

    // 2. Setup Contract Listener
    const ctf = new ethers.Contract(CONTRACT_ADDRESSES.ctf, CTF_ABI, provider);

    console.log(`[Worker] 🎧 Listening for TransferSingle events on ${CONTRACT_ADDRESSES.ctf}...`);

    // Listen for TransferSingle
    // event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)

    ctf.on('TransferSingle', async (operator, from, to, id, value, event) => {
        // Run async handler
        handleTransfer(operator, from, to, id, value, event).catch(err => {
            console.error('[Worker] Error handling event:', err);
        });
    });

    // 3. Periodic Config Refresh
    setInterval(refreshConfigs, POLL_INTERVAL_MS);
}

// --- EVENT HANDLER ---

async function handleTransfer(
    operator: string,
    from: string,
    to: string,
    id: ethers.BigNumber,
    value: ethers.BigNumber,
    event: any
) {
    const fromAddr = from.toLowerCase();
    const toAddr = to.toLowerCase();

    // Check if involved addresses are monitored
    const isFromMonitored = monitoredAddresses.has(fromAddr);
    const isToMonitored = monitoredAddresses.has(toAddr);

    if (!isFromMonitored && !isToMonitored) return; // Ignore irrelevant transfers

    // Skip mints/burns if needed (but 'from' 0x0 is mint)
    if (fromAddr === ethers.constants.AddressZero || toAddr === ethers.constants.AddressZero) return;

    // Determine Trade Details
    const tokenId = id.toString();
    const sizeShares = parseFloat(ethers.utils.formatUnits(value, 6)); // Assuming 6 decimals for CTF tokens? Verify. usually 6 or 18.
    // CTF shares usually match collateral decimals? USDC is 6. Let's assume 6 for now.

    const txHash = event.transactionHash;

    console.log(`[Worker] 🔔 Detected Transfer! Tx: ${txHash.slice(0, 8)}...`);

    // Determine Side
    // If Monitor is FROM -> They Sent Tokens -> SELL
    // If Monitor is TO -> They Received Tokens -> BUY

    let detectedSide: 'BUY' | 'SELL' | null = null;
    let traderAddress = '';

    if (isFromMonitored) {
        detectedSide = 'SELL';
        traderAddress = fromAddr;
    } else if (isToMonitored) {
        detectedSide = 'BUY';
        traderAddress = toAddr;
    }

    if (!detectedSide) return;

    console.log(`[Worker] 🎯 Target: ${traderAddress} | Side: ${detectedSide} | Token: ${tokenId} | Size: ${sizeShares}`);

    // Fetch Price (Needed for value calc)
    const price = await getPrice(tokenId);
    console.log(`[Worker] 💲 Current Price: $${price}`);

    // Find configs for this trader
    const configs = activeConfigs.filter(c => c.traderAddress.toLowerCase() === traderAddress);

    for (const config of configs) {
        try {
            // Apply Basic Filters (Duplicated from detect)
            if (config.sideFilter && config.sideFilter !== detectedSide) continue;

            const tradeValue = sizeShares * price;
            if (config.minTriggerSize && tradeValue < config.minTriggerSize) continue;

            // Logic for COUNTER trade
            let copySide = detectedSide;
            if (config.direction === 'COUNTER') {
                copySide = detectedSide === 'BUY' ? 'SELL' : 'BUY';
            }

            // Calc Size
            const copySizeUsdc = calculateCopySize(config, sizeShares, price);
            if (copySizeUsdc <= 0) continue;

            console.log(`[Worker] 🚀 Auto-Executing for ${config.walletAddress}: ${copySide} $${copySizeUsdc.toFixed(2)}`);

            // EXECUTE
            // We need a 'tradeId' for the service, but we don't have a DB record yet.
            // Create DB record 'EXECUTED' immediately? Or 'PENDING' then update?
            // To be safe, create 'EXECUTED' (or 'PENDING' then immediately execute).
            // Service expects a tradeId to update status?
            // Service signature: executeOrderWithProxy(params). It returns result.
            // It does NOT update DB. The Route updates DB.
            // So we can just call execute, then create DB record with result.

            // 1.5 Fetch Metadata (NEW)
            const metadata = await getMarketMetadata(tokenId);
            console.log(`[Worker] ℹ️  Market: ${metadata.marketSlug} | ${metadata.outcome}`);

            // 1. Execute
            const result = await executionService.executeOrderWithProxy({
                tradeId: 'auto-' + Date.now(), // Temporary ID for logs
                walletAddress: config.walletAddress,
                tokenId: tokenId,
                side: copySide,
                amount: copySizeUsdc,
                price: price,
                slippage: config.slippageType === 'FIXED' ? (config.maxSlippage / 100) : undefined,
                maxSlippage: config.maxSlippage,
                slippageMode: config.slippageType as 'FIXED' | 'AUTO',
                orderType: 'market', // Always market for auto
            });

            // 2. Log to DB
            await prisma.copyTrade.create({
                data: {
                    configId: config.id,
                    originalTrader: traderAddress,
                    originalSide: detectedSide,
                    originalSize: sizeShares,
                    originalPrice: price,
                    tokenId: tokenId,
                    copySize: copySizeUsdc,
                    status: result.success ? 'EXECUTED' : 'FAILED',
                    executedAt: result.success ? new Date() : null,
                    txHash: result.transactionHashes?.[0] || txHash,
                    errorMessage: result.error,
                    detectedAt: new Date(),
                    // Metadata
                    marketSlug: metadata.marketSlug,
                    conditionId: metadata.conditionId,
                    outcome: metadata.outcome,
                }
            });

            if (result.success) {
                // 3. Update Position (NEW)
                try {
                    const sharesBought = copySizeUsdc / price;
                    if (copySide === 'BUY') {
                        await positionService.recordBuy({
                            walletAddress: config.walletAddress,
                            tokenId: tokenId,
                            side: 'BUY',
                            amount: sharesBought,
                            price: price,
                            totalValue: copySizeUsdc
                        });
                        console.log(`[Worker] 📊 Position updated +${sharesBought.toFixed(2)}`);
                    } else {
                        await positionService.recordSell({
                            walletAddress: config.walletAddress,
                            tokenId: tokenId,
                            side: 'SELL',
                            amount: sharesBought, // Approx
                            price: price,
                            totalValue: copySizeUsdc
                        });
                        console.log(`[Worker] 📊 Position updated -${sharesBought.toFixed(2)}`);
                    }
                } catch (posErr) {
                    console.error(`[Worker] ⚠️ Failed to update position:`, posErr);
                }
            }

            console.log(`[Worker] ✅ Execution Result: ${result.success ? 'Success' : 'Failed'}`);

        } catch (err) {
            console.error(`[Worker] Execution failed for config ${config.id}:`, err);
        }
    }
}

// Start
startListener().catch(console.error);
