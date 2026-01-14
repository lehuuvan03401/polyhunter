
import { prisma } from '../lib/prisma';

async function main() {
    console.log('Checking for executed CopyTrades...');

    const trades = await prisma.copyTrade.findMany({
        where: {
            status: 'EXECUTED'
        }
    });

    console.log(`Found ${trades.length} EXECUTED trades.`);

    if (trades.length > 0) {
        console.log('Sample trade:', trades[0]);
    }

    const allTrades = await prisma.copyTrade.count();
    const configs = await prisma.copyTradingConfig.count();

    console.log(`Total CopyTrades: ${allTrades}`);
    console.log(`Total Configs: ${configs}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
