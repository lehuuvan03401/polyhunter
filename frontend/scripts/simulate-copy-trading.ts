/**
 * Comprehensive Copy Trading Simulation
 * 
 * Real-time tracking of a target trader with:
 * - Database recording of all copy trades
 * - Position tracking and cost basis calculation
 * - Simulated settlement (using market prices)
 * - P&L analysis report
 * 
 * Usage:
 * export $(grep -v '^#' .env | xargs)
 * npx tsx scripts/simulate-copy-trading.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { RealtimeServiceV2 } from '../../src/services/realtime-service-v2.ts';
import type { ActivityTrade, MarketEvent } from '../../src/services/realtime-service-v2.ts';
import { GammaApiClient } from '../../src/index';
import { RateLimiter } from '../../src/core/rate-limiter';
import { createUnifiedCache } from '../../src/core/unified-cache';

// --- CONFIG ---
const TARGET_TRADER = process.env.TARGET_TRADER || '0x63ce342161250d705dc0b16df89036c8e5f9ba9a';
const FOLLOWER_WALLET = process.env.FOLLOWER_WALLET || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const SIMULATION_DURATION_MS = parseInt(process.env.SIMULATION_DURATION_MS || '2100000'); // 35 minutes
const BUY_WINDOW_MS = 15 * 60 * 1000; // Stop buying after 15 minutes
const FIXED_COPY_AMOUNT = parseFloat(process.env.FIXED_COPY_AMOUNT || '10'); // $10 per trade
const SLIPPAGE_BPS = 50; // 0.5% slippage (50 basis points)
const ESTIMATED_GAS_FEE_USD = 0.05; // $0.05 per transaction (Polygon gas + overhead)

// No validation needed - using local dev.db

console.log('═══════════════════════════════════════════════════════════════');
console.log('🎮 COMPREHENSIVE COPY TRADING SIMULATION');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`Target Trader: ${TARGET_TRADER}`);
console.log(`Follower Wallet: ${FOLLOWER_WALLET}`);
console.log(`Duration: ${(SIMULATION_DURATION_MS / 1000 / 60).toFixed(0)} minutes`);
console.log(`Fixed Copy Amount: $${FIXED_COPY_AMOUNT}`);
console.log('═══════════════════════════════════════════════════════════════\n');

// --- PRISMA ---
import path from 'path';

console.log('DEBUG: DATABASE_URL loaded:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

// --- SERVICES ---
const rateLimiter = new RateLimiter();
const cache = createUnifiedCache();
const gammaClient = new GammaApiClient(rateLimiter, cache);

// --- TRACKING STATE ---
interface Position {
    tokenId: string;
    balance: number;        // shares
    avgEntryPrice: number;  // cost basis
    totalCost: number;      // total USDC spent
    marketSlug: string;
}

const positions = new Map<string, Position>();
let configId: string;

// --- METRICS ---
let tradesRecorded = 0;
let totalBuyVolume = 0;
let totalSellVolume = 0;
let realizedPnL = 0;
const startTime = Date.now();

// --- SEED CONFIG ---
async function seedConfig() {
    console.log('📝 Setting up copy trading config...');

    const targetLower = TARGET_TRADER.toLowerCase();
    const followerLower = FOLLOWER_WALLET.toLowerCase();

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

    // Create fresh config
    const config = await prisma.copyTradingConfig.create({
        data: {
            walletAddress: followerLower,
            traderAddress: targetLower,
            traderName: '0x8dxd (Simulation)',
            maxSlippage: 2.0,
            slippageType: 'AUTO',
            autoExecute: false, // Don't let worker pick this up
            channel: 'EVENT_LISTENER',
            mode: 'FIXED_AMOUNT',
            fixedAmount: FIXED_COPY_AMOUNT,
            isActive: true,
        }
    });

    configId = config.id;
    console.log(`✅ Created config: ${configId}\n`);
    return config;
}

// --- POSITION MANAGEMENT ---
function updatePositionOnBuy(tokenId: string, shares: number, price: number, marketSlug: string) {
    const existing = positions.get(tokenId);

    if (existing) {
        // Update weighted average price
        const newTotalCost = existing.totalCost + (shares * price);
        const newBalance = existing.balance + shares;
        existing.avgEntryPrice = newTotalCost / newBalance;
        existing.balance = newBalance;
        existing.totalCost = newTotalCost;
    } else {
        positions.set(tokenId, {
            tokenId,
            balance: shares,
            avgEntryPrice: price,
            totalCost: shares * price,
            marketSlug,
        });
    }
}

function updatePositionOnSell(tokenId: string, shares: number, price: number): number {
    const existing = positions.get(tokenId);

    if (!existing || existing.balance <= 0) {
        console.log(`   ⚠️  No position to sell for token ${tokenId.substring(0, 20)}...`);
        return 0;
    }

    const sharesToSell = Math.min(shares, existing.balance);
    const costBasis = sharesToSell * existing.avgEntryPrice;
    const proceeds = sharesToSell * price;
    const pnl = proceeds - costBasis;

    existing.balance -= sharesToSell;
    existing.totalCost -= costBasis;

    return pnl;
}

// Cache for market metadata to avoid repeated API calls
// Cache for market metadata to avoid repeated API calls
const marketCache = new Map<string, { slug: string; tokens: any[]; _isFailure?: boolean; timestamp?: number }>();
const CLOB_API_URL = 'https://clob.polymarket.com';

/**
 * Fetch market metadata from CLOB API
 */
