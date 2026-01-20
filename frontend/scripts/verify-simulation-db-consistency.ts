
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🔍 Verifying Simulation Data Consistency...');

    // 1. Get the latest config (assuming it's the one from the simulation)
    const latestConfig = await prisma.copyTradingConfig.findFirst({
        orderBy: { createdAt: 'desc' },
        where: { traderName: '0x8dxd (Simulation)' }
    });

    if (!latestConfig) {
        console.error('❌ No simulation config found!');
        return;
    }

    console.log(`\n📋 Config ID: ${latestConfig.id}`);
    console.log(`   Created At: ${latestConfig.createdAt.toISOString()}`);

    // 2. Fetch all trades for this config
    const trades = await prisma.copyTrade.findMany({
        where: { configId: latestConfig.id },
        orderBy: { executedAt: 'asc' } // 'asc' to simulate timeline
    });

    console.log(`\n📊 Database Records: ${trades.length} trades`);

    // 3. Analyze Buys vs Sells
    let buyCount = 0;
    let sellCount = 0;
    let buyVolume = 0;
    let sellVolume = 0;

    // Track positions based on DB records
    const calculatedPositions = new Map<string, number>();

    for (const trade of trades) {
        if (trade.originalSide === 'BUY') {
            buyCount++;
            buyVolume += trade.copySize;

            // Add to position
            const current = calculatedPositions.get(trade.tokenId!) || 0;
            // Approximate shares (copySize / copyPrice)
            // Note: DB copyPrice might be null if not captured, but usually is there
            if (trade.copyPrice) {
                calculatedPositions.set(trade.tokenId!, current + (trade.copySize / trade.copyPrice));
            }
        } else {
            sellCount++;
            // For sells, we need to know the 'value' sold. 
            // In the simulation script: sellVolume += FIXED_COPY_AMOUNT
            // So we assume the db record reflects this?
            // Actually, let's check how sellVolume is calculated in the simulation
            // "totalSellVolume += FIXED_COPY_AMOUNT;"
            sellVolume += trade.copySize; // copySize is likely fixed amount

            // Remove from position
            const current = calculatedPositions.get(trade.tokenId!) || 0;
            if (trade.copyPrice) {
                calculatedPositions.set(trade.tokenId!, current - (trade.copySize / trade.copyPrice));
            }
        }
    }

    console.log(`\n📈 Trade Analysis:`);
    console.log(`   Total Buys: ${buyCount} ($${buyVolume.toFixed(2)})`);
    console.log(`   Total Sells: ${sellCount} ($${sellVolume.toFixed(2)})`);

    const sellRatio = buyCount > 0 ? (sellCount / buyCount) * 100 : 0;
    console.log(`   Sell/Buy Ratio: ${sellRatio.toFixed(1)}%`);

    // 4. Check Open Positions (UserPosition Table)
    const dbPositions = await prisma.userPosition.findMany({
        where: { walletAddress: latestConfig.walletAddress }
    });

    // Filter out zero balances
    const activePositions = dbPositions.filter(p => p.balance > 0.001);

    console.log(`\n💼 Open Positions (UserPosition Table):`);
    console.log(`   Active Positions: ${activePositions.length}`);

    let totalHeldValue = 0; // Cost basis
    for (const pos of activePositions) {
        totalHeldValue += pos.totalCost;
    }
    console.log(`   Total Held Cost: $${totalHeldValue.toFixed(2)}`);

    // 5. Compare with "Did everything sell?"
    console.log(`\n🧐 Conclusion:`);
    if (activePositions.length === 0 && buyCount === sellCount) {
        console.log(`   ✅ ALL positions were sold.`);
    } else {
        console.log(`   ❌ NOT all positions were sold.`);
        console.log(`   - We bought ${buyCount} times.`);
        console.log(`   - We sold ${sellCount} times.`);
        console.log(`   - We are still holding ${activePositions.length} positions.`);
    }

    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
