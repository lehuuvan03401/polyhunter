
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🔍 Checking Database State...');

    const allTrades = await prisma.copyTrade.findMany({
        orderBy: { executedAt: 'desc' },
        take: 20
    });
    const configs = await prisma.copyTradingConfig.findMany();
    const positions = await prisma.userPosition.findMany();

    console.log(`\n📊 SUMMARY`);
    console.log(`-------------------------------------------`);
    console.log(`Total Configs: ${configs.length}`);
    configs.forEach(c => {
        console.log(`- Config ID: ${c.id} | Wallet: ${c.walletAddress} | Trader: ${c.traderAddress}`);
    });

    console.log(`\n📊 SUMMARY`);
    console.log(`-------------------------------------------`);
    console.log(`Total CopyTrades: ${allTrades.length} (Fetched 50)`);
    console.log(`Total UserPositions: ${positions.length}`);

    const uniqueTokensInTrades = new Set(allTrades.map(t => t.tokenId));
    const uniqueTokensInPositions = new Set(positions.map(p => p.tokenId));

    console.log(`Unique Tokens traded (last 50): ${uniqueTokensInTrades.size}`);
    console.log(`Unique Tokens in Positions: ${uniqueTokensInPositions.size}`);

    // Check for WINS (Price > 0.9)
    const winTrades = await prisma.copyTrade.findMany({
        where: { originalPrice: { gt: 0.9 } },
        take: 5
    });

    console.log(`\n🏆 WIN TRADES (Price > 0.9): ${winTrades.length} found (showing max 5)`);
    winTrades.forEach(t => {
        console.log(`- Trader: ${t.originalTrader} | Price: ${t.originalPrice} | PnL: ${t.realizedPnL}`);
    });

    console.log(`\nRecent Trades (Last 15):`);
    allTrades.slice(0, 15).forEach(t => {
        const tokenIdDisplay = t.tokenId ? t.tokenId.substring(0, 10) : 'N/A';
        console.log(`- ${t.originalSide} | Trader: ${t.originalTrader} | Hash: ${t.txHash} | Price: ${t.originalPrice} | PnL: ${t.realizedPnL}`);
    });

    await prisma.$disconnect();
}

main().catch(console.error);