const GAMMA_API_URL = 'https://gamma-api.polymarket.com';

/**
 * Fetch market metadata from CLOB API or Gamma API (Fallback)
 */
async function fetchMarketFromClob(conditionId: string): Promise<{ slug: string; tokens: any[] } | null> {
    // 1. Try CLOB API first
    try {
        const resp = await fetch(`${CLOB_API_URL}/markets/${conditionId}`);
        if (resp.ok) {
            const data = await resp.json();
            return {
                slug: data.market_slug || '',
                tokens: (data.tokens || []).map((t: any) => ({
                    tokenId: t.token_id,
                    outcome: t.outcome
                }))
            };
        } else {
            console.warn(`   ⚠️ CLOB API Error for ${conditionId}: ${resp.status} ${resp.statusText}`);
        }
    } catch (e) {
        // Ignore network errors, try fallback
    }

    // 2. Fallback to Gamma API
    try {
        const url = `${GAMMA_API_URL}/markets?condition_id=${conditionId}`;
        const resp = await fetch(url);
        if (resp.ok) {
            const data = await resp.json();

            let marketData: any = null;
            if (Array.isArray(data) && data.length > 0) {
                marketData = data[0];
            } else if (data.slug) {
                marketData = data;
            }

            if (marketData) {
                return {
                    slug: marketData.slug || '',
                    tokens: (marketData.tokens || []).map((t: any) => ({
                        tokenId: t.tokenId || t.token_id,
                        outcome: t.outcome
                    }))
                };
            } else {
                console.warn(`   ⚠️ Gamma API returned no market data for ${conditionId}`);
                const fs = require('fs');
                fs.appendFileSync('metadata-errors.log', `${new Date().toISOString()} - ${conditionId} - Gamma returned empty/invalid data: ${JSON.stringify(data)}\n`);
            }
        } else {
            console.warn(`   ⚠️ Gamma API Error for ${conditionId}: ${resp.status} ${resp.statusText}`);
            const fs = require('fs');
            fs.appendFileSync('metadata-errors.log', `${new Date().toISOString()} - ${conditionId} - Gamma API HTTP Error: ${resp.status}\n`);
        }
    } catch (e: any) {
        console.warn(`   ❌ Metadata fetch failed for ${conditionId}:`, e.message);
        // Log to file for debugging
        const fs = require('fs');
        fs.appendFileSync('metadata-errors.log', `${new Date().toISOString()} - ${conditionId} - ${e.message}\n`);
    }

    // 3. Cache Failure (Negative Cache for 5 mins) to prevent spamming
    marketCache.set(conditionId, { slug: '', tokens: [], _isFailure: true, timestamp: Date.now() });

    return null;
}

/**
 * Enrich trade with market metadata if missing
 * Uses conditionId to fetch from CLOB API
 */
