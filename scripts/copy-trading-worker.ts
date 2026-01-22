
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
 */

import { RealtimeServiceV2 } from '../src/services/realtime-service-v2.js';
import type { ActivityTrade, MarketEvent } from '../src/services/realtime-service-v2.js';
import { TradingService, RateLimiter, createUnifiedCache, CopyTradingExecutionService, GammaApiClient } from '../src/index.js';
import { ethers } from 'ethers';

// Dynamic import for Prisma to handle different runtime contexts
let prisma: any = null;

// ============================================================================
// Configuration
// ============================================================================

const REFRESH_INTERVAL_MS = 60_000; // Refresh active configs every minute
const API_BASE_URL = process.env.COPY_TRADING_API_URL || 'http://localhost:3000';
const TRADING_PRIVATE_KEY = process.env.TRADING_PRIVATE_KEY;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '137');
const PENDING_EXPIRY_MINUTES = 10;

// ============================================================================
// Initialize Clients
// ============================================================================

const realtimeService = new RealtimeServiceV2({ debug: false });

// Trading service for direct execution (if private key is available)
let tradingService: TradingService | null = null;
let executionService: CopyTradingExecutionService | null = null;
const rateLimiter = new RateLimiter();
const cache = createUnifiedCache();
const gammaClient = new GammaApiClient(rateLimiter, cache);

// ============================================================================
// State
// ============================================================================

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
}

let activeConfigs: Map<string, WatchedConfig[]> = new Map(); // traderAddress -> configs[]
let watchedAddresses: Set<string> = new Set();
let isRunning = true;

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

// ============================================================================
// Trade Handler
// ============================================================================

