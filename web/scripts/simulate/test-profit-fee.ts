/**
 * Test Script: Profit-Based Fee Logic
 * 
 * Verifies:
 * 1. BUY updates position (cost basis) - NO fee charged
 * 2. SELL with PROFIT charges fee based on volume tier
 * 3. SELL with LOSS charges NO fee
 * 
 * Usage:
 * npx tsx scripts/test-profit-fee.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PositionService } from '../../lib/services/position-service';
import { AffiliateEngine } from '../../lib/services/affiliate-engine';

// Setup
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const positionService = new PositionService(prisma);
const affiliateEngine = new AffiliateEngine(prisma);

// Test Constants
const TEST_WALLET = '0xTEST_FOLLOWER_' + Date.now();
const TEST_TOKEN = 'TEST_TOKEN_' + Date.now();
const TEST_REFERRER_CODE = 'TESTREF';

async function setup() {
    console.log('\n========================================');
    console.log('🧪 PROFIT-BASED FEE LOGIC TEST');
    console.log('========================================\n');

    // 1. Create a test referrer (if not exists)
    let referrer = await prisma.referrer.findFirst({
        where: { referralCode: TEST_REFERRER_CODE }
    });

    if (!referrer) {
        referrer = await prisma.referrer.create({
            data: {
                walletAddress: '0xTEST_REFERRER_' + Date.now(),
                referralCode: TEST_REFERRER_CODE,
                tier: 'ORDINARY'
            }
        });
        // Create self-closure
        await prisma.teamClosure.create({
            data: {
                ancestorId: referrer.id,
                descendantId: referrer.id,
                depth: 0
            }
        });
        console.log('✅ Created test referrer:', referrer.walletAddress);
    }

    // 2. Create test referral relationship
    const existingReferral = await prisma.referral.findUnique({
        where: { refereeAddress: TEST_WALLET.toLowerCase() }
    });

    if (!existingReferral) {
        await prisma.referral.create({
            data: {
                referrerId: referrer.id,
                refereeAddress: TEST_WALLET.toLowerCase(),
                lifetimeVolume: 5000 // $5k = 20% fee tier
            }
        });
        console.log('✅ Created test referral relationship (Volume: $5k → 20% tier)');
    }

    return referrer;
}

async function testBuyNoFee() {
    console.log('\n--- TEST 1: BUY updates position, NO fee ---');

    const initialCommissions = await prisma.commissionLog.count({
        where: { sourceUserId: TEST_WALLET.toLowerCase() }
    });

    // Simulate BUY: 100 shares @ $0.50 = $50 total
    await positionService.recordBuy({
        walletAddress: TEST_WALLET.toLowerCase(),
        tokenId: TEST_TOKEN,
        side: 'BUY',
        amount: 100, // shares
        price: 0.50, // $ per share
        totalValue: 50 // USDC
    });

    // Check position was created
    const position = await positionService.getPosition(TEST_WALLET.toLowerCase(), TEST_TOKEN);
    console.log('📊 Position after BUY:', position);

    if (!position || position.balance !== 100 || position.avgEntryPrice !== 0.5) {
        console.log('❌ FAIL: Position not updated correctly');
        return false;
    }
    console.log('✅ Position updated: 100 shares @ $0.50 avg');

    // Verify NO commission was charged for BUY
    const afterCommissions = await prisma.commissionLog.count({
        where: { sourceUserId: TEST_WALLET.toLowerCase(), type: 'PROFIT_FEE' }
    });

    if (afterCommissions > initialCommissions) {
        console.log('❌ FAIL: Unexpected PROFIT_FEE commission on BUY');
        return false;
    }
    console.log('✅ No PROFIT_FEE charged on BUY');

    return true;
}

async function testSellWithProfit() {
    console.log('\n--- TEST 2: SELL with PROFIT charges fee ---');

    // Simulate SELL: 50 shares @ $0.70 = $35 (bought @ $0.50, profit = $10)
    const profitResult = await positionService.recordSell({
        walletAddress: TEST_WALLET.toLowerCase(),
        tokenId: TEST_TOKEN,
        side: 'SELL',
        amount: 50,
        price: 0.70,
        totalValue: 35
    });

    console.log('💰 Profit Result:', profitResult);

    // Expected: profit = (0.70 - 0.50) * 50 = $10
    const expectedProfit = 10;
    if (Math.abs(profitResult.profit - expectedProfit) > 0.01) {
        console.log(`❌ FAIL: Expected profit $${expectedProfit}, got $${profitResult.profit.toFixed(4)}`);
        return false;
    }
    console.log(`✅ Profit calculated correctly: $${profitResult.profit.toFixed(4)}`);

    // Now distribute the fee
    const tradeId = 'test-profit-sell-' + Date.now();
    await affiliateEngine.distributeProfitFee(
        TEST_WALLET.toLowerCase(),
        profitResult.profit,
        tradeId
    );

    // Verify commission was created
    const commission = await prisma.commissionLog.findFirst({
        where: {
            sourceUserId: TEST_WALLET.toLowerCase(),
            type: 'PROFIT_FEE',
            sourceTradeId: tradeId
        }
    });

    if (!commission) {
        console.log('❌ FAIL: No PROFIT_FEE commission found');
        return false;
    }

    // Expected fee: $10 profit * 20% = $2
    const expectedFee = 2;
    if (Math.abs(commission.amount - expectedFee) > 0.01) {
        console.log(`❌ FAIL: Expected fee $${expectedFee}, got $${commission.amount.toFixed(4)}`);
        return false;
    }
    console.log(`✅ PROFIT_FEE charged: $${commission.amount.toFixed(4)} (20% of $10 profit)`);

    return true;
}

async function testSellWithLoss() {
    console.log('\n--- TEST 3: SELL with LOSS charges NO fee ---');

    // First, do another BUY to have position
    await positionService.recordBuy({
        walletAddress: TEST_WALLET.toLowerCase(),
        tokenId: TEST_TOKEN,
        side: 'BUY',
        amount: 50,
        price: 0.60, // higher than before, new avg will be calculated
        totalValue: 30
    });

    const positionBefore = await positionService.getPosition(TEST_WALLET.toLowerCase(), TEST_TOKEN);
    console.log('📊 Position before SELL (loss):', positionBefore);

    // Count commissions before
    const beforeCount = await prisma.commissionLog.count({
        where: { sourceUserId: TEST_WALLET.toLowerCase(), type: 'PROFIT_FEE' }
    });

    // Simulate SELL at loss: 20 shares @ $0.40 (below avg entry)
    const lossResult = await positionService.recordSell({
        walletAddress: TEST_WALLET.toLowerCase(),
        tokenId: TEST_TOKEN,
        side: 'SELL',
        amount: 20,
        price: 0.40,
        totalValue: 8
    });

    console.log('📉 Loss Result:', lossResult);

    if (lossResult.profit >= 0) {
        console.log('❌ FAIL: Expected a loss, but got profit:', lossResult.profit);
        return false;
    }
    console.log(`✅ Loss calculated correctly: $${lossResult.profit.toFixed(4)}`);

    // Attempt to distribute (should be skipped)
    await affiliateEngine.distributeProfitFee(
        TEST_WALLET.toLowerCase(),
        lossResult.profit,
        'test-loss-sell-' + Date.now()
    );

    // Verify NO new commission was created
    const afterCount = await prisma.commissionLog.count({
        where: { sourceUserId: TEST_WALLET.toLowerCase(), type: 'PROFIT_FEE' }
    });

    if (afterCount > beforeCount) {
        console.log('❌ FAIL: PROFIT_FEE was charged on a LOSS trade');
        return false;
    }
    console.log('✅ No PROFIT_FEE charged on LOSS trade');

    return true;
}

async function cleanup() {
    // Cleanup test data
    await prisma.userPosition.deleteMany({
        where: { walletAddress: { startsWith: '0xTEST_FOLLOWER_' } }
    });
    await prisma.commissionLog.deleteMany({
        where: { sourceUserId: { startsWith: '0xtest_follower_' } }
    });
    await prisma.referral.deleteMany({
        where: { refereeAddress: { startsWith: '0xtest_follower_' } }
    });
    console.log('\n🧹 Cleaned up test data');
}

async function main() {
    try {
        await setup();

        const results = {
            buyNoFee: await testBuyNoFee(),
            sellWithProfit: await testSellWithProfit(),
            sellWithLoss: await testSellWithLoss()
        };

        console.log('\n========================================');
        console.log('📋 TEST RESULTS');
        console.log('========================================');
        console.log('1. BUY updates position (no fee):', results.buyNoFee ? '✅ PASS' : '❌ FAIL');
        console.log('2. SELL with profit charges fee:', results.sellWithProfit ? '✅ PASS' : '❌ FAIL');
        console.log('3. SELL with loss charges no fee:', results.sellWithLoss ? '✅ PASS' : '❌ FAIL');

        const allPassed = Object.values(results).every(r => r);
        console.log('\n' + (allPassed ? '🎉 ALL TESTS PASSED!' : '⚠️ SOME TESTS FAILED'));

        await cleanup();
        process.exit(allPassed ? 0 : 1);

    } catch (error) {
        console.error('💥 Test Error:', error);
        await cleanup();
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
