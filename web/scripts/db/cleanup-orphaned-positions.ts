import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function cleanup() {
    console.log('Fetching active positions...');
    const positions = await prisma.userPosition.findMany({
        where: { balance: { gt: 0 } },
        select: { id: true, tokenId: true }
    });

    if (positions.length === 0) {
        console.log('No active positions found.');
        await prisma.$disconnect();
        await pool.end();
        return;
    }

    const tokenIds = positions.map(p => p.tokenId);

    // Find valid trades (that have metadata)
    const validTrades = await prisma.copyTrade.findMany({
        where: {
            tokenId: { in: tokenIds },
            marketSlug: { not: null }
        },
        select: { tokenId: true },
        distinct: ['tokenId']
    });

    const validTokenIdSet = new Set(validTrades.map(t => t.tokenId));

    const idsToDelete: number[] = [];
    for (const p of positions) {
        if (!validTokenIdSet.has(p.tokenId)) {
            idsToDelete.push(p.id);
        }
    }

    if (idsToDelete.length > 0) {
        console.log(`Deleting ${idsToDelete.length} orphaned positions...`);
        await prisma.userPosition.deleteMany({
            where: { id: { in: idsToDelete } }
        });
        console.log('✅ Deleted orphaned positions.');
    } else {
        console.log('No orphaned positions found.');
    }

    await prisma.$disconnect();
    await pool.end();
}

cleanup();
