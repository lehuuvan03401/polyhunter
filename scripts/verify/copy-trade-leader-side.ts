import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const rows = await prisma.copyTrade.findMany({
        take: 20,
        orderBy: { detectedAt: 'desc' },
        select: {
            id: true,
            originalTrader: true,
            originalSide: true,
            leaderSide: true,
            detectedAt: true,
        },
    });

    if (rows.length === 0) {
        console.log('No copy trades found.');
        return;
    }

    const missing = rows.filter((r) => r.originalTrader !== 'POLYMARKET_SETTLEMENT' && !r.leaderSide);
    console.log(`Checked ${rows.length} trades. Missing leaderSide: ${missing.length}`);

    for (const row of missing) {
        console.log(`${row.id} | originalSide=${row.originalSide} | leaderSide=${row.leaderSide}`);
    }
}

main()
    .catch((err) => {
        console.error('Leader side verification failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
