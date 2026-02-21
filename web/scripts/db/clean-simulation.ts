
import 'dotenv/config';
import { prisma } from '../../lib/prisma';

async function main() {
    console.log('🧹 Cleaning up outdated market data...');

    // 1. Find trades with slugs containing 'biden' or 'trump' or 'election'
    const trades = await prisma.copyTrade.findMany({
        where: {
            OR: [
                { marketSlug: { contains: 'biden', mode: 'insensitive' } },
                { marketSlug: { contains: 'trump', mode: 'insensitive' } },
                { marketSlug: { contains: 'election', mode: 'insensitive' } },
                { marketSlug: { contains: 'coronavirus', mode: 'insensitive' } }
            ]
        }
    });

    console.log(`Found ${trades.length} outdated trades to remove.`);

    if (trades.length > 0) {
        // Delete CopyTrades
        const { count } = await prisma.copyTrade.deleteMany({
            where: {
                id: { in: trades.map(t => t.id) }
            }
        });
        console.log(`✅ Deleted ${count} copy trades.`);

        // Delete associated UserPositions?
        // Positions are unique by Token ID. 
        const tokenIds = trades.map(t => t.tokenId);
        const { count: posCount } = await prisma.userPosition.deleteMany({
            where: {
                tokenId: { in: tokenIds }
            }
        });
        console.log(`✅ Deleted ${posCount} associated positions.`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
