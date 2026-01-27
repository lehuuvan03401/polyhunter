
/**
 * Copy Trading Worker (Standalone)
 * 
 * Listens to Real-time Blockchain Events to trigger Copy Trades immediately.
 * 
 * Usage: npx ts-node scripts/copy-trading-worker.ts
 */

import './env-setup'; // Load Env FIRST
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

import { CONTRACT_ADDRESSES, CTF_ABI } from '../../src/core/contracts';
import { CopyTradingExecutionService } from '../../src/services/copy-trading-execution-service';
import { TradingService } from '../../src/services/trading-service';
import { RateLimiter } from '../../src/core/rate-limiter';
import { createUnifiedCache } from '../../src/core/unified-cache';
import { PositionService } from '../lib/services/position-service';
import { RealtimeServiceV2, ActivityTrade, MarketEvent } from '../../src/services/realtime-service-v2';
import { GammaApiClient } from '../../src/index';

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
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
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
const gammaClient = new GammaApiClient(rateLimiter, cache);

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
// Settlement Handler
// ============================================================================

const SETTLEMENT_CACHE = new Set<string>();

async function handleMarketResolution(event: MarketEvent): Promise<void> {
    if (event.type !== 'resolved') return;

    const conditionId = event.conditionId;
    if (SETTLEMENT_CACHE.has(conditionId)) return;
    SETTLEMENT_CACHE.add(conditionId);

    console.log(`\n⚖️ [Settlement] Market Resolved: ${conditionId}`);

    try {
        await resolvePositions(conditionId);
    } catch (error) {
        console.error(`   ❌ Failed to settle positions for ${conditionId}:`, error);
    }
}

