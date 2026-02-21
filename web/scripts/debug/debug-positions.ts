import 'dotenv/config';
import { prisma } from '../../lib/prisma';
import { PrismaClient } from '@prisma/client';

// const prisma = new PrismaClient(); // Removed local init
const WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // Default hardhat/anvil wallet from previous context or generic

async function main() {
    const normalizedWallet = WALLET.toLowerCase();

    console.log(`Checking positions for ${normalizedWallet}...`);

    const positions = await prisma.userPosition.findMany({
        where: {
            walletAddress: normalizedWallet,
            balance: { gt: 0 }
        }
    });

    console.log(`Found ${positions.length} active positions.`);

    let calcTotalInvested = 0;
    let calcTotalValueAtEntry = 0; // Balance * AvgEntry

    console.table(positions.map(p => {
        calcTotalInvested += p.totalCost;
        const valueAtEntry = p.balance * p.avgEntryPrice;
        calcTotalValueAtEntry += valueAtEntry;

        return {
            slug: p.tokenId.slice(0, 10) + '...', // Use tokenId instead of missing slug
            balance: p.balance.toFixed(2),
            entry: p.avgEntryPrice.toFixed(3),
            totalCost: p.totalCost.toFixed(2),
            derivedCost: valueAtEntry.toFixed(2),
            diff: (p.totalCost - valueAtEntry).toFixed(2)
        };
    }));

    console.log(`\n--- Summary ---`);
    console.log(`DB Total Cost (Invested): $${calcTotalInvested.toFixed(2)}`);
    console.log(`Derived (Bal * px):     $${calcTotalValueAtEntry.toFixed(2)}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
