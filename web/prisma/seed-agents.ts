import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local.secrets' });

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Seeding Agent Templates...');

    // 1. Safe Mode Agent (Conservative)
    await prisma.agentTemplate.create({
        data: {
            name: "Safe Yield Bot",
            description: "Low risk, steady growth. Targets high liquidity markets with >85% odds.",
            tags: ["Safe", "yield", "Low Drawdown"],
            traderAddress: "0xd83210499b70bb23b7a5446a893c5d7943444444", // Example top trader
            traderName: "VitalikFan",
            strategyProfile: "CONSERVATIVE",
            mode: "PERCENTAGE",
            sizeScale: 0.05, // 5% of portfolio per trade
            maxSizePerTrade: 50,
            stopLoss: 20, // Strict stop loss
            maxOdds: 0.85,
            minLiquidity: 5000,
            avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=SafeBot",
        }
    });

    // 2. Balanced Growth (Moderate)
    await prisma.agentTemplate.create({
        data: {
            name: "Trend Follower",
            description: "Balanced approach. Follows market trends on major events.",
            tags: ["Balanced", "Growth", "Trending"],
            traderAddress: "0x7890123456789012345678901234567890123456",
            traderName: "MarketWizard",
            strategyProfile: "MODERATE",
            mode: "PERCENTAGE",
            sizeScale: 0.1, // 10%
            maxSizePerTrade: 100,
            maxOdds: 0.95,
            minLiquidity: 1000,
            avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=TrendBot",
        }
    });

    // 3. Degen Mode (Aggressive)
    await prisma.agentTemplate.create({
        data: {
            name: "Moonshot Alpha",
            description: "High risk, high reward. Targets underpriced outcomes.",
            tags: ["Aggressive", "High Risk", "Degen"],
            traderAddress: "0x1234567890123456789012345678901234567890",
            traderName: "YoloTrader",
            strategyProfile: "AGGRESSIVE",
            mode: "PERCENTAGE",
            sizeScale: 0.2, // 20%
            maxSizePerTrade: 200,
            stopLoss: 100, // Loose stop loss
            minLiquidity: 100, // Willing to trade low liq
            avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=DegenBot",
        }
    });

    console.log('Seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
