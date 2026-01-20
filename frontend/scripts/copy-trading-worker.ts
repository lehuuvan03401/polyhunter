
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
import { RealtimeServiceV2, ActivityTrade } from '../../src/services/realtime-service-v2';

// --- CONFIG ---
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
const TRADING_PRIVATE_KEY = process.env.TRADING_PRIVATE_KEY;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '137');
const POLL_INTERVAL_MS = 30000; // Refresh configs every 30s
const GAMMA_API_URL = 'https://gamma-api.polymarket.com';

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
const realtimeService = new RealtimeServiceV2({ autoReconnect: true });

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

// Cache to prevent API spam and rate limits
const metadataCache = new Map<string, { marketSlug: string; conditionId: string; outcome: string; marketQuestion: string; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache (metadata rarely changes)

async function getMarketMetadata(tokenId: string): Promise<{ marketSlug: string; conditionId: string; outcome: string; marketQuestion: string }> {
    // 1. Check Cache
    const cached = metadataCache.get(tokenId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return cached;
    }

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

        if (market) {
            // 3. Determine Outcome
            // ClobMarket tokens: [{token_id, outcome}, ...]
            const tokenData = market.tokens?.find((t: any) => t.token_id === tokenId);
            const outcome = tokenData?.outcome || 'Yes';
            const slug = market.market_slug || '';
            const question = market.question || '';

            const data = {
                marketSlug: slug,
                conditionId: conditionId,
                outcome: outcome,
                marketQuestion: question
            };
            // Cache valid CLOB result
            if (slug) metadataCache.set(tokenId, { ...data, timestamp: Date.now() });

            return data;
        }

        return {
            marketSlug: '',
            conditionId: conditionId,
            outcome: 'Yes',
            marketQuestion: ''
        };
    } catch (e) {
        console.warn(`[Worker] ⚠️ CLOB Metadata fetch failed for ${tokenId}, trying Gamma...`);
    }

    // 4. Fallback to Gamma API
    try {
        const orderbook = await tradingService.getOrderBook(tokenId) as any;
        const conditionId = orderbook.market;

        if (conditionId) {
            const url = `${GAMMA_API_URL}/markets?condition_id=${conditionId}`;
            const resp = await fetch(url);
            if (resp.ok) {
                const data = await resp.json();
                let marketData: any = null;
                if (Array.isArray(data) && data.length > 0) marketData = data[0];
                else if (data.slug) marketData = data;

                if (marketData) {
                    const tokenData = (marketData.tokens || []).find((t: any) => (t.tokenId || t.token_id) === tokenId);
                    return {
                        marketSlug: marketData.slug || '',
                        conditionId: conditionId,
                        outcome: tokenData?.outcome || 'Yes',
                        marketQuestion: marketData.question || ''
                    };
                }
            }
        }
    } catch (e) {
        console.warn(`[Worker] ⚠️ Gamma Metadata fetch failed for ${tokenId}:`, e);
    }

    return { marketSlug: '', conditionId: '', outcome: 'Yes', marketQuestion: '' };
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

// --- EVENT LISTENER ---

async function startListener() {
    // 1. Initialize Services
    await tradingService.initialize();
    await refreshConfigs();

    // 2. Setup WebSocket Listener
    console.log('[Worker] 🔌 Connecting to Polymarket WebSocket...');
    realtimeService.connect();

    realtimeService.subscribeAllActivity({
        onTrade: async (trade) => {
            try {
                await handleWebsocketTrade(trade);
            } catch (err) {
                console.error('[Worker] Error handling trade:', err);
            }
        },
        onError: (err) => {
            console.error('[Worker] ❌ WebSocket error:', err);
        }
    });

    console.log('[Worker] 🎧 Listening for Global Trade Activity...');

    // 3. Periodic Config Refresh
    setInterval(refreshConfigs, POLL_INTERVAL_MS);
}

// --- EVENT HANDLER ---

async function handleWebsocketTrade(trade: ActivityTrade) {
    // 1. Check if trader is monitored
    // trade.trader.address is the maker/taker who initiated?
    // ActivityTrade usually has 'trader' object with address.
    const traderAddress = trade.trader?.address?.toLowerCase();

    if (!traderAddress || !monitoredAddresses.has(traderAddress)) {
        return;
    }

    const tokenId = trade.asset;
    const price = trade.price;
    const sizeShares = trade.size;
    const side = trade.side; // BUY or SELL
    const txHash = trade.transactionHash;

    console.log(`[Worker] 🔔 Detected Trade! Tx: ${txHash?.slice(0, 8)}...`);
    console.log(`[Worker] 🎯 Target: ${traderAddress} | Side: ${side} | Token: ${tokenId} | Size: ${sizeShares.toFixed(2)} | Price: $${price.toFixed(4)}`);

    // Find configs for this trader
    const configs = activeConfigs.filter(c => c.traderAddress.toLowerCase() === traderAddress);

    for (const config of configs) {
        try {
            // Apply Basic Filters
            if (config.sideFilter && config.sideFilter !== side) continue;

            const tradeValue = sizeShares * price;
            if (config.minTriggerSize && tradeValue < config.minTriggerSize) continue;

            // Logic for COUNTER trade
            let copySide = side;
            if (config.direction === 'COUNTER') {
                copySide = side === 'BUY' ? 'SELL' : 'BUY';
            }

            // Calc Size
            const copySizeUsdc = calculateCopySize(config, sizeShares, price);
            if (copySizeUsdc <= 0) continue;

            console.log(`[Worker] 🚀 Auto-Executing for ${config.walletAddress}: ${copySide} $${copySizeUsdc.toFixed(2)}`);

            // 1.5 Fetch Metadata (Or use trade data if available)
            // ActivityTrade has marketSlug and outcome!
            let metadata = {
                marketSlug: trade.marketSlug || '',
                conditionId: trade.conditionId || '',
                outcome: trade.outcome || '',
                marketQuestion: ''
            };

            // If missing, try fetch (fallback)
            if (!metadata.marketSlug || !metadata.conditionId) {
                const fetched = await getMarketMetadata(tokenId);
                metadata = { ...metadata, ...fetched };
            }

            console.log(`[Worker] ℹ️  Market: ${metadata.marketSlug} | ${metadata.outcome}`);

            // 1. Execute
            const result = await executionService.executeOrderWithProxy({
                tradeId: 'auto-' + Date.now(),
                walletAddress: config.walletAddress,
                tokenId: tokenId,
                side: copySide,
                amount: copySizeUsdc,
                price: price, // Use trade execution price as reference
                slippage: config.slippageType === 'FIXED' ? (config.maxSlippage / 100) : undefined,
                maxSlippage: config.maxSlippage,
                slippageMode: config.slippageType as 'FIXED' | 'AUTO',
                orderType: 'market',
            });

            // 2. Log to DB
            await prisma.copyTrade.create({
                data: {
                    configId: config.id,
                    originalTrader: traderAddress,
                    originalSide: side,
                    originalSize: sizeShares,
                    originalPrice: price,
                    tokenId: tokenId,
                    copySize: copySizeUsdc,
                    status: result.success ? 'EXECUTED' : 'FAILED',
                    executedAt: result.success ? new Date() : null,
                    txHash: result.transactionHashes?.[0] || txHash || 'ws-event',
                    errorMessage: result.error,
                    detectedAt: new Date(),
                    marketSlug: metadata.marketSlug,
                    conditionId: metadata.conditionId,
                    outcome: metadata.outcome,
                }
            });

            if (result.success) {
                // 3. Update Position
                try {
                    const sharesBought = copySizeUsdc / price; // Est shares based on ref price (approx)
                    // Note: Actual execution price might differ slightly, but for tracking this is close enough

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
                            amount: sharesBought,
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
