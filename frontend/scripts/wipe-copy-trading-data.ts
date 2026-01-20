
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🧹 Wiping Copy Trading Data...');

    // 1. Delete CopyTrades (Child)
    const { count: trades } = await prisma.copyTrade.deleteMany({});
    console.log(`✅ Deleted ${trades} copy trades.`);

    // 2. Delete UserPositions
    const { count: positions } = await prisma.userPosition.deleteMany({});
    console.log(`✅ Deleted ${positions} user positions.`);

    // 3. Delete Configs (Parent)
    const { count: configs } = await prisma.copyTradingConfig.deleteMany({});
    console.log(`✅ Deleted ${configs} configs.`);

    console.log('\n✨ Database is clean!');
    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
