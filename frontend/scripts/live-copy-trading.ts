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
 * MODE=1 npx tsx scripts/live-copy-trading.ts
 */

import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { RealtimeServiceV2 } from '../../src/services/realtime-service-v2.ts';
import type { ActivityTrade, MarketEvent } from '../../src/services/realtime-service-v2.ts';
import { GammaApiClient } from '../../src/index';
import { RateLimiter } from '../../src/core/rate-limiter';
import { createUnifiedCache } from '../../src/core/unified-cache';
import { getStrategyConfig, StrategyProfile } from '../../src/config/strategy-profiles';
import { normalizeTradeSizing } from '../../src/utils/trade-sizing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Prefer .env.local + .env.local.secrets, fallback to .env
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local.secrets') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

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
// MODE=1 (default for live-copy-trading) -> Live, MODE=0 -> Simulation
const IS_LIVE_MODE = (process.env.COPY_MODE || '1') === '1';
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
console.log('═══════════════════════════════════════════════════════════════\n');

// --- PRISMA ---
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
    outcome: string;
    conditionId?: string;
}

const positions = new Map<string, Position>();
let configId: string;
let activeConfig: Awaited<ReturnType<typeof seedConfig>> | null = null;

// --- METRICS ---
let tradesRecorded = 0;
let totalBuyVolume = 0;
let totalSellVolume = 0;
let realizedPnL = 0;
let budgetUsed = 0; // Track how much of budget has been used
let tradesSkippedBudget = 0; // Track trades skipped due to budget
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

    // Create fresh config with budget-constrained settings
    const config = await prisma.copyTradingConfig.create({
        data: {
            walletAddress: followerLower,
            traderAddress: targetLower,
            traderName: IS_LIVE_MODE ? '0x8dxd (Live)' : '0x8dxd (Simulation)',
            maxSlippage: 2.0,
            slippageType: 'AUTO',
            autoExecute: false, // Don't let worker pick this up
            channel: 'EVENT_LISTENER',
            mode: 'PERCENTAGE', // Use percentage mode for scaling
            sizeScale: SCALE_FACTOR, // 100% of leader trades
            fixedAmount: FIXED_COPY_AMOUNT, // Fallback
            maxSizePerTrade: MAX_TRADE_SIZE, // Cap per trade
            isActive: true,
        }
    });

    configId = config.id;
    activeConfig = config;
    console.log(`✅ Created config: ${configId}\n`);
    return config;
}

