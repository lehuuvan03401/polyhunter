/**
 * Seed affiliate data for a specific wallet (for UI testing)
 * Run: npx tsx scripts/seed-my-affiliate.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const dbPath = path.join(process.cwd(), 'dev.db');
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

// Your wallet address (Hardhat default account #0)
const MY_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'.toLowerCase();

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
                tier: 'ELITE',
                totalEarned: 1250.75,
                pendingPayout: 320.50,
                totalVolume: 45000.00,
                teamVolume: 125000.00,
            }
        });
    } else {
        // Create new referrer for your wallet
        myReferrer = await prisma.referrer.create({
            data: {
                walletAddress: MY_WALLET,
                referralCode: 'MYWALLET',
                tier: 'ELITE',
                totalEarned: 1250.75,
                pendingPayout: 320.50,
                totalVolume: 45000.00,
                teamVolume: 125000.00,
            }
        });
        console.log(`✅ Created new referrer: ${myReferrer.referralCode}`);

        // Self-closure
        await prisma.teamClosure.create({
            data: { ancestorId: myReferrer.id, descendantId: myReferrer.id, depth: 0 }
        });
    }

    // Clean existing referrals for this user (to recreate cleanly)
    const existingReferrals = await prisma.referral.findMany({
        where: { referrerId: myReferrer.id }
    });

    // Delete team closure entries for descendants
    for (const ref of existingReferrals) {
        const descendant = await prisma.referrer.findUnique({
            where: { walletAddress: ref.refereeAddress }
        });
        if (descendant) {
            await prisma.teamClosure.deleteMany({
                where: { descendantId: descendant.id }
            });
        }
    }

    await prisma.referral.deleteMany({ where: { referrerId: myReferrer.id } });
    console.log('🧹 Cleaned existing referrals\n');

    // ========================
    // Create 5 Direct Referrals (VIP level)
    // ========================
    console.log('👥 Creating 5 Direct Referrals...');
    const directReferrals: any[] = [];

    for (let i = 0; i < 5; i++) {
        const directCode = `D${i + 1}_${randomCode(4)}`;
        const direct = await prisma.referrer.create({
            data: {
                walletAddress: randomWallet(),
                referralCode: directCode,
                tier: 'VIP',
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

        console.log(`   ⭐ Direct #${i + 1}: ${direct.referralCode} (VIP)`);
    }

    // ========================
    // Create 2nd Level (3 per direct = 15 total)
    // ========================
    console.log('\n👥 Creating 2nd Level Referrals (3 per direct)...');
    const secondLevel: any[] = [];

    for (const direct of directReferrals) {
        for (let j = 0; j < 3; j++) {
            const sub = await prisma.referrer.create({
                data: {
                    walletAddress: randomWallet(),
                    referralCode: randomCode(),
                    tier: 'ORDINARY',
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
        console.log(`   📎 Created 3 under ${direct.referralCode}`);
    }

    // ========================
    // Create 3rd Level (2 per 2nd level = 30 total)
    // ========================
    console.log('\n👥 Creating 3rd Level Referrals (2 per 2nd level)...');
    let thirdLevelCount = 0;

    for (const { referrer: sub, parentId: directId } of secondLevel) {
        for (let k = 0; k < 2; k++) {
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
    console.log(`   📎 Created ${thirdLevelCount} 3rd level members`);

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
    console.log(`   ☀️ SUN_LINE from 15 Gen2 members: $${totalSunLine.toFixed(2)}`);

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
    console.log(`  👥 Direct Referrals: 5`);
    console.log(`  🌳 Total Team Size: ${totalTeam}`);
    console.log(`  💰 Total Earned: $${myReferrer.totalEarned.toFixed(2)}`);
    console.log(`  💳 Pending Payout: $${myReferrer.pendingPayout.toFixed(2)}`);
    console.log('═══════════════════════════════════════\n');

    console.log('🎯 Now visit http://localhost:3000/affiliate to see your dashboard!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
