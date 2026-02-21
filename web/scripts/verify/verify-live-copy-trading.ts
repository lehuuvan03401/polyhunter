/**
 * Verify Live Copy Trading
 * 
 * Monitors a real, active trader on Polymarket mainnet and validates the
 * copy trading detection pipeline without executing trades.
 * 
 * Target Trader: 0x63ce342161250d705dc0b16df89036c8e5f9ba9a (@0x8dxd)
 * 
 * Usage:
 * export $(grep -v '^#' .env | xargs)
 * npx tsx scripts/verify-live-copy-trading.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { RealtimeServiceV2, ActivityTrade } from '../../../sdk/src/services/realtime-service-v2';

// --- CONFIG ---
const TARGET_TRADER = process.env.TARGET_TRADER || '0x63ce342161250d705dc0b16df89036c8e5f9ba9a';
const VERIFICATION_DURATION_MS = parseInt(process.env.VERIFICATION_DURATION_MS || '300000'); // 5 minutes
const FOLLOWER_WALLET = process.env.FOLLOWER_WALLET || '0xTEST_FOLLOWER_ADDRESS';

// Validation
if (!process.env.DATABASE_URL) {
    console.error('❌ Missing DATABASE_URL in .env');
    process.exit(1);
}

console.log('============================================');
console.log('🔬 LIVE COPY TRADING VERIFICATION');
console.log('============================================');
console.log(`Target Trader: ${TARGET_TRADER}`);
console.log(`Duration: ${VERIFICATION_DURATION_MS / 1000}s`);
console.log(`Network: Polygon Mainnet (WebSocket only, no RPC required)`);
console.log('============================================\n');

// --- PRISMA ---
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

// --- METRICS ---
interface VerificationMetrics {
    tradesDetected: number;
    targetTraderTrades: number;
    latencies: number[];
    errors: number;
    startTime: number;
}

const metrics: VerificationMetrics = {
    tradesDetected: 0,
    targetTraderTrades: 0,
    latencies: [],
    errors: 0,
    startTime: Date.now(),
};

// --- SEED TEST CONFIG ---
async function seedTestConfig() {
    console.log('📝 Seeding test copy trading config...');

    const targetLower = TARGET_TRADER.toLowerCase();

    // Check if config already exists
    const existing = await prisma.copyTradingConfig.findFirst({
        where: {
            walletAddress: FOLLOWER_WALLET.toLowerCase(),
            traderAddress: targetLower,
        }
    });

    if (existing) {
        console.log(`✅ Config already exists: ${existing.id}`);

        // Ensure it's active and on EVENT_LISTENER channel
        if (!existing.isActive || existing.channel !== 'EVENT_LISTENER') {
            await prisma.copyTradingConfig.update({
                where: { id: existing.id },
                data: { isActive: true, channel: 'EVENT_LISTENER', autoExecute: true }
            });
            console.log('📝 Updated config to EVENT_LISTENER channel');
        }
        return existing;
    }

    // Create new config
    const config = await prisma.copyTradingConfig.create({
        data: {
            walletAddress: FOLLOWER_WALLET.toLowerCase(),
            traderAddress: targetLower,
            traderName: '0x8dxd (Verification)',
            maxSlippage: 2.0,
            slippageType: 'AUTO',
            autoExecute: true,
            channel: 'EVENT_LISTENER',
            mode: 'FIXED_AMOUNT',
            fixedAmount: 10,
            isActive: true,
        }
    });

    console.log(`✅ Created test config: ${config.id}`);
    return config;
}

// --- WEBSOCKET HANDLER ---
function handleActivityTrade(trade: ActivityTrade) {
    const now = Date.now();
    metrics.tradesDetected++;

    const traderAddress = trade.trader?.address?.toLowerCase();
    const targetLower = TARGET_TRADER.toLowerCase();

    // Calculate latency (WebSocket timestamp is in seconds)
    const tradeTime = trade.timestamp * 1000;
    const latency = now - tradeTime;

    if (traderAddress === targetLower) {
        metrics.targetTraderTrades++;
        metrics.latencies.push(latency);

        console.log('\n🎯 ════════════════════════════════════════');
        console.log(`   TARGET TRADER DETECTED!`);
        console.log(`   ────────────────────────────────────────`);
        console.log(`   📊 ${trade.side} ${trade.size.toFixed(2)} shares @ $${trade.price.toFixed(4)}`);
        console.log(`   🪙 Token: ${trade.asset.substring(0, 20)}...`);
        console.log(`   📈 Market: ${trade.marketSlug || 'N/A'}`);
        console.log(`   ⏱️  Latency: ${latency}ms`);
        console.log(`   🔗 TX: ${trade.transactionHash?.substring(0, 20)}...`);
        console.log('   ════════════════════════════════════════\n');
    } else {
        // Log other trades at lower verbosity
        if (metrics.tradesDetected % 100 === 0) {
            console.log(`📡 ${metrics.tradesDetected} total trades detected...`);
        }
    }
}

// --- PRINT SUMMARY ---
function printSummary() {
    const duration = (Date.now() - metrics.startTime) / 1000;
    const avgLatency = metrics.latencies.length > 0
        ? metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length
        : 0;
    const maxLatency = metrics.latencies.length > 0 ? Math.max(...metrics.latencies) : 0;
    const minLatency = metrics.latencies.length > 0 ? Math.min(...metrics.latencies) : 0;

    console.log('\n============================================');
    console.log('📊 VERIFICATION SUMMARY');
    console.log('============================================');
    console.log(`Duration: ${duration.toFixed(1)}s`);
    console.log(`Total trades detected: ${metrics.tradesDetected}`);
    console.log(`Target trader trades: ${metrics.targetTraderTrades}`);
    console.log(`\nLatency Stats (target trader only):`);
    console.log(`  - Average: ${avgLatency.toFixed(0)}ms`);
    console.log(`  - Min: ${minLatency}ms`);
    console.log(`  - Max: ${maxLatency}ms`);
    console.log(`Errors: ${metrics.errors}`);
    console.log('============================================');

    // Verdict
    if (metrics.targetTraderTrades > 0 && avgLatency < 500) {
        console.log('\n✅ VERIFICATION PASSED');
        console.log('   - Trades detected successfully');
        console.log('   - Latency within acceptable range (<500ms)');
    } else if (metrics.targetTraderTrades === 0) {
        console.log('\n⚠️  NO TARGET TRADES DETECTED');
        console.log('   - The target trader may not have traded during this period');
        console.log('   - Try running for a longer duration');
    } else {
        console.log('\n⚠️  HIGH LATENCY DETECTED');
        console.log(`   - Average latency: ${avgLatency.toFixed(0)}ms (expected <500ms)`);
        console.log('   - Check network conditions');
    }
}

// --- MAIN ---
async function main() {
    // 1. Seed test config
    await seedTestConfig();

    // 2. Connect to WebSocket
    const realtimeService = new RealtimeServiceV2({
        autoReconnect: true,
        debug: false,
    });

    console.log('🔌 Connecting to Polymarket WebSocket...');
    realtimeService.connect();

    // 3. Subscribe to ALL activity
    realtimeService.subscribeAllActivity({
        onTrade: handleActivityTrade,
        onError: (err) => {
            metrics.errors++;
            console.error('❌ WebSocket error:', err.message);
        }
    });

    console.log('🎧 Listening for trades...');
    console.log(`   (Will run for ${VERIFICATION_DURATION_MS / 1000}s)\n`);

    // 4. Run for configured duration
    await new Promise(resolve => setTimeout(resolve, VERIFICATION_DURATION_MS));

    // 5. Print summary and cleanup
    printSummary();
    realtimeService.disconnect();
    await prisma.$disconnect();

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