async function resolvePositions(conditionId: string): Promise<void> {
    console.log(`\n🔍 Resolving positions for condition ${conditionId}...`);

    try {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const market = await gammaClient.getMarketByConditionId(conditionId);

        if (!market) {
            console.warn(`   ⚠️ Market not found in Gamma API: ${conditionId}`);
            return;
        }

        console.log(`   Market: ${market.question}`);
        console.log(`   Outcomes: ${market.outcomes.join(', ')}`);
        console.log(`   Prices: ${market.outcomePrices.join(', ')}`);
        console.log(`   Closed: ${market.closed}`);

        // Map Outcomes to Token IDs
        const relevantTrades = await prisma.copyTrade.findMany({
            where: { conditionId: conditionId },
            select: { tokenId: true, outcome: true },
            distinct: ['tokenId']
        });

        const outcomeToTokenMap = new Map<string, string>();
        relevantTrades.forEach((t) => {
            if (t.outcome && t.tokenId) {
                outcomeToTokenMap.set(t.outcome, t.tokenId);
            }
        });

        // Determine winners
        for (let i = 0; i < market.outcomes.length; i++) {
            const outcomeName = market.outcomes[i];
            const price = Number(market.outcomePrices[i]);
            const tokenId = outcomeToTokenMap.get(outcomeName);

            // Check for explicit winner flag if available in tokens
            const tokenData = (market as any).tokens?.find((t: any) => t.tokenId === tokenId || t.token_id === tokenId);
            const isWinnerInfo = tokenData?.winner;

            if (!tokenId) continue;

            let settlementType: 'WIN' | 'LOSS' | 'NONE' = 'NONE';
            let settlementValue = 0.0;

            // Robust Winner Logic matches Simulation
            if (price >= 0.95 || isWinnerInfo === true) {
                settlementType = 'WIN';
                settlementValue = 1.0;
            } else if (price <= 0.05 || (isWinnerInfo === false && market.closed)) {
                settlementType = 'LOSS';
                settlementValue = 0.0;
            } else {
                continue; // Uncertain
            }

            // Find positions
            const positions = await prisma.userPosition.findMany({
                where: { tokenId: tokenId, balance: { gt: 0 } }
            });

            if (positions.length === 0) continue;

            console.log(`   Processing ${positions.length} positions for '${outcomeName}' (Token: ${tokenId.slice(0, 10)}...). Type: ${settlementType}`);

            for (const pos of positions) {
                let txHash = settlementType === 'LOSS' ? 'settled-loss' : 'redeem-pending';
                let errorMsg: string | undefined = undefined;

                const proceeds = pos.balance * settlementValue;
                const pnl = proceeds - pos.totalCost;

                const configId = await resolveConfigIdForPosition(pos.walletAddress, tokenId);
                if (!configId) {
                    console.warn(`     ⚠️ No config found for ${pos.walletAddress}. Skipping settlement record.`);
                    continue;
                }

                // 1. ON-CHAIN EXECUTION (Only for Wins)
                if (settlementType === 'WIN') {
                    console.log(`     🎉 Executing On-Chain Redemption for ${pos.walletAddress}...`);

                    // Resolve Proxy
                    const proxyAddress = await executionService.resolveProxyAddress(pos.walletAddress);
                    if (proxyAddress) {
                        const indexSet = [1 << i]; // Bitmask for index i
                        const result = await executionService.redeemPositions(
                            proxyAddress,
                            conditionId,
                            indexSet
                        );

                        if (result.success) {
                            txHash = result.txHash || 'redeem-tx';
                            console.log(`       ✅ Tx: ${txHash}`);
                        } else {
                            console.error(`       ❌ Redemption Failed: ${result.error}`);
                            errorMsg = result.error;
                            // Ensure we don't delete position if on-chain fail? 
                            // Actually if on-chain fails, we should probably NOT delete the position DB record 
                            // so we can retry? 
                            // But for now, let's log error and maybe NOT delete if critical?
                            // Currently simulation DELETES anyway. logic below deletes.
                            // Let's keep deleting to avoid double-processing loop for now, 
                            // but in prod we'd want a retry queue.
                        }
                    } else {
                        console.error(`       ❌ No Proxy found for ${pos.walletAddress}`);
                        errorMsg = "No Proxy Found";
                    }
                }

                // 2. Log Settlement Trade
                await prisma.copyTrade.create({
                    data: {
                        configId: configId,
                        originalTrader: 'POLYMARKET_SETTLEMENT',
                        originalSide: 'SELL', // Settlement is effectively a sell
                        originalSize: pos.balance,
                        originalPrice: settlementValue,
                        marketSlug: market.slug,
                        conditionId: conditionId,
                        tokenId: tokenId,
                        outcome: outcomeName,
                        copySize: proceeds,
                        copyPrice: settlementValue,
                        status: (errorMsg ? 'FAILED' : 'EXECUTED'),
                        executedAt: new Date(),
                        txHash: txHash,
                        errorMessage: errorMsg || (settlementType === 'WIN' ? `Redeemed (Profit $${pnl.toFixed(2)})` : `Settled Loss ($${pnl.toFixed(2)})`),
                        realizedPnL: errorMsg ? undefined : pnl
                    }
                });

                // 3. Clear Position (If success or Loss)
                // If it was a WIN but failed on-chain, maybe we shouldn't delete?
                // But if we don't delete, we might infinite loop if we re-run.
                // For this upgrades, let's assume if it failed, we still mark as "Processed" 
                // but maybe with a flag? 
                // Safest for User Funds: If WIN and Failed, DO NOT delete.
                if (settlementType === 'WIN' && errorMsg) {
                    console.warn(`       ⚠️ Skipping DB deletion due to on-chain failure.`);
                    continue;
                }

                await prisma.userPosition.delete({
                    where: { id: pos.id }
                });

                console.log(`     ✅ DB Updated: PnL $${pnl.toFixed(2)}`);
            }
        }
    } catch (error) {
        console.error(`   ❌ Error in resolvePositions:`, error);
    }
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

    // Subscribe to Market Events
    console.log('[Worker] 🔌 Subscribing to Market Events...');
    realtimeService.subscribeMarketEvents({
        onMarketEvent: async (event) => {
            try {
                await handleMarketResolution(event);
            } catch (err) {
                console.error('[Worker] Error handling market event:', err);
            }
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
                    originalSide: copySide,
                    originalSize: sizeShares,
                    originalPrice: price,
                    tokenId: tokenId,
                    copySize: copySizeUsdc,
                    copyPrice: price,
                    usedBotFloat: result.usedBotFloat ?? false,
                    status: result.success ? 'EXECUTED' : 'FAILED',
                    executedAt: result.success ? new Date() : null,
                    txHash: result.transactionHashes?.[0] || txHash || 'ws-event',
                    errorMessage: result.error,
                    originalTxHash: txHash || null,
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