// --- POSITION MANAGEMENT ---
// --- POSITION MANAGEMENT ---
function updatePositionOnBuy(tokenId: string, shares: number, price: number, marketSlug: string, outcome: string, conditionId?: string) {
    const existing = positions.get(tokenId);

    if (existing) {
        // Update weighted average price
        const newTotalCost = existing.totalCost + (shares * price);
        const newBalance = existing.balance + shares;
        existing.avgEntryPrice = newTotalCost / newBalance;
        existing.balance = newBalance;
        existing.totalCost = newTotalCost;
        // outcome stays same
    } else {
        positions.set(tokenId, {
            tokenId,
            balance: shares,
            avgEntryPrice: price,
            totalCost: shares * price,

            marketSlug,
            outcome,
            conditionId
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

function calculateCopySize(
    config: {
        mode: string;
        sizeScale: number | null;
        fixedAmount: number | null;
        maxSizePerTrade: number;
        minSizePerTrade?: number | null;
    },
    originalShares: number,
    originalPrice: number
): number {
    const originalValue = originalShares * originalPrice;

    if (config.mode === 'FIXED_AMOUNT' && config.fixedAmount) {
        return Math.min(config.fixedAmount, config.maxSizePerTrade);
    }

    const scaledValue = originalValue * (config.sizeScale || 1);
    const minSize = config.minSizePerTrade ?? 0;
    return Math.max(minSize, Math.min(scaledValue, config.maxSizePerTrade));
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
async function recordCopyTrade(
    trade: ActivityTrade,
    copyAmount: number,
    execPrice: number,
    originalShares: number,
    pnl?: number
): Promise<boolean> {
    try {
        // Enrich trade metadata if missing
        const enriched = await enrichTradeMetadata(trade);

        const baseData = {
            configId: configId,
            originalTrader: trade.trader?.address || '',
            originalSide: trade.side,
            originalSize: originalShares,
            originalPrice: trade.price,
            tokenId: trade.asset,
            conditionId: enriched.conditionId,
            marketSlug: enriched.marketSlug,
            outcome: enriched.outcome,
            copySize: copyAmount, // USDC amount (cost for BUY, proceeds for SELL)
            copyPrice: execPrice,
            status: 'EXECUTED',
            txHash: trade.transactionHash ? `${TX_PREFIX}${trade.transactionHash}` : `${TX_PREFIX}${Date.now()}`,
            originalTxHash: trade.transactionHash || null,
            executedAt: new Date(),
            realizedPnL: pnl,
        };

        if (trade.transactionHash) {
            await prisma.copyTrade.upsert({
                where: {
                    configId_originalTxHash: {
                        configId: configId,
                        originalTxHash: trade.transactionHash,
                    }
                },
                create: baseData,
                update: {
                    ...baseData,
                    detectedAt: new Date(),
                }
            });
        } else {
            await prisma.copyTrade.create({ data: baseData });
        }

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
        return true;
    } catch (err: any) {
        if (err?.code === 'P2002') {
            console.log('   ⏭️  Duplicate trade detected, skipping record.');
            return false;
        }
        console.error('   ❌ Failed to record trade:', err);
        return false;
    }
}

// --- TRADE HANDLER ---
async function handleTrade(trade: ActivityTrade) {
    const traderAddress = trade.trader?.address?.toLowerCase();
    const targetLower = TARGET_TRADER.toLowerCase();

    if (traderAddress !== targetLower) return;

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

    // Skip trades without conditionId (can't get metadata)
    if (!trade.conditionId && !trade.marketSlug) {
        console.log(`\n⏭️  SKIPPED (no metadata): tokenId ${trade.asset.slice(0, 20)}...`);
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

    const { tradeShares, tradeNotional } = normalizeTradeSizing(activeConfig, trade.size, trade.price);

    // APPLY SLIPPAGE MODEL
    const slipFactor = trade.side === 'BUY' ? (1 + SLIPPAGE_BPS / 10000) : (1 - SLIPPAGE_BPS / 10000);
    const execPrice = trade.price * slipFactor;

    let copyShares = 0;
    let copyAmount = 0;

    // --- BUDGET-CONSTRAINED COPY SIZING ---
    if (COPY_MODE === 'BUDGET_CONSTRAINED' || COPY_MODE === 'PERCENTAGE') {
        // Calculate scaled amount based on leader's trade
        const leaderNotional = tradeShares * trade.price;
        let scaledAmount = leaderNotional * SCALE_FACTOR;

        // Apply max trade size cap
        scaledAmount = Math.min(scaledAmount, MAX_TRADE_SIZE);

        // For BUY trades, check budget constraint
        if (trade.side === 'BUY') {
            const remainingBudget = MAX_BUDGET - budgetUsed;

            if (remainingBudget <= 0) {
                console.log(`\n💸 BUDGET EXHAUSTED! Used: $${budgetUsed.toFixed(2)}/$${MAX_BUDGET}. Skipping BUY...`);
                tradesSkippedBudget++;
                return;
            }

            // Cap to remaining budget
            if (scaledAmount > remainingBudget) {
                console.log(`   ⚠️ Reducing trade from $${scaledAmount.toFixed(2)} to $${remainingBudget.toFixed(2)} (budget limit)`);
                scaledAmount = remainingBudget;
            }
        }

        copyAmount = scaledAmount;
        copyShares = execPrice > 0 ? (copyAmount / execPrice) : 0;

    } else if (COPY_MODE === 'LEADER_SHARES') {
        copyShares = tradeShares;
        copyAmount = copyShares * execPrice;
    } else if (COPY_MODE === 'FIXED_AMOUNT') {
        copyAmount = FIXED_COPY_AMOUNT;
        copyShares = execPrice > 0 ? (copyAmount / execPrice) : 0;
    } else {
        copyAmount = calculateCopySize(activeConfig, tradeShares, trade.price);
        if (!Number.isFinite(copyAmount) || copyAmount <= 0) {
            console.log(`\n⏭️  SKIPPED (invalid copy size): ${trade.marketSlug || trade.asset.substring(0, 20)}...`);
            return;
        }
        copyShares = execPrice > 0 ? (copyAmount / execPrice) : 0;
    }

    // 🔥 CRITICAL: Skip SELL trades if we don't have a position
    // In real copy trading, we only sell what we've bought
    if (trade.side === 'SELL') {
        const existing = positions.get(trade.asset);
        if (!existing || existing.balance <= 0) {
            console.log(`\n⏭️  SKIPPED SELL (no position): ${trade.marketSlug || trade.asset.substring(0, 20)}...`);
            return;
        }

        if (copyShares > existing.balance) {
            copyShares = existing.balance;
            copyAmount = copyShares * execPrice;
        }
    }

    // Process trade
    let tradePnL: number | undefined = undefined;
    let positionLine: string | null = null;
    let pnlLine: string | null = null;
    let remainingLine: string | null = null;

    if (trade.side === 'BUY') {
        const enriched = await enrichTradeMetadata(trade);
        const conditionId = enriched.conditionId || trade.conditionId;
        const marketSlug = enriched.marketSlug || trade.marketSlug || '';
        const outcome = enriched.outcome || trade.outcome || 'N/A';

        updatePositionOnBuy(trade.asset, copyShares, execPrice, marketSlug, outcome, conditionId || undefined);
        totalBuyVolume += copyAmount;
        budgetUsed += copyAmount; // Track budget usage

        const pos = positions.get(trade.asset)!;
        positionLine = `   💼 Position: ${pos.balance.toFixed(2)} shares @ avg $${pos.avgEntryPrice.toFixed(4)}`;
    } else {
        const pnl = updatePositionOnSell(trade.asset, copyShares, execPrice);
        tradePnL = pnl;
        realizedPnL += pnl;
        totalSellVolume += copyAmount;

        const pos = positions.get(trade.asset);
        const remaining = pos ? pos.balance.toFixed(2) : '0';

        // Fee impact
        const netPnl = pnl - (ESTIMATED_GAS_FEE_USD * 2); // Deduct for Buy (past) and Sell (now) approx? 
        // Or just deduct current fee? Let's deduct 1x fee per action usually.
        // But PnL is realized, so it covers the full cycle cost.
        // Let's just log Gross vs Net for this specific trade action?
        // Actually, let's track Total Fees separately to deduct at end.

        pnlLine = `   💰 Gross P&L: $${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)}`;
        remainingLine = `   💼 Remaining: ${remaining} shares`;
    }

    // Record to database
    // We record the EXECUTION price (simulated)
    // Pass the trade-specific PnL (calculated above for sells)
    const recorded = await recordCopyTrade(trade, copyAmount, execPrice, tradeShares, tradePnL);
    if (!recorded) {
        return;
    }

    if (dedupeKey) {
        seenTrades.add(dedupeKey);
    }

    // Budget status
    const budgetRemaining = MAX_BUDGET - budgetUsed;
    const budgetPercent = ((budgetUsed / MAX_BUDGET) * 100).toFixed(1);

    console.log('\\n🎯 ═══════════════════════════════════════════════════════════');
    console.log(`   [${elapsed}s] COPY TRADE EXECUTED (#${tradesRecorded})`);
    console.log('   ───────────────────────────────────────────────────────────');
    console.log(`   ⏰ ${now.toISOString()}`);
    console.log(`   📊 Leader: ${tradeShares.toFixed(2)} shares ($${tradeNotional.toFixed(2)})`);
    console.log(`   📊 Copy:   ${trade.side} ${copyShares.toFixed(2)} shares ($${copyAmount.toFixed(2)})`);
    console.log(`      Price: $${trade.price.toFixed(4)} → Exec: $${execPrice.toFixed(4)} (Slippage ${SLIPPAGE_BPS / 100}%)`);
    console.log(`   💵 Budget: $${budgetUsed.toFixed(2)}/$${MAX_BUDGET} used (${budgetPercent}%) | Remaining: $${budgetRemaining.toFixed(2)}`);
    console.log(`   📈 Market: ${trade.marketSlug || 'N/A'}`);
    console.log(`   🎯 Outcome: ${trade.outcome || 'N/A'}`);
    console.log(`   🔗 TX: ${trade.transactionHash?.substring(0, 30)}...`);
    if (positionLine) console.log(positionLine);
    if (pnlLine) console.log(pnlLine);
    if (remainingLine) console.log(remainingLine);
    console.log('   ═══════════════════════════════════════════════════════════\\n');
}

// --- SETTLEMENT HANDLER ---

const SETTLEMENT_CACHE = new Set<string>();
const SETTLED_TOKENS = new Set<string>();
const SETTLEMENT_IN_FLIGHT = new Set<string>();

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

            if (!tokenId) continue;

            // Check if we hold this token
            const pos = positions.get(tokenId);
            if (!pos || pos.balance <= 0) continue;

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
                        originalSize: pos.balance,
                        originalPrice: settlementValue,
                        marketSlug: market.slug,
                        conditionId: conditionId,
                        tokenId: tokenId,
                        outcome: outcomeName,
                        copySize: proceeds,
                        copyPrice: settlementValue,
                        status: 'EXECUTED',
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
                positions.delete(tokenId);
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

// --- REDEMPTION LOGIC ---
async function processRedemptions() {
    console.log('\n🔄 Processing Settlements (Wins & Losses)...');
    const activeTokenIds = Array.from(positions.keys());
    if (activeTokenIds.length === 0) return;

    for (const tokenId of activeTokenIds) {
        const pos = positions.get(tokenId);
        if (!pos) continue;

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
                        const token = (m.tokens || []).find((t: any) => t.tokenId === tokenId || t.token_id === tokenId);
                        if (token && token.price) {
                            price = Number(token.price);
                        }
                        else if (m.outcomes && m.outcomePrices && pos.outcome) {
                            const outcomes: string[] = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : m.outcomes;
                            const prices: number[] = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices).map(Number) : m.outcomePrices.map(Number);
                            const myOutcome = parseOutcome(pos.outcome);
                            const idx = outcomes.findIndex((o: string) => parseOutcome(o) === myOutcome);

                            if (idx !== -1 && prices[idx] !== undefined) {
                                price = prices[idx];
                            }
                        }

                        // Check for 'winner' flag in token data
                        let isWinner: boolean | undefined = undefined;
                        if (token && token.winner !== undefined) {
                            isWinner = token.winner;
                        }

                        // console.log(`   [Debug] Token: ${tokenId} Price: ${price} Winner: ${isWinner} Closed: ${m.closed}`);

                        // STRICT SETTLEMENT LOGIC: Only settle if market is CLOSED
                        if (!m.closed) continue;

                        // Check for Win (Explicit Winner or Price is effectively 1)
                        if (isWinner === true || (price !== undefined && price >= 0.95)) {
                            if (!startSettlement(tokenId)) continue;
                            console.log(`   🎉 Redeeming WIN for ${pos.marketSlug} (${pos.outcome}). Shares: ${pos.balance.toFixed(2)}`);

                            // 1. Credit Realized PnL (Value - Cost)
                            // Redemption gives $1.00 per share.
                            const redemptionValue = pos.balance;
                            const profit = redemptionValue - pos.totalCost;
                            realizedPnL += profit;
                            totalSellVolume += redemptionValue;

                            // 2. Record Trade
                            const execPrice = 1.0;
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
                                    status: 'EXECUTED',
                                    executedAt: new Date(),
                                    txHash: `${TX_PREFIX}redeem-${Date.now()}`,
                                    errorMessage: `Redeemed Profit: $${profit.toFixed(4)}`,
                                    realizedPnL: profit,
                                    conditionId: pos.conditionId // Important: persist conditionId
                                }
                            });

                            // 3. Remove Position
                            await prisma.userPosition.deleteMany({
                                where: { walletAddress: FOLLOWER_WALLET.toLowerCase(), tokenId: tokenId }
                            });
                            positions.delete(tokenId);
                            finishSettlement(tokenId, true);

                            console.log(`      💰 Credited $${redemptionValue.toFixed(2)} (Profit: $${profit.toFixed(2)})`);
                        }
                        // Check for Loss (Explicit Loser or Price is effectively 0)
                        else if (isWinner === false || (price !== undefined && price <= 0.05)) {
                            if (!startSettlement(tokenId)) continue;
                            console.log(`   💀 Settle LOSS for ${pos.marketSlug} (${pos.outcome}). Shares: ${pos.balance.toFixed(2)}`);

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
                                    originalSize: pos.balance,
                                    originalPrice: 0.0,
                                    status: 'EXECUTED',
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
                            positions.delete(tokenId);
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
    const activeTokenIds = Array.from(positions.keys());
    const priceMap = new Map<string, number>();

    if (activeTokenIds.length > 0) {
        console.log(`\n🔎 Fetching live prices for ${activeTokenIds.length} active positions...`);
        try {
            for (const tokenId of activeTokenIds) {
                const pos = positions.get(tokenId);
                if (!pos) continue;
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
    for (const [tokenId, pos] of positions) {
        if (pos.balance > 0) {
            // Use live price if available, else entry price
            const livePrice = priceMap.get(tokenId) ?? pos.avgEntryPrice;
            const marketValue = pos.balance * livePrice;
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
    console.log(`  Net P&L (Realized):   $${netPnL >= 0 ? '+' : ''}${netPnL.toFixed(4)}`);
    console.log(`  TOTAL P&L:            $${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(4)}`);
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

// --- MAIN ---
async function main() {
    // 1. Setup
    await seedConfig();

    // 2. Connect to WebSocket
    const realtimeService = new RealtimeServiceV2({
        // Use manual reconnect w/ backoff to avoid rapid reconnect storms (EADDRNOTAVAIL)
        autoReconnect: false,
        debug: false,
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

    // 4. Progress updates
    const progressInterval = setInterval(async () => {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const remaining = ((SIMULATION_DURATION_MS - (Date.now() - startTime)) / 1000 / 60).toFixed(1);
        console.log(`⏱️  Progress: ${elapsed}min elapsed, ${remaining}min remaining | Trades: ${tradesRecorded}`);

        // Process Redemptions periodically
        await processRedemptions();
    }, 60000); // Every minute

    // 5. Run for configured duration
    await new Promise(resolve => setTimeout(resolve, SIMULATION_DURATION_MS));

    // 6. Cleanup and report
    clearInterval(progressInterval);
    console.log('🔄 Running final settlement check...');
    await processRedemptions();
    await printSummary();

    realtimeService.disconnect();
    await prisma.$disconnect();

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
