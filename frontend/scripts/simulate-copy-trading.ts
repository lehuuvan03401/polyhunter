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
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { RealtimeServiceV2, ActivityTrade } from '../../src/services/realtime-service-v2';

// --- CONFIG ---
const TARGET_TRADER = process.env.TARGET_TRADER || '0x63ce342161250d705dc0b16df89036c8e5f9ba9a';
const FOLLOWER_WALLET = process.env.FOLLOWER_WALLET || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const SIMULATION_DURATION_MS = parseInt(process.env.SIMULATION_DURATION_MS || '300000'); // 5 minutes
const FIXED_COPY_AMOUNT = parseFloat(process.env.FIXED_COPY_AMOUNT || '10'); // $10 per trade

// Validation
if (!process.env.DATABASE_URL) {
    console.error('❌ Missing DATABASE_URL in .env');
    process.exit(1);
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('🎮 COMPREHENSIVE COPY TRADING SIMULATION');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`Target Trader: ${TARGET_TRADER}`);
console.log(`Follower Wallet: ${FOLLOWER_WALLET}`);
console.log(`Duration: ${SIMULATION_DURATION_MS / 1000 / 60} minutes`);
console.log(`Fixed Copy Amount: $${FIXED_COPY_AMOUNT}`);
console.log('═══════════════════════════════════════════════════════════════\n');

// --- PRISMA ---
const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ['error'] });

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
            autoExecute: true,
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

// --- DATABASE RECORDING ---
async function recordCopyTrade(trade: ActivityTrade, copyShares: number, pnl?: number) {
    try {
        await prisma.copyTrade.create({
            data: {
                configId: configId,
                originalTrader: trade.trader?.address || '',
                originalSide: trade.side,
                originalSize: trade.size,
                originalPrice: trade.price,
                tokenId: trade.asset,
                marketSlug: trade.marketSlug || null,
                outcome: trade.outcome || null,
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

    const now = new Date();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

    // Calculate copy shares based on fixed amount
    const copyShares = FIXED_COPY_AMOUNT / trade.price;

    console.log('\n🎯 ═══════════════════════════════════════════════════════════');
    console.log(`   [${elapsed}s] COPY TRADE EXECUTED`);
    console.log('   ───────────────────────────────────────────────────────────');
    console.log(`   ⏰ ${now.toISOString()}`);
    console.log(`   📊 ${trade.side} $${FIXED_COPY_AMOUNT.toFixed(2)} → ${copyShares.toFixed(2)} shares @ $${trade.price.toFixed(4)}`);
    console.log(`   📈 Market: ${trade.marketSlug || 'N/A'}`);
    console.log(`   🎯 Outcome: ${trade.outcome || 'N/A'}`);
    console.log(`   🔗 TX: ${trade.transactionHash?.substring(0, 30)}...`);

    // Process trade
    if (trade.side === 'BUY') {
        updatePositionOnBuy(trade.asset, copyShares, trade.price, trade.marketSlug || '');
        totalBuyVolume += FIXED_COPY_AMOUNT;

        const pos = positions.get(trade.asset)!;
        console.log(`   💼 Position: ${pos.balance.toFixed(2)} shares @ avg $${pos.avgEntryPrice.toFixed(4)}`);
    } else {
        const pnl = updatePositionOnSell(trade.asset, copyShares, trade.price);
        realizedPnL += pnl;
        totalSellVolume += FIXED_COPY_AMOUNT;

        const pos = positions.get(trade.asset);
        const remaining = pos ? pos.balance.toFixed(2) : '0';
        console.log(`   💰 P&L: $${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)}`);
        console.log(`   💼 Remaining: ${remaining} shares`);
    }

    console.log('   ═══════════════════════════════════════════════════════════\n');

    // Record to database
    await recordCopyTrade(trade, copyShares, trade.side === 'SELL' ? realizedPnL : undefined);
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
    console.log(`Realized P&L: $${realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(4)}`);
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

    console.log('🎧 Simulation started - tracking 0x8dxd trades...');
    console.log(`   (Will run for ${SIMULATION_DURATION_MS / 1000 / 60} minutes)\n`);

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