async function enrichTradeMetadata(trade: ActivityTrade): Promise<{
    marketSlug: string | null;
    conditionId: string | null;
    outcome: string | null;
}> {
    // If we already have all data, return as-is
    if (trade.marketSlug && trade.conditionId && trade.outcome) {
        return {
            marketSlug: trade.marketSlug,
            conditionId: trade.conditionId,
            outcome: trade.outcome
        };
    }

    let conditionId = trade.conditionId;

    // 1. If Condition ID is missing, fetch it from Orderbook
    if (!conditionId) {
        try {
            const fetchUrl = `${CLOB_API_URL}/book?token_id=${trade.asset}`;
            const resp = await fetch(fetchUrl);
            if (resp.ok) {
                const book = await resp.json();
                console.log(`[DEBUG] /book resp for ${trade.asset}:`, JSON.stringify(book));
                conditionId = book.market; // 'market' field is conditionId
                if (!conditionId) {
                    console.warn(`[DEBUG] 'market' field missing in book for ${trade.asset}`);
                }
            } else {
                console.warn(`[DEBUG] /book fetch failed: ${resp.status} ${resp.statusText}`);
            }
        } catch (e) {
            console.warn(`Error fetching conditionId for ${trade.asset}:`, e);
        }
    }

    // 2. Now try to fetch metadata via conditionId
    if (conditionId) {
        // Check cache first
        if (marketCache.has(conditionId)) {
            const cached = marketCache.get(conditionId)!;
            const tokenOutcome = cached.tokens.find((t: any) => t.tokenId === trade.asset)?.outcome;
            return {
                marketSlug: cached.slug,
                conditionId: conditionId,
                outcome: tokenOutcome || trade.outcome || null
            };
        }

        const market = await fetchMarketFromClob(conditionId);
        if (market && market.slug) {
            marketCache.set(conditionId, market);
            const tokenOutcome = market.tokens.find((t: any) => t.tokenId === trade.asset)?.outcome;
            console.log(`   📦 Fetched market metadata: ${market.slug}`);
            return {
                marketSlug: market.slug,
                conditionId: conditionId,
                outcome: tokenOutcome || trade.outcome || null
            };
        }
    }

    // Return whatever we have
    return {
        marketSlug: trade.marketSlug || null,
        conditionId: conditionId || null,
        outcome: trade.outcome || null
    };
}

// --- DATABASE RECORDING ---
async function recordCopyTrade(trade: ActivityTrade, copyShares: number, pnl?: number) {
    try {
        // Enrich trade metadata if missing
        const enriched = await enrichTradeMetadata(trade);

        await prisma.copyTrade.create({
            data: {
                configId: configId,
                originalTrader: trade.trader?.address || '',
                originalSide: trade.side,
                originalSize: trade.size,
                originalPrice: trade.price,
                tokenId: trade.asset,
                conditionId: enriched.conditionId,
                marketSlug: enriched.marketSlug,
                outcome: enriched.outcome,
                copySize: FIXED_COPY_AMOUNT,
                copyPrice: trade.price,
                status: 'EXECUTED',
                txHash: `SIM-${trade.transactionHash}`,
                executedAt: new Date(),
            }
        });

        // Update or create position in DB
        const tokenId = trade.asset;
        const position = positions.get(tokenId);

        if (position) {
            await prisma.userPosition.upsert({
                where: {
                    walletAddress_tokenId: {
                        walletAddress: FOLLOWER_WALLET.toLowerCase(),
                        tokenId: tokenId,
                    }
                },
                update: {
                    balance: position.balance,
                    avgEntryPrice: position.avgEntryPrice,
                    totalCost: position.totalCost,
                },
                create: {
                    walletAddress: FOLLOWER_WALLET.toLowerCase(),
                    tokenId: tokenId,
                    balance: position.balance,
                    avgEntryPrice: position.avgEntryPrice,
                    totalCost: position.totalCost,
                }
            });
        }

        tradesRecorded++;
    } catch (err) {
        console.error('   ❌ Failed to record trade:', err);
    }
}

