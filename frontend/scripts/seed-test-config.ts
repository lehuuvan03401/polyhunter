
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const adapter = new PrismaLibSql({
    url: "file:./dev.db"
});
const prisma = new PrismaClient({ adapter });

async function main() {
    // 0x7099... is Hardhat Account #1, often used as "Trader" in our tests
    const TRADER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const USER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Hardhat #0

    console.log("Seeding Database with Test Config...");

    // Clear existing to avoid unique constraint errors
    await prisma.copyTradingConfig.deleteMany({
        where: {
            walletAddress: USER,
            traderAddress: TRADER
        }
    });

    // Create fresh config
    await prisma.copyTradingConfig.create({
        data: {
            walletAddress: USER,
            traderAddress: TRADER,
            maxSlippage: 1.0,
            slippageType: 'FIXED',
            autoExecute: true,
            channel: 'EVENT_LISTENER',
            mode: 'FIXED_AMOUNT',
            fixedAmount: 10,
            isActive: true
        }
    });

    console.log(`✅ Seeded config: User ${USER} copying Trader ${TRADER}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
