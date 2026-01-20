
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    // Ensure lowercase for matching DB records which are seemingly stored as lowercase
    const walletAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'.toLowerCase();
    console.log(`Connection: ${connectionString.replace(/:[^:]+@/, ':****@')}`);
    console.log(`🔍 Verifying Metrics for ${walletAddress}...`);

    // debug: count all
    const allTrades = await prisma.copyTrade.count();
    console.log(`DEBUG: Total CopyTrades in DB (any wallet): ${allTrades}`);

    // Debug: fetch first 5 trades and their config
    const samples = await prisma.copyTrade.findMany({
        take: 5,
        include: { config: true }
    });
    console.log('--- SAMPLE TRADES ---');
    samples.forEach(t => {
        console.log(`Trade ${t.id}: MetricWallet=${walletAddress} vs ConfigWallet=${t.config.walletAddress}`);
        console.log(`Mismatch? ${walletAddress !== t.config.walletAddress}`);
        // Check case sensitivity
        console.log(`Case Mismatch? ${walletAddress.toLowerCase() !== t.config.walletAddress.toLowerCase()}`);
    });
    console.log('---------------------');

    // 1. Check UserPositions
    const positions = await prisma.userPosition.findMany({
        where: { walletAddress, balance: { gt: 0 } }
    });
    console.log(`Open Positions: ${positions.length}`);
    positions.forEach(p => console.log(` - Token ${p.tokenId}: Balance=${p.balance}, Cost=${p.totalCost}`));

    // 2. Calculate Invested
    const totalInvested = positions.reduce((sum, pos) => sum + pos.totalCost, 0);
    console.log(`💰 Total Invested: $${totalInvested.toFixed(2)}`);

    // 3. Check CopyTrades count
    const trades = await prisma.copyTrade.count({
        where: { config: { walletAddress } }
    });
    console.log(`📜 Total Copy Trades recorded: ${trades}`);

    if (positions.length > 0 || trades > 0) {
        console.log('✅ Data verification PASSED: DB is populating.');
    } else {
        console.log('⏳ Waiting for simulation to generate trades...');
    }

    await prisma.$disconnect();
}

main().catch(console.error);