// --- TRADE HANDLER ---
async function handleTrade(trade: ActivityTrade) {
    const traderAddress = trade.trader?.address?.toLowerCase();
    const targetLower = TARGET_TRADER.toLowerCase();

    if (traderAddress !== targetLower) return;

    // Filter for 15m Options only (as requested by User)
    if (!trade.marketSlug?.includes('-15m-')) {
        // console.log(`[DEBUG] ⏭️  Skipped (Not 15m): ${trade.marketSlug}`);
        return;
    }

    // Safety Filter: Exclude outdated/political keywords to ensure realism
    const lowerSlug = trade.marketSlug.toLowerCase();
    if (lowerSlug.includes('biden') || lowerSlug.includes('trump') || lowerSlug.includes('election') || lowerSlug.includes('coronavirus')) {
        console.log(`[DEBUG] ⏭️  Skipped Outdated/Political: ${trade.marketSlug}`);
        return;
    }

    // Check for weird slugs (Optional debugging)
    // console.log(`[DEBUG] 🔎 Detected trade for target: ${trade.marketSlug} | Side: ${trade.side}`);

    // Skip trades without conditionId (can't get metadata)
    if (!trade.conditionId && !trade.marketSlug) {
        console.log(`\n⏭️  SKIPPED (no metadata): tokenId ${trade.asset.slice(0, 20)}...`);
        return;
    }

    const now = new Date();
    const elapsedMs = Date.now() - startTime;
    const elapsed = (elapsedMs / 1000).toFixed(0);

    // Stop buying after window closes
    if (trade.side === 'BUY' && elapsedMs > BUY_WINDOW_MS) {
        console.log(`\n🛑 Buy window closed (${(elapsedMs / 60000).toFixed(1)}m elapsed). Skipping BUY for ${trade.marketSlug}...`);
        return;
    }

    // Calculate copy shares based on fixed amount
    // APPLY SLIPPAGE MODEL
    const slipFactor = trade.side === 'BUY' ? (1 + SLIPPAGE_BPS / 10000) : (1 - SLIPPAGE_BPS / 10000);
    const execPrice = trade.price * slipFactor;
    const copyShares = FIXED_COPY_AMOUNT / execPrice;

    // 🔥 CRITICAL: Skip SELL trades if we don't have a position
    // In real copy trading, we only sell what we've bought
    if (trade.side === 'SELL') {
        const existing = positions.get(trade.asset);
        if (!existing || existing.balance <= 0) {
            console.log(`\n⏭️  SKIPPED SELL (no position): ${trade.marketSlug || trade.asset.substring(0, 20)}...`);
            return;
        }
    }

    console.log('\n🎯 ═══════════════════════════════════════════════════════════');
    console.log(`   [${elapsed}s] COPY TRADE EXECUTED (#${tradesRecorded + 1})`);
    console.log('   ───────────────────────────────────────────────────────────');
    console.log(`   ⏰ ${now.toISOString()}`);
    console.log(`   📊 ${trade.side} $${FIXED_COPY_AMOUNT.toFixed(2)} → ${copyShares.toFixed(2)} shares`);
    console.log(`      Price: $${trade.price.toFixed(4)} → Exec: $${execPrice.toFixed(4)} (Slippage ${SLIPPAGE_BPS / 100}%)`);
    console.log(`   📈 Market: ${trade.marketSlug || 'N/A'}`);
    console.log(`   🎯 Outcome: ${trade.outcome || 'N/A'}`);
    console.log(`   🔗 TX: ${trade.transactionHash?.substring(0, 30)}...`);

    // Process trade
    if (trade.side === 'BUY') {
        updatePositionOnBuy(trade.asset, copyShares, execPrice, trade.marketSlug || '');
        totalBuyVolume += FIXED_COPY_AMOUNT;

        const pos = positions.get(trade.asset)!;
        console.log(`   💼 Position: ${pos.balance.toFixed(2)} shares @ avg $${pos.avgEntryPrice.toFixed(4)}`);
    } else {
        const pnl = updatePositionOnSell(trade.asset, copyShares, execPrice);
        realizedPnL += pnl;
        totalSellVolume += FIXED_COPY_AMOUNT;

        const pos = positions.get(trade.asset);
        const remaining = pos ? pos.balance.toFixed(2) : '0';

        // Fee impact
        const netPnl = pnl - (ESTIMATED_GAS_FEE_USD * 2); // Deduct for Buy (past) and Sell (now) approx? 
        // Or just deduct current fee? Let's deduct 1x fee per action usually.
        // But PnL is realized, so it covers the full cycle cost.
        // Let's just log Gross vs Net for this specific trade action?
        // Actually, let's track Total Fees separately to deduct at end.

        console.log(`   💰 Gross P&L: $${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)}`);
        console.log(`   💼 Remaining: ${remaining} shares`);
    }

    console.log('   ═══════════════════════════════════════════════════════════\n');

    // Record to database
    // We record the EXECUTION price (simulated)
    await recordCopyTrade(trade, copyShares, trade.side === 'SELL' ? realizedPnL : undefined);
}

// --- SETTLEMENT HANDLER ---

const SETTLEMENT_CACHE = new Set<string>();

