
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
import type { ActivityTrade } from '../src/services/realtime-service-v2.js';
import { TradingService, RateLimiter, createUnifiedCache } from '../src/index.js';

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

            if (TRADING_PRIVATE_KEY && tradingService && trade.asset) {
                try {
                    // Direct execution via TradingService
                    const slippage = 0.02; // 2%
                    const size = copySize / trade.price; // Convert $ to shares

                    const result = await tradingService.createLimitOrder({
                        tokenId: trade.asset,
                        side: copySide as 'BUY' | 'SELL',
                        price: trade.price,
                        size: size,
                    });

                    if (result.success) {
                        await prisma.copyTrade.update({
                            where: { id: copyTrade.id },
                            data: {
                                status: 'EXECUTED',
                                executedAt: new Date(),
                                txHash: result.transactionHashes?.[0] || result.orderId,
                            },
                        });
                        stats.tradesExecuted++;
                        console.log(`   ✅ Executed! Order: ${result.orderId}`);
                    } else {
                        await prisma.copyTrade.update({
                            where: { id: copyTrade.id },
                            data: {
                                status: 'FAILED',
                                errorMessage: result.errorMsg,
                            },
                        });
                        stats.tradesFailed++;
                        console.log(`   ❌ Failed: ${result.errorMsg}`);
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
            console.log(`   Trading Wallet: ${tradingService.getAddress()}`);
        } catch (error) {
            console.error('   ⚠️ Failed to initialize TradingService:', error);
            tradingService = null;
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
