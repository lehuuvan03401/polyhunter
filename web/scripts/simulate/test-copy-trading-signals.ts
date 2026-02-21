/**
 * Test Copy Trading Signal Detection and Dispatch
 * 
 * Demonstrates real-time detection of target trader's trades and simulates
 * the copy trading dispatch flow. No wallet required - shows the detection
 * and decision-making logic only.
 * 
 * Usage:
 * export $(grep -v '^#' .env | xargs)
 * npx tsx scripts/test-copy-trading-signals.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { RealtimeServiceV2, ActivityTrade } from '../../../sdk/src/services/realtime-service-v2';

// --- CONFIG ---
const TARGET_TRADER = process.env.TARGET_TRADER || '0x63ce342161250d705dc0b16df89036c8e5f9ba9a';
const VERIFICATION_DURATION_MS = parseInt(process.env.VERIFICATION_DURATION_MS || '120000'); // 2 minutes

// --- PRISMA ---
const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter, log: ['error'] });

// --- METRICS ---
let signalsDetected = 0;
let copiesDispatched = 0;
const startTime = Date.now();

console.log('════════════════════════════════════════════════════════════');
console.log('🔬 COPY TRADING SIGNAL TEST');
console.log('════════════════════════════════════════════════════════════');
console.log(`Target Trader: ${TARGET_TRADER}`);
console.log(`Duration: ${VERIFICATION_DURATION_MS / 1000}s`);
console.log('════════════════════════════════════════════════════════════\n');

// --- LOAD SUBSCRIBERS ---
async function loadSubscribers() {
    const configs = await prisma.copyTradingConfig.findMany({
        where: {
            traderAddress: TARGET_TRADER.toLowerCase(),
            isActive: true
        }
    });
    console.log(`📋 Found ${configs.length} active subscribers for this trader\n`);
    return configs;
}

// --- SIMULATE COPY DISPATCH ---
function simulateCopyDispatch(
    trade: ActivityTrade,
    configs: any[]
) {
    if (configs.length === 0) {
        console.log(`   ⏭️  No subscribers - would skip copy`);
        return;
    }

    for (const config of configs) {
        copiesDispatched++;
        const copyAmount = config.fixedAmount || 10;

        console.log(`   ────────────────────────────────────────`);
        console.log(`   📤 COPY DISPATCH #${copiesDispatched}`);
        console.log(`   👤 Subscriber: ${config.walletAddress.substring(0, 10)}...`);
        console.log(`   💰 Copy Amount: $${copyAmount.toFixed(2)}`);
        console.log(`   📊 Would ${trade.side}: ~${(copyAmount / trade.price).toFixed(2)} shares @ $${trade.price.toFixed(4)}`);
        console.log(`   ⚙️  Mode: ${config.executionMode} | Slippage: ${config.maxSlippage}%`);
    }
}

// --- TRADE HANDLER ---
function handleTrade(trade: ActivityTrade, configs: any[]) {
    const traderAddress = trade.trader?.address?.toLowerCase();
    const targetLower = TARGET_TRADER.toLowerCase();

    if (traderAddress !== targetLower) return;

    signalsDetected++;
    const now = Date.now();
    const detectionLatency = now - (trade.timestamp * 1000);

    console.log('\n🎯 ════════════════════════════════════════════════════════');
    console.log(`   SIGNAL #${signalsDetected} DETECTED!`);
    console.log('   ════════════════════════════════════════════════════════');
    console.log(`   ⏰ Time: ${new Date().toISOString()}`);
    console.log(`   📊 ${trade.side} ${trade.size.toFixed(2)} shares @ $${trade.price.toFixed(4)}`);
    console.log(`   🪙 Token: ${trade.asset.substring(0, 30)}...`);
    console.log(`   📈 Market: ${trade.marketSlug || 'N/A'}`);
    console.log(`   ⏱️  Detection Latency: ${detectionLatency}ms`);
    console.log(`   🔗 TX: ${trade.transactionHash}`);

    // Simulate copy dispatch
    simulateCopyDispatch(trade, configs);

    console.log('   ════════════════════════════════════════════════════════\n');
}

// --- MAIN ---
async function main() {
    // 1. Load subscribers
    const configs = await loadSubscribers();

    // 2. Connect to WebSocket
    const realtimeService = new RealtimeServiceV2({
        autoReconnect: true,
        debug: false,
    });

    console.log('🔌 Connecting to Polymarket WebSocket...');
    realtimeService.connect();

    // 3. Subscribe to ALL activity
    realtimeService.subscribeAllActivity({
        onTrade: (trade) => handleTrade(trade, configs),
        onError: (err) => {
            console.error('❌ WebSocket error:', err.message);
        }
    });

    console.log('🎧 Listening for target trader signals...\n');
    console.log('Waiting for trades from 0x8dxd...\n');

    // 4. Run for configured duration
    await new Promise(resolve => setTimeout(resolve, VERIFICATION_DURATION_MS));

    // 5. Print summary
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('📊 TEST SUMMARY');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`Signals Detected: ${signalsDetected}`);
    console.log(`Copy Dispatches: ${copiesDispatched}`);
    console.log('════════════════════════════════════════════════════════════\n');

    realtimeService.disconnect();
    await prisma.$disconnect();
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
