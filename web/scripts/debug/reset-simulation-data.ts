
import 'dotenv/config';
import { prisma } from '../../lib/prisma';

async function main() {
    console.log('🧹 Clearing previous simulation data...');

    try {
        // Must use deleteMany without where for truncation-like behavior
        const deletedTrades = await prisma.copyTrade.deleteMany({});
        console.log(`- Deleted ${deletedTrades.count} copy trades.`);

        const deletedPositions = await prisma.userPosition.deleteMany({});
        console.log(`- Deleted ${deletedPositions.count} user positions.`);

        console.log('✅ Data cleanup complete.');
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
