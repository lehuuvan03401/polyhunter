
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🔍 Inspecting Recent Trades...');

    const trades = await prisma.copyTrade.findMany({
        take: 10,
        orderBy: { executedAt: 'desc' },
        select: {
            id: true,
            marketSlug: true,
            tokenId: true,
            originalPrice: true,
            executedAt: true
        }
    });

    console.log(JSON.stringify(trades, null, 2));
    await prisma.$disconnect();
}

main();