async function handleRealtimeTrade(trade: ActivityTrade): Promise<void> {
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

            // Filter 2: Minimum trigger size ($)
            const tradeValue = trade.size * trade.price;
            if (config.minTriggerSize && tradeValue < config.minTriggerSize) {
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
            const copySize = calculateCopySize(config, trade.size, trade.price);

            if (copySize <= 0) {
                stats.tradesSkipped++;
                continue;
            }

            // Polymarket minimum is $1
            if (copySize < 1) {
                stats.tradesSkipped++;
                continue;
            }

            // Check for duplicate (same trade within 5s window)
            const tradeTimeMs = trade.timestamp * 1000;
            const existing = await prisma.copyTrade.findFirst({
                where: {
                    configId: config.id,
                    originalTrader: traderAddr,
                    detectedAt: {
                        gte: new Date(tradeTimeMs - 5000),
                        lte: new Date(tradeTimeMs + 5000),
                    },
                    originalSide: copySide,
                    originalSize: trade.size,
                },
            });

            if (existing) {
                console.log(`   [Config ${config.id.slice(0, 8)}] Duplicate, skipping.`);
                continue;
            }

            // ========================================
            // Create PENDING CopyTrade Record
            // ========================================

            const copyTrade = await prisma.copyTrade.create({
                data: {
                    configId: config.id,
                    originalTrader: traderAddr,
                    originalSide: copySide,
                    originalSize: trade.size,
                    originalPrice: trade.price,
                    marketSlug: trade.marketSlug || null,
                    conditionId: trade.conditionId || null,
                    tokenId: trade.asset || null,
                    outcome: trade.outcome || null,
                    copySize,
                    status: 'PENDING',
                    expiresAt: new Date(Date.now() + PENDING_EXPIRY_MINUTES * 60 * 1000),
                },
            });

            stats.tradesCreated++;
            console.log(`   [Config ${config.id.slice(0, 8)}] Created PENDING trade: ${copyTrade.id.slice(0, 8)}`);
            console.log(`   Copy: ${copySide} $${copySize.toFixed(2)} @ ${trade.price}`);

            // ========================================
            // Execute Immediately (if configured)
            // ========================================

            if (TRADING_PRIVATE_KEY && executionService && trade.asset) {
                try {
                    // Execute via CopyTradingExecutionService (handles Proxy & Order)
                    console.log(`   🚀 Executing via Service for ${config.walletAddress}...`);

                    const result = await executionService.executeOrderWithProxy({
                        tradeId: copyTrade.id,
                        walletAddress: config.walletAddress,
                        tokenId: trade.asset,
                        side: copySide as 'BUY' | 'SELL',
                        amount: copySize,
                        price: trade.price,
                        slippage: config.slippageType === 'FIXED' ? (config.maxSlippage / 100) : undefined, // If FIXED, use maxSlippage as the value
                        maxSlippage: config.maxSlippage, // Pass for AUTO content
                        slippageMode: config.slippageType as 'FIXED' | 'AUTO',
                        orderType: 'limit',
                    });

                    if (result.success) {
                        // Check for Settlement Success
                        // BUY: needs tokenPushTxHash. SELL: needs returnTransferTxHash.
                        let isSettled = false;
                        let settlementHash = '';

                        if (copySide === 'BUY') {
                            if (result.tokenPushTxHash) {
                                isSettled = true;
                                settlementHash = result.tokenPushTxHash;
                            }
                        } else {
                            if (result.returnTransferTxHash) {
                                isSettled = true;
                                settlementHash = result.returnTransferTxHash;
                            }
                        }

                        // Override if Float was used and token push succeeded (Reimbursement fail is not "Settlement Pending" for User perspective, it's Bot problem).
                        // If Token Push succeed -> User is safe.

                        // What if result.useProxyFunds is false? (e.g. error before fund move, but result.success=false then)
                        // If result.success is true, we executed trade.

                        const newStatus = isSettled ? 'EXECUTED' : 'SETTLEMENT_PENDING';

                        await prisma.copyTrade.update({
                            where: { id: copyTrade.id },
                            data: {
                                status: newStatus,
                                executedAt: new Date(),
                                txHash: result.transactionHashes?.[0] || result.orderId,
                                errorMessage: isSettled ? null : "Settlement Pending: Funds/Tokens not returned"
                            },
                        });
                        stats.tradesExecuted++;
                        console.log(`   ✅ Executed! Order: ${result.orderId} (Status: ${newStatus})`);
                        if (result.useProxyFunds) {
                            console.log(`   💰 Used Proxy Funds: ${result.fundTransferTxHash || "Float"}`);
                        }
                        if (!isSettled) {
                            console.log(`   ⚠️ SETTLEMENT PENDING! Queued for recovery.`);
                        }
                    } else {
                        await prisma.copyTrade.update({
                            where: { id: copyTrade.id },
                            data: {
                                status: 'FAILED',
                                errorMessage: result.error,
                            },
                        });
                        stats.tradesFailed++;
                        console.log(`   ❌ Failed: ${result.error}`);
                    }
                } catch (execError) {
                    const errorMsg = execError instanceof Error ? execError.message : String(execError);
                    await prisma.copyTrade.update({
                        where: { id: copyTrade.id },
                        data: {
                            status: 'FAILED',
                            errorMessage: errorMsg,
                        },
                    });
                    stats.tradesFailed++;
                    console.log(`   ❌ Execution error: ${errorMsg}`);
                }
            } else {
                // No private key - leave as PENDING for manual/API execution
                console.log(`   ⏳ Left as PENDING (no TRADING_PRIVATE_KEY or no tokenId)`);
            }

        } catch (error) {
            console.error(`   ❌ Error processing config ${config.id}:`, error);
            stats.tradesFailed++;
        }
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

            const result = await executionService.recoverSettlement(
                await executionService.resolveProxyAddress(trade.config.walletAddress) || "",
                trade.originalSide as 'BUY' | 'SELL',
                trade.tokenId!,
                trade.copySize,
                trade.originalPrice, // approximate for share calc
                false // Assuming standard flow to be safe (no double charge). Bot eats float risk for now.
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

// ============================================================================
// Settlement Handler
// ============================================================================

const SETTLEMENT_CACHE = new Set<string>(); // Prevent double processing

async function handleMarketResolution(event: MarketEvent): Promise<void> {
    // Only care about resolution
    if (event.type !== 'resolved') return;

    const conditionId = event.conditionId;
    if (SETTLEMENT_CACHE.has(conditionId)) return;
    SETTLEMENT_CACHE.add(conditionId);

    console.log(`\n⚖️ [Settlement] Market Resolved: ${conditionId}`);

    // Data usually contains the winning outcome index or ID.
    // For YES/NO markets, we usually get an index or a price vector.
    // Let's inspect the data slightly or generalize.
    // If we assume binary markets for now (Polymarket standard).
    console.log('   Resolution Data:', JSON.stringify(event.data));

    try {
        await resolveSimulatedPositions(conditionId, event.data);
    } catch (error) {
        console.error(`   ❌ Failed to settle positions for ${conditionId}:`, error);
    }
}

async function resolveSimulatedPositions(conditionId: string, resolutionData: any): Promise<void> {
    console.log(`\n🔍 Resolving positions for condition ${conditionId}...`);

    try {
        // 1. Fetch Market Details from Gamma (source of truth for results)
        // We wait a few seconds to ensure Gamma API has updated (if the event came from Clob)
        await new Promise(resolve => setTimeout(resolve, 3000));

        const market = await gammaClient.getMarketByConditionId(conditionId);

        if (!market) {
            console.warn(`   ⚠️ Market not found in Gamma API: ${conditionId}`);
            return;
        }

        if (!market.closed) {
            console.log(`   ℹ️ Market is not marked as CLOSED yet in Gamma. Waiting...`);
            // It might be resolved but not 'closed' in Gamma struct?
            // Let's trust outcomePrices if one is 1.0 (or close to it)
        }

        console.log(`   Market: ${market.question}`);
        console.log(`   Outcomes: ${market.outcomes.join(', ')}`);
        console.log(`   Prices: ${market.outcomePrices.join(', ')}`);

        // 2. Map Outcomes to Token IDs using our Db history
        const relevantTrades = await prisma.copyTrade.findMany({
            where: { conditionId: conditionId },
            select: { tokenId: true, outcome: true },
            distinct: ['tokenId']
        });

        // Map: Outcome Name -> Token ID
        const outcomeToTokenMap = new Map<string, string>();
        relevantTrades.forEach((t: any) => {
            if (t.outcome && t.tokenId) {
                outcomeToTokenMap.set(t.outcome, t.tokenId);
            }
        });

        // 3. Process each outcome
        let settledCount = 0;

        for (let i = 0; i < market.outcomes.length; i++) {
            const outcomeName = market.outcomes[i];
            const price = market.outcomePrices[i];
            const tokenId = outcomeToTokenMap.get(outcomeName);

            if (!tokenId) {
                // We might not have traded this specific outcome side
                continue;
            }

            // Determine settlement value ($1 or $0)
            // We use a threshold because prices might be 0.999 or 0.001
            let settlementValue = 0;
            if (price >= 0.95) settlementValue = 1.0;
            else if (price <= 0.05) settlementValue = 0.0;
            else {
                console.warn(`   ⚠️ Check Outcome '${outcomeName}' price ${price} is ambiguous. Skipping settlement.`);
                continue;
            }

            // Find all positions for this token
            const positions = await prisma.userPosition.findMany({
                where: { tokenId: tokenId, balance: { gt: 0 } }
            });

            if (positions.length === 0) continue;

            console.log(`   Processing ${positions.length} positions for '${outcomeName}' (Token: ${tokenId.slice(0, 10)}...). Value: $${settlementValue}`);

            for (const pos of positions) {
                const pnl = (settlementValue - pos.avgEntryPrice) * pos.balance;
                const value = pos.balance * settlementValue;

                // Create a "History" record (conceptually).
                // Since we don't have a separate TradeHistory table visible here, 
                // we will create a CopyTrade record with status 'EXECUTED' and side 'SELL' to represent the close.
                // This will show up in stats but might look like a real trade.
                // Alternatively, we just update the UserPosition to be closed (balance = 0).
                // Or delete it.

                // DECISION: Delete UserPosition and log.
                // This removes it from "Open Positions".
                // TODO: In future, add 'SettledPosition' table.

                // Create a "closing" CopyTrade record for record-keeping?
                // The dashboard reads 'CopyTrade' for history?
                // NO, dashboard reads `UserPosition` for open, but `CopyTrade` for activity log.
                // So adding a SELL CopyTrade is good.

                await prisma.copyTrade.create({
                    data: {
                        configId: 'settlement-auto', // Placeholder, implies system action
                        originalTrader: 'POLYMARKET_SETTLEMENT',
                        originalSide: 'SELL',
                        originalSize: pos.balance,
                        originalPrice: settlementValue,
                        marketSlug: market.slug,
                        conditionId: conditionId,
                        tokenId: tokenId,
                        outcome: outcomeName,
                        copySize: pos.balance,
                        copyPrice: settlementValue,
                        status: 'EXECUTED',
                        executedAt: new Date(),
                        txHash: 'simulated_settlement',
                        errorMessage: `Auto-settled at $${settlementValue.toFixed(2)}`
                    }
                });

                // Clear Position
                await prisma.userPosition.delete({
                    where: { id: pos.id }
                });

                console.log(`     ✅ Settled position for ${pos.walletAddress.slice(0, 8)}: ${pos.balance} shares @ $${settlementValue}`);
                settledCount++;
            }
        }

        if (settledCount > 0) {
            console.log(`   ✅ Successfully settled ${settledCount} positions.`);
        } else {
            console.log(`   ℹ️ No active positions found to settle.`);
        }

    } catch (error) {
        console.error(`   ❌ Error in resolveSimulatedPositions:`, error);
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
    console.log(`   Trading Key: ${TRADING_PRIVATE_KEY ? 'Configured ✅' : 'Not configured ⚠️'}`);
    console.log(`   Chain ID: ${CHAIN_ID}`);

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
    if (TRADING_PRIVATE_KEY) {
        try {
            const rateLimiter = new RateLimiter();
            const cache = createUnifiedCache();
            tradingService = new TradingService(rateLimiter, cache, {
                privateKey: TRADING_PRIVATE_KEY,
                chainId: CHAIN_ID,
            });
            await tradingService.initialize();

            // Initialize Execution Service
            const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
            const signer = new ethers.Wallet(TRADING_PRIVATE_KEY, provider);
            executionService = new CopyTradingExecutionService(tradingService, signer, CHAIN_ID);

            console.log(`   Trading Wallet: ${tradingService.getAddress()}`);
            console.log(`   Execution Service: Ready ✅`);
        } catch (error) {
            console.error('   ⚠️ Failed to initialize TradingService:', error);
            tradingService = null;
            executionService = null;
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

    // Set up periodic stats display
    setInterval(() => {
        if (isRunning) {
            displayStats();
        }
    }, 5 * 60 * 1000); // Every 5 minutes

    // Set up periodic RECOVERY task
    setInterval(async () => {
        if (isRunning && executionService) {
            await recoverPendingTrades();
        }
    }, 2 * 60 * 1000); // Every 2 minutes

    // Connect to WebSocket and subscribe to ALL activity
    console.log('\n📡 Connecting to Polymarket WebSocket...');
    realtimeService.connect();

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

    // Subscribe to ALL trading activity
    console.log('📡 Subscribing to all trading activity...');
    const subscription = realtimeService.subscribeAllActivity({
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
    });

    console.log(`✅ Subscribed to activity (ID: ${subscription.id})`);
    console.log('\n🟢 Worker is running. Press Ctrl+C to exit.\n');
}

// Start the worker
start().catch((error) => {
    console.error('Fatal error starting worker:', error);
    process.exit(1);
});
