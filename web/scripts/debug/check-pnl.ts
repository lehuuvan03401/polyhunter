
import '../env/env-setup'; // Load Env FIRST
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const walletAddress = process.argv[2];
    if (!walletAddress) {
        console.error("Please provide a wallet address as an argument.");
        // Try to find the most active wallet if none provided?
        // Or just query all?
        // Let's just query everything if no wallet, acting as "God Mode"
        console.log("No wallet provided. Aggregating ALL records...");
    }

    const whereClause = walletAddress ? {
        config: {
            walletAddress: walletAddress.toLowerCase()
        }
    } : {};

    console.log("Querying database...");

    const winsSum = await prisma.copyTrade.aggregate({
        where: {
            ...whereClause,
            status: 'EXECUTED',
            realizedPnL: { gt: 0 }
        },
        _sum: { realizedPnL: true }
    });

    const lossesSum = await prisma.copyTrade.aggregate({
        where: {
            ...whereClause,
            status: 'EXECUTED',
            realizedPnL: { lt: 0 }
        },
        _sum: { realizedPnL: true }
    });

    const totalWin = winsSum._sum.realizedPnL || 0;
    const totalLoss = lossesSum._sum.realizedPnL || 0;
    const net = totalWin + totalLoss;

    console.log("------------------------------------------------");
    console.log("DATABASE REPORT");
    console.log("------------------------------------------------");
    console.log(`Realized Wins (W):   $${totalWin.toFixed(2)}`);
    console.log(`Realized Losses (L): $${totalLoss.toFixed(2)}`);
    console.log(`Net Trading PnL:     $${net.toFixed(2)}`);
    console.log("------------------------------------------------");
    console.log(`(Exact Float W):     ${totalWin}`);
    console.log(`(Exact Float L):     ${totalLoss}`);
    console.log(`(Exact Float Net):   ${net}`);
    console.log("------------------------------------------------");

    await prisma.$disconnect();
}

main().catch(console.error);