async function handleMarketResolution(event: MarketEvent): Promise<void> {
    if (event.type !== 'resolved') return;

    const conditionId = event.conditionId;
    if (SETTLEMENT_CACHE.has(conditionId)) return;
    SETTLEMENT_CACHE.add(conditionId);

    console.log(`\n⚖️ [Settlement] Market Resolved: ${conditionId}`);

    try {
        await resolveSimulatedPositions(conditionId);
    } catch (error) {
        console.error(`   ❌ Failed to settle positions for ${conditionId}:`, error);
    }
}

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

            // Also check current active positions if we missed the trade record mapping (fallback)
            // But usually simulation implies we traded it.

            if (!tokenId) continue;

            let settlementValue = 0;
            if (price >= 0.95) settlementValue = 1.0;
            else if (price <= 0.05) settlementValue = 0.0;
            else continue; // Not fully resolved yet?

            // Check if we hold this token
            const pos = positions.get(tokenId);
            if (!pos || pos.balance <= 0) continue;

            console.log(`   Processing Position: ${pos.balance.toFixed(2)} shares of '${outcomeName}'. Value: $${settlementValue}`);

            // Settle it
            const proceeds = pos.balance * settlementValue;
            const costBasis = pos.balance * pos.avgEntryPrice;
            const pnl = proceeds - costBasis;

            // Update Metrics
            realizedPnL += pnl;
            totalSellVolume += (pos.balance * settlementValue); // Volume @ exit price?

            console.log(`     ✅ Settled! PnL: $${pnl.toFixed(4)} (Proceeds: $${proceeds.toFixed(2)} - Cost: $${costBasis.toFixed(2)})`);

            // Log Settlement Trade
            await prisma.copyTrade.create({
                data: {
                    configId: configId,
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
                    txHash: 'sim-settlement',
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
            positions.delete(tokenId);
        }

    } catch (error) {
        console.error(`   ❌ Error in resolveSimulatedPositions:`, error);
    }
}

// --- PRINT SUMMARY ---
async function printSummary() {
    const duration = (Date.now() - startTime) / 1000 / 60;

    // Calculate unrealized P&L (use last trade price as market price)
    let unrealizedPnL = 0;
    for (const [tokenId, pos] of positions) {
        if (pos.balance > 0) {
            // For simplicity, assume current price = last entry price (would need orderbook for real mark-to-market)
            const marketValue = pos.balance * pos.avgEntryPrice;
            unrealizedPnL += marketValue - pos.totalCost;
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
    console.log('📊 SIMULATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Duration: ${duration.toFixed(1)} minutes`);
    console.log(`Trades Recorded: ${tradesRecorded}`);
    console.log(`Total Buy Volume: $${totalBuyVolume.toFixed(2)}`);
    console.log(`Total Sell Volume: $${totalSellVolume.toFixed(2)}`);
    const totalFees = tradesRecorded * ESTIMATED_GAS_FEE_USD;
    const netPnL = realizedPnL - totalFees;

    console.log(`Realized P&L (Gross): $${realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(4)}`);
    console.log(`Est. Fees (Gas): -$${totalFees.toFixed(2)}`);
    console.log(`Net P&L (Simulated): $${netPnL >= 0 ? '+' : ''}${netPnL.toFixed(4)}`);
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
        console.log('✅ SIMULATION COMPLETE - Data saved to database');
    } else {
        console.log('⚠️  No trades detected during simulation period');
    }
    console.log('═══════════════════════════════════════════════════════════════\n');
}

// --- MAIN ---
async function main() {
    // 1. Setup
    await seedConfig();

    // 2. Connect to WebSocket
    const realtimeService = new RealtimeServiceV2({
        autoReconnect: true,
        debug: false,
    });

    console.log('🔌 Connecting to Polymarket WebSocket...');
    realtimeService.connect();

    // 3. Subscribe to ALL activity
    realtimeService.subscribeAllActivity({
        onTrade: handleTrade,
        onError: (err) => {
            console.error('❌ WebSocket error:', err.message);
        }
    });

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

    console.log('🎧 Simulation started - tracking 0x8dxd trades...');
    console.log(`   (Will run for ${(SIMULATION_DURATION_MS / 1000 / 60).toFixed(0)} minutes)\n`);

    // 4. Progress updates
    const progressInterval = setInterval(() => {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const remaining = ((SIMULATION_DURATION_MS - (Date.now() - startTime)) / 1000 / 60).toFixed(1);
        console.log(`⏱️  Progress: ${elapsed}min elapsed, ${remaining}min remaining | Trades: ${tradesRecorded}`);
    }, 60000); // Every minute

    // 5. Run for configured duration
    await new Promise(resolve => setTimeout(resolve, SIMULATION_DURATION_MS));

    // 6. Cleanup and report
    clearInterval(progressInterval);
    await printSummary();

    realtimeService.disconnect();
    await prisma.$disconnect();

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
