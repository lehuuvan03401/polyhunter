/**
 * Seed affiliate data for a specific wallet (for UI testing)
 * Run: npx tsx scripts/seed-my-affiliate.ts
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Hardhat default account #0 as fallback
const DEFAULT_WALLET = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'.toLowerCase();

// Get wallet from command line arg or use default
const args = process.argv.slice(2);
const MY_WALLET = (args[0] || DEFAULT_WALLET).toLowerCase();

function randomWallet(): string {
    const hex = '0123456789abcdef';
    let addr = '0x';
    for (let i = 0; i < 40; i++) {
        addr += hex[Math.floor(Math.random() * 16)];
    }
    return addr;
}

function randomCode(length = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

async function main() {
    if (!args[0]) {
        console.log('ℹ️  No wallet address provided, using default hardhat account.');
        console.log('👉 Usage: npx tsx scripts/seed-my-affiliate.ts <YOUR_WALLET_ADDRESS>\n');
    }

    console.log('🎯 Creating Affiliate Data for YOUR Wallet...\n');
    console.log(`📍 Wallet: ${MY_WALLET}\n`);

    // Check if user already exists
    let myReferrer = await prisma.referrer.findUnique({
        where: { walletAddress: MY_WALLET }
    });

    if (myReferrer) {
        console.log(`✅ Found existing referrer: ${myReferrer.referralCode}`);
        // Update with better stats
        myReferrer = await prisma.referrer.update({
            where: { id: myReferrer.id },
            data: {
                tier: 'SUPER_PARTNER',
                totalEarned: 125000.75,
                pendingPayout: 32000.50,
                totalVolume: 450000.00,
                teamVolume: 1250000.00,
            }
        });
    } else {
        // Create new referrer for your wallet
        myReferrer = await prisma.referrer.create({
            data: {
                walletAddress: MY_WALLET,
                referralCode: 'MYWALLET',
                tier: 'SUPER_PARTNER',
                totalEarned: 125000.75,
                pendingPayout: 32000.50,
                totalVolume: 450000.00,
                teamVolume: 1250000.00,
            }
        });
        console.log(`✅ Created new referrer: ${myReferrer.referralCode}`);

        // Self-closure
        await prisma.teamClosure.create({
            data: { ancestorId: myReferrer.id, descendantId: myReferrer.id, depth: 0 }
        });
    }


    // ======== FULL CLEANUP ========
    // Delete all descendants of myReferrer (except self) to ensure clean data
    console.log('🧹 Cleaning up old team data...');

    // 1. Get all descendants from TeamClosure
    const allDescendants = await prisma.teamClosure.findMany({
        where: {
            ancestorId: myReferrer.id,
            depth: { gt: 0 } // Exclude self
        },
        select: { descendantId: true }
    });
    const descendantIds = [...new Set(allDescendants.map(d => d.descendantId))];

    if (descendantIds.length > 0) {
        // 2. Delete all TeamClosure entries for these descendants
        await prisma.teamClosure.deleteMany({
            where: {
                OR: [
                    { descendantId: { in: descendantIds } },
                    { ancestorId: { in: descendantIds } }
                ]
            }
        });

        // 3. Delete all Referral entries involving these descendants
        for (const descId of descendantIds) {
            const desc = await prisma.referrer.findUnique({ where: { id: descId } });
            if (desc) {
                await prisma.referral.deleteMany({
                    where: {
                        OR: [
                            { referrerId: descId },
                            { refereeAddress: desc.walletAddress }
                        ]
                    }
                });
            }
        }

        // 4. Delete commission logs for descendants
        await prisma.commissionLog.deleteMany({
            where: { referrerId: { in: descendantIds } }
        });

        // 5. Delete the descendant Referrer records themselves
        await prisma.referrer.deleteMany({
            where: { id: { in: descendantIds } }
        });

        console.log(`   Deleted ${descendantIds.length} old team members`);
    }

    // Also clean up my referrer's referrals
    await prisma.referral.deleteMany({ where: { referrerId: myReferrer.id } });
    console.log('   Cleaned existing referrals\n');

    // ========================
    // Create Direct Referrals (Gen 1)
    // ========================
    console.log('👥 Creating 25 Direct Referrals (Gen 1)...');
    const directReferrals: any[] = [];
    const totalDirects = 25;

    for (let i = 0; i < totalDirects; i++) {
        const directCode = `D${i + 1}_${randomCode(4)}`;

        let tier: any = 'ORDINARY';
        if (i === 0) tier = 'PARTNER';
        else if (i === 1) tier = 'ELITE';
        else if (i === 2 || i === 3) tier = 'VIP';

        const direct = await prisma.referrer.create({
            data: {
                walletAddress: randomWallet(),
                referralCode: directCode,
                tier: tier,
                totalEarned: 100 + Math.random() * 200,
                pendingPayout: Math.random() * 50,
                totalVolume: 5000 + Math.random() * 10000,
            }
        });
        directReferrals.push(direct);

        // Create referral relationship
        await prisma.referral.create({
            data: {
                referrerId: myReferrer.id,
                refereeAddress: direct.walletAddress,
            }
        });

        // Create closure table entries
        await prisma.teamClosure.createMany({
            data: [
                { ancestorId: direct.id, descendantId: direct.id, depth: 0 },
                { ancestorId: myReferrer.id, descendantId: direct.id, depth: 1 },
            ]
        });

        console.log(`   ⭐ Direct #${i + 1}: ${direct.referralCode} (${direct.tier})`);
    }

    // ========================
    // Create 2nd Level (3 per direct = 15 total) -> Only for the first 5 "active" directs
    // ========================
    console.log('\n👥 Creating 2nd Level Referrals (3 per active direct)...');
    const secondLevel: any[] = [];
    const activeDirects = directReferrals.slice(0, 5); // Only first 5 have teams

    for (let i = 0; i < activeDirects.length; i++) {
        const direct = activeDirects[i];

        // If this is the main PARTNER (first direct), give them a stronger team
        const isMainPartner = i === 0;

        for (let j = 0; j < 3; j++) {
            let subTier = 'ORDINARY';
            if (isMainPartner) {
                if (j === 0) subTier = 'ELITE';
                else if (j === 1) subTier = 'VIP';
            }

            const sub = await prisma.referrer.create({
                data: {
                    walletAddress: randomWallet(),
                    referralCode: randomCode(),
                    tier: subTier as any,
                    totalEarned: Math.random() * 50,
                    pendingPayout: Math.random() * 10,
                    totalVolume: 1000 + Math.random() * 3000,
                }
            });
            secondLevel.push({ referrer: sub, parentId: direct.id });

            await prisma.referral.create({
                data: {
                    referrerId: direct.id,
                    refereeAddress: sub.walletAddress,
                }
            });

            await prisma.teamClosure.createMany({
                data: [
                    { ancestorId: sub.id, descendantId: sub.id, depth: 0 },
                    { ancestorId: direct.id, descendantId: sub.id, depth: 1 },
                    { ancestorId: myReferrer.id, descendantId: sub.id, depth: 2 },
                ]
            });
        }
        console.log(`   📎 Created 3 under ${direct.referralCode} ${isMainPartner ? '(Strong Team)' : ''}`);
    }

    // ========================
    // Create 3rd Level (2 per 2nd level = 30 total)
    // ========================
    console.log('\n👥 Creating 3rd Level Referrals (2 per 2nd level)...');

    // ========================
    // Create 3rd Level (Variable per 2nd level)
    // ========================
    console.log('\n👥 Creating 3rd Level Referrals...');

    const thirdLevel: any[] = [];
    let thirdLevelCount = 0;

    for (const { referrer: sub, parentId: directId } of secondLevel) {
        // Determine how many children to create based on Gen 2 tier
        let childCount = 2; // Default for ORDINARY
        if (sub.tier === 'ELITE') childCount = 5;
        else if (sub.tier === 'VIP') childCount = 4;

        for (let k = 0; k < childCount; k++) {
            const third = await prisma.referrer.create({
                data: {
                    walletAddress: randomWallet(),
                    referralCode: randomCode(),
                    tier: 'ORDINARY',
                    totalEarned: Math.random() * 20,
                    pendingPayout: Math.random() * 5,
                    totalVolume: 500 + Math.random() * 1500,
                }
            });
            thirdLevel.push({ referrer: third, parentId: sub.id, grandParentId: directId });
            thirdLevelCount++;

            await prisma.referral.create({
                data: {
                    referrerId: sub.id,
                    refereeAddress: third.walletAddress,
                }
            });

            await prisma.teamClosure.createMany({
                data: [
                    { ancestorId: third.id, descendantId: third.id, depth: 0 },
                    { ancestorId: sub.id, descendantId: third.id, depth: 1 },
                    { ancestorId: directId, descendantId: third.id, depth: 2 },
                    { ancestorId: myReferrer.id, descendantId: third.id, depth: 3 },
                ]
            });
        }
    }
    console.log(`   📎 Created ${thirdLevelCount} 3rd level members (Boosted for VIP/ELITE parents)`);

    // ========================
    // Create 4th Level (Randomly ~15 users under Gen 3)
    // ========================
    console.log('\n👥 Creating 4th Level Referrals (Random distribution)...');

    let fourthLevelCount = 0;
    const fourthLevel: any[] = [];

    // Create 15 users, randomly assigned to Gen 3 parents
    for (let m = 0; m < 15; m++) {
        // Pick a random parent from Gen 3
        const { referrer: parent, parentId: grandParentId, grandParentId: greatGrandParentId } = thirdLevel[Math.floor(Math.random() * thirdLevel.length)];

        const fourth = await prisma.referrer.create({
            data: {
                walletAddress: randomWallet(),
                referralCode: randomCode(),
                tier: 'ORDINARY',
                totalEarned: Math.random() * 10,
                pendingPayout: Math.random() * 2,
                totalVolume: 200 + Math.random() * 800,
            }
        });
        fourthLevel.push(fourth);
        fourthLevelCount++;

        await prisma.referral.create({
            data: {
                referrerId: parent.id,
                refereeAddress: fourth.walletAddress,
            }
        });

        await prisma.teamClosure.createMany({
            data: [
                { ancestorId: fourth.id, descendantId: fourth.id, depth: 0 },
                { ancestorId: parent.id, descendantId: fourth.id, depth: 1 },
                { ancestorId: grandParentId, descendantId: fourth.id, depth: 2 },
                { ancestorId: greatGrandParentId, descendantId: fourth.id, depth: 3 },
                { ancestorId: myReferrer.id, descendantId: fourth.id, depth: 4 },
            ]
        });
    }
    console.log(`   📎 Created ${fourthLevelCount} 4th level members (Deep Network!)`);

    // ========================
    // Update sunLineCount for each direct referral (count their sub-teams)
    // A "Sun Line" is a direct referral who has built their own team
    // ========================
    console.log('\n☀️ Updating Sun Line counts...');
    let strongLegsCount = 0;

    for (const direct of directReferrals) {
        // Count how many sub-members this direct has
        const subTeamSize = await prisma.teamClosure.count({
            where: {
                ancestorId: direct.id,
                depth: { gt: 0 }
            }
        });

        // If they have sub-team members, mark them as a "sun line" contributor
        if (subTeamSize > 0) {
            await prisma.referrer.update({
                where: { id: direct.id },
                data: { sunLineCount: subTeamSize }
            });
            strongLegsCount++;
            console.log(`   ☀️ ${direct.referralCode}: Team of ${subTeamSize} (Strong Leg)`);
        }
    }

    // Update my referrer's sunLineCount (direct referrals with active teams)
    await prisma.referrer.update({
        where: { id: myReferrer.id },
        data: { sunLineCount: strongLegsCount }
    });
    console.log(`   ✅ You have ${strongLegsCount} Sun Lines (Strong Legs)`);

    // ========================
    // Add Commission Logs for your wallet - LINKED TO ACTUAL TEAM MEMBERS
    // ========================
    console.log('\n💰 Creating Commission History (linked to team members)...');

    // Clear old commission logs first
    await prisma.commissionLog.deleteMany({ where: { referrerId: myReferrer.id } });

    // For each direct referral, create ZERO_LINE commission (direct bonus)
    let totalZeroLine = 0;
    let totalSunLine = 0;

    for (const direct of directReferrals) {
        // Direct referral generates ZERO_LINE commission (3% of their volume for ELITE tier)
        const zeroLineAmount = direct.totalVolume * 0.03;
        totalZeroLine += zeroLineAmount;

        await prisma.commissionLog.create({
            data: {
                referrerId: myReferrer.id,
                amount: zeroLineAmount,
                type: 'ZERO_LINE',
                sourceUserId: direct.walletAddress, // Link to this member!
                generation: 1,
                createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
            }
        });
        console.log(`   ⚡ DIRECT ${direct.referralCode}: Zero Line $${zeroLineAmount.toFixed(2)}`);
    }

    // For each 2nd level member, create SUN_LINE commission (team differential)
    for (const { referrer: sub } of secondLevel) {
        // 2nd level generates SUN_LINE commission (ELITE 3% - VIP 2% = 1% differential)
        const sunLineAmount = sub.totalVolume * 0.01;
        totalSunLine += sunLineAmount;

        await prisma.commissionLog.create({
            data: {
                referrerId: myReferrer.id,
                amount: sunLineAmount,
                type: 'SUN_LINE',
                sourceUserId: sub.walletAddress, // Link to this member!
                generation: 2,
                createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
            }
        });
    }

    // For Gen 3 (using the thirdLevel array we created)
    for (const { referrer: third } of thirdLevel) {
        const diffAmount = third.totalVolume * 0.005; // 0.5% differential
        totalSunLine += diffAmount;
        await prisma.commissionLog.create({
            data: {
                referrerId: myReferrer.id,
                amount: diffAmount,
                type: 'SUN_LINE',
                sourceUserId: third.walletAddress,
                generation: 3,
                createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
            }
        });
    }

    // For Gen 4
    for (const fourth of fourthLevel) {
        const diffAmount = fourth.totalVolume * 0.0025; // 0.25% differential for deep gen
        totalSunLine += diffAmount;
        await prisma.commissionLog.create({
            data: {
                referrerId: myReferrer.id,
                amount: diffAmount,
                type: 'SUN_LINE',
                sourceUserId: fourth.walletAddress,
                generation: 4,
                createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
            }
        });
    }

    console.log(`   ☀️ Total Differential/SunLine Comm: $${totalSunLine.toFixed(2)}`);

    // Update my referrer's total earned
    await prisma.referrer.update({
        where: { id: myReferrer.id },
        data: {
            totalEarned: totalZeroLine + totalSunLine,
            pendingPayout: (totalZeroLine + totalSunLine) * 0.25 // 25% pending
        }
    });

    console.log(`\n   📊 Total Zero Line: $${totalZeroLine.toFixed(2)}`);
    console.log(`   📊 Total Sun Line: $${totalSunLine.toFixed(2)}`);
    console.log(`   📊 TOTAL COMMISSION: $${(totalZeroLine + totalSunLine).toFixed(2)}`);

    // ========================
    // Add ReferralVolume records
    // ========================
    console.log('\n📈 Creating Volume History...');
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        await prisma.referralVolume.upsert({
            where: {
                referrerId_date: {
                    referrerId: myReferrer.id,
                    date: date
                }
            },
            update: {},
            create: {
                referrerId: myReferrer.id,
                date: date,
                volumeUsd: 1000 + Math.random() * 5000,
                commissionUsd: 50 + Math.random() * 200,
                tradeCount: Math.floor(5 + Math.random() * 20)
            }
        });
    }
    console.log('   📊 Created 7 days of volume records');

    // ========================
    // Summary
    // ========================
    const totalTeam = await prisma.teamClosure.count({
        where: {
            ancestorId: myReferrer.id,
            depth: { gt: 0 }
        }
    });

    console.log('\n═══════════════════════════════════════');
    console.log('📈 YOUR AFFILIATE PROFILE:');
    console.log('═══════════════════════════════════════');
    console.log(`  🏷️  Referral Code: ${myReferrer.referralCode}`);
    console.log(`  💎 Tier: ${myReferrer.tier}`);
    console.log(`  👥 Direct Referrals: ${directReferrals.length}`);
    console.log(`  🌳 Total Team Size: ${totalTeam}`);
    console.log(`  💰 Total Earned: ${(totalZeroLine + totalSunLine).toFixed(2)}`); // display computed var for accuracy
    console.log('═══════════════════════════════════════\n');

    console.log('🎯 Now visit http://localhost:3000/affiliate to see your dashboard!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
