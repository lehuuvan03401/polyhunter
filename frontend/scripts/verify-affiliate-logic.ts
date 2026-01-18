
import { PrismaClient, AffiliateTier } from '@prisma/client';
import { AffiliateEngine } from '../lib/services/affiliate-engine';
import dotenv from 'dotenv';
import path from 'path';

import { PrismaLibSql } from '@prisma/adapter-libsql';

// Load .env from frontend directory
const envPath = path.resolve(__dirname, '../.env');
console.log(`Loading env from: ${envPath}`);
dotenv.config({ path: envPath });

// Resolve database path - relative to CWD (frontend root)
const dbPath = path.join(process.cwd(), 'dev.db');
console.log(`DB Path: ${dbPath}`);

const adapter = new PrismaLibSql({
    url: `file:${dbPath}`,
});

const prisma = new PrismaClient({
    adapter,
});
const engine = new AffiliateEngine(prisma);

async function main() {
    console.log("🚀 Starting Affiliate System Verification...");

    // 1. Cleanup
    await prisma.referral.deleteMany({});
    await prisma.teamClosure.deleteMany({});
    await prisma.referrer.deleteMany({});
    console.log("✅ Database cleaned.");

    // 2. Setup Hierarchy
    // Structure:
    // Root (Super Partner, 8%)
    //  -> A (Partner, 5%)
    //    -> B (Elite, 3%)
    //      -> C (VIP, 2%)
    //        -> D (Ordinary, 1%)
    //          -> E (Ordinary, 1%)
    //            -> Trader (User)

    console.log("🏗️ Building Hierarchy...");

    // Create Root
    const root = await engine.registerMember('0xROOT', undefined);
    await updateTier(root.id, AffiliateTier.SUPER_PARTNER);

    // Create A (under Root)
    const userA = await engine.registerMember('0xA', root.referralCode);
    await updateTier(userA.id, AffiliateTier.PARTNER);

    // Create B (under A)
    const userB = await engine.registerMember('0xB', userA.referralCode);
    await updateTier(userB.id, AffiliateTier.ELITE);

    // Create C (under B)
    const userC = await engine.registerMember('0xC', userB.referralCode);
    await updateTier(userC.id, AffiliateTier.VIP);

    // Create D (under C)
    const userD = await engine.registerMember('0xD', userC.referralCode);
    // Ordinary by default

    // Create E (under D) - Direct Sponsor of Trader
    const userE = await engine.registerMember('0xE', userD.referralCode);
    // Ordinary by default

    // Register Trader (linked to E)
    // Note: AffiliateEngine.registerMember creates a REFERRER entity.
    // The actual "User" who trades is linked via `Referral` table to the Referrer.
    // Let's create a Referral record for the Trader.
    const traderAddress = '0xTRADER';

    // Create Referral Link: E refers Trader
    await prisma.referral.create({
        data: {
            refereeAddress: traderAddress,
            referrerId: userE.id,
            lifetimeVolume: 0
        }
    });

    console.log("✅ Hierarchy built.");

    // 3. Simulate Trade
    // Volume: $10,000
    // Fee: $10 (0.1%) -> This is the pot for commissions.
    // Logic check: The code uses `context.platformFee` for calculations.

    const tradeContext = {
        tradeId: 'trade-001',
        traderAddress: traderAddress,
        volume: 10000,
        platformFee: 100 // $100 fee for easy math
    };

    console.log(`💰 Simulating Trade: Feepot $${tradeContext.platformFee}`);
    await engine.distributeCommissions(tradeContext);

    // 4. Verification
    console.log("🔍 Verifying Commissions...");

    const checkCommission = async (wallet: string, expectedAmount: number, description: string) => {
        const user = await prisma.referrer.findUnique({ where: { walletAddress: wallet } });
        const actual = user?.totalEarned || 0;
        // Float comparison
        const diff = Math.abs(actual - expectedAmount);
        const passed = diff < 0.0001;

        console.log(`   ${passed ? '✅' : '❌'} ${wallet} (${description}): Expected $${expectedAmount.toFixed(4)}, Got $${actual.toFixed(4)}`);
        if (!passed) throw new Error(`Verification failed for ${wallet}`);
    };

    // --- EXPECTED CALCULATIONS ---
    // Fee: $100

    // ** ZERO LINE (Fixed) **
    // Gen 1 (E): 25% = $25.00
    // Gen 2 (D): 10% = $10.00
    // Gen 3 (C): 5%  = $5.00
    // Gen 4 (B): 3%  = $3.00
    // Gen 5 (A): 2%  = $2.00
    // Gen 6 (Root): 0% (Out of 5 gen range)

    // ** SUN LINE (Differential) **
    // Variable `maxRatePaid` starts at 0.

    // 1. E (Ordinary, 1%). 
    //    Diff = 1% - 0% = 1%. Bonus = $1.00.
    //    Total E = 25 (Zero) + 1 (Sun) = $26.00
    //    maxRatePaid = 1%.

    // 2. D (Ordinary, 1%).
    //    Diff = 1% - 1% = 0%. Bonus = 0.
    //    Total D = 10 (Zero) + 0 (Sun) = $10.00
    //    maxRatePaid = 1%.

    // 3. C (VIP, 2%).
    //    Diff = 2% - 1% = 1%. Bonus = $1.00.
    //    Total C = 5 (Zero) + 1 (Sun) = $6.00
    //    maxRatePaid = 2%.

    // 4. B (Elite, 3%).
    //    Diff = 3% - 2% = 1%. Bonus = $1.00.
    //    Total B = 3 (Zero) + 1 (Sun) = $4.00
    //    maxRatePaid = 3%.

    // 5. A (Partner, 5%).
    //    Diff = 5% - 3% = 2%. Bonus = $2.00.
    //    Total A = 2 (Zero) + 2 (Sun) = $4.00
    //    maxRatePaid = 5%.

    // 6. Root (Super Partner, 8%).
    //    Diff = 8% - 5% = 3%. Bonus = $3.00.
    //    Total Root = 0 (Zero) + 3 (Sun) = $3.00.
    //    maxRatePaid = 8%.

    await checkCommission('0xE', 26.00, "Direct (Gen1 Ord)");
    await checkCommission('0xD', 10.00, "Gen2 Ord (Breakaway)");
    await checkCommission('0xC', 6.00, "Gen3 VIP");
    await checkCommission('0xB', 4.00, "Gen4 Elite");
    await checkCommission('0xA', 4.00, "Gen5 Partner");
    await checkCommission('0xROOT', 3.00, "Gen6 SuperPartner (Sun Only)");

    console.log("\n🎉 ALL CHECKS PASSED!");
}

async function updateTier(id: string, tier: AffiliateTier) {
    await prisma.referrer.update({
        where: { id },
        data: { tier }
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
