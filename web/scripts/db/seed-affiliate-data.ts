/**
 * Seed realistic Affiliate System data for testing Admin Dashboard
 * Run: npx tsx scripts/seed-affiliate-data.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import dotenv from 'dotenv';
import path from 'path';

// Load environment
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbPath = path.join(process.cwd(), 'dev.db');
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

// Helper to generate random wallet address
function randomWallet(): string {
    const hex = '0123456789abcdef';
    let addr = '0x';
    for (let i = 0; i < 40; i++) {
        addr += hex[Math.floor(Math.random() * 16)];
    }
    return addr;
}

// Helper to generate referral code
function randomCode(length = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

async function main() {
    console.log('🌱 Seeding Affiliate Data...\n');

    // Clean existing data (optional - uncomment if needed)
    await prisma.commissionLog.deleteMany({});
    await prisma.referralVolume.deleteMany({});
    await prisma.teamClosure.deleteMany({});
    await prisma.referral.deleteMany({});
    await prisma.payout.deleteMany({});
    await prisma.referrer.deleteMany({});
    console.log('✅ Cleaned existing affiliate data\n');

    // ========================
    // TIER 1: Super Partner (Root)
    // ========================
    const superPartner = await prisma.referrer.create({
        data: {
            walletAddress: '0xSuperPartner001aaa1111222233334444555566',
            referralCode: 'WHALE001',
            tier: 'SUPER_PARTNER',
            totalEarned: 15420.50,
            pendingPayout: 2150.00,
            totalVolume: 125000.00,
        }
    });
    console.log(`🐋 Created Super Partner: ${superPartner.referralCode}`);

    // Self-closure (depth=0)
    await prisma.teamClosure.create({
        data: { ancestorId: superPartner.id, descendantId: superPartner.id, depth: 0 }
    });

    // ========================
    // TIER 2: Partners (2 under Super)
    // ========================
    const partners = [];
    for (let i = 0; i < 2; i++) {
        const partner = await prisma.referrer.create({
            data: {
                walletAddress: randomWallet(),
                referralCode: `PARTNER${i + 1}`,
                tier: 'PARTNER',
                totalEarned: 3500 + Math.random() * 2000,
                pendingPayout: 200 + Math.random() * 500,
                totalVolume: 45000 + Math.random() * 15000,
            }
        });
        partners.push(partner);
        console.log(`  🤝 Created Partner: ${partner.referralCode}`);

        await prisma.referral.create({
            data: {
                referrerId: superPartner.id,
                refereeAddress: partner.walletAddress,
            }
        });

        // Create TeamClosure entries
        await prisma.teamClosure.createMany({
            data: [
                { ancestorId: partner.id, descendantId: partner.id, depth: 0 },
                { ancestorId: superPartner.id, descendantId: partner.id, depth: 1 },
            ]
        });
    }

    // ========================
    // TIER 3: Elites (3 under each Partner)
    // ========================
    const elites = [];
    for (const partner of partners) {
        for (let i = 0; i < 3; i++) {
            const elite = await prisma.referrer.create({
                data: {
                    walletAddress: randomWallet(),
                    referralCode: randomCode(),
                    tier: 'ELITE',
                    totalEarned: 800 + Math.random() * 700,
                    pendingPayout: 50 + Math.random() * 150,
                    totalVolume: 12000 + Math.random() * 8000,
                }
            });
            elites.push({ referrer: elite, parentId: partner.id });
            console.log(`    💎 Created Elite: ${elite.referralCode}`);

            await prisma.referral.create({
                data: {
                    referrerId: partner.id,
                    refereeAddress: elite.walletAddress,
                }
            });

            await prisma.teamClosure.createMany({
                data: [
                    { ancestorId: elite.id, descendantId: elite.id, depth: 0 },
                    { ancestorId: partner.id, descendantId: elite.id, depth: 1 },
                    { ancestorId: superPartner.id, descendantId: elite.id, depth: 2 },
                ]
            });
        }
    }

    // ========================
    // TIER 4: VIPs (2-4 under each Elite)
    // ========================
    const vips = [];
    for (const { referrer: elite, parentId } of elites) {
        const vipCount = 2 + Math.floor(Math.random() * 3); // 2-4
        for (let i = 0; i < vipCount; i++) {
            const vip = await prisma.referrer.create({
                data: {
                    walletAddress: randomWallet(),
                    referralCode: randomCode(),
                    tier: 'VIP',
                    totalEarned: 150 + Math.random() * 350,
                    pendingPayout: 10 + Math.random() * 80,
                    totalVolume: 3000 + Math.random() * 4000,
                }
            });
            vips.push({ referrer: vip, parentId: elite.id, grandParentId: parentId });

            await prisma.referral.create({
                data: {
                    referrerId: elite.id,
                    refereeAddress: vip.walletAddress,
                }
            });

            // Find all ancestors for closure table
            const partnerAncestor = partners.find(p => p.id === parentId);
            await prisma.teamClosure.createMany({
                data: [
                    { ancestorId: vip.id, descendantId: vip.id, depth: 0 },
                    { ancestorId: elite.id, descendantId: vip.id, depth: 1 },
                    { ancestorId: parentId, descendantId: vip.id, depth: 2 },
                    { ancestorId: superPartner.id, descendantId: vip.id, depth: 3 },
                ]
            });
        }
        console.log(`      ⭐ Created ${vipCount} VIPs under Elite ${elite.referralCode}`);
    }

    // ========================
    // TIER 5: Ordinary (1-3 under each VIP)
    // ========================
    let ordinaryCount = 0;
    for (const { referrer: vip, parentId: eliteId, grandParentId: partnerId } of vips) {
        const count = 1 + Math.floor(Math.random() * 3); // 1-3
        for (let i = 0; i < count; i++) {
            const ordinary = await prisma.referrer.create({
                data: {
                    walletAddress: randomWallet(),
                    referralCode: randomCode(),
                    tier: 'ORDINARY',
                    totalEarned: Math.random() * 100,
                    pendingPayout: Math.random() * 20,
                    totalVolume: 500 + Math.random() * 2000,
                }
            });
            ordinaryCount++;

            await prisma.referral.create({
                data: {
                    referrerId: vip.id,
                    refereeAddress: ordinary.walletAddress,
                }
            });

            await prisma.teamClosure.createMany({
                data: [
                    { ancestorId: ordinary.id, descendantId: ordinary.id, depth: 0 },
                    { ancestorId: vip.id, descendantId: ordinary.id, depth: 1 },
                    { ancestorId: eliteId, descendantId: ordinary.id, depth: 2 },
                    { ancestorId: partnerId, descendantId: ordinary.id, depth: 3 },
                    { ancestorId: superPartner.id, descendantId: ordinary.id, depth: 4 },
                ]
            });
        }
    }
    console.log(`        👤 Created ${ordinaryCount} Ordinary users\n`);

    // ========================
    // Add some Commission Logs
    // ========================
    const allReferrers = await prisma.referrer.findMany();
    for (const ref of allReferrers.slice(0, 10)) {
        await prisma.commissionLog.create({
            data: {
                referrerId: ref.id,
                amount: 10 + Math.random() * 100,
                type: 'ZERO_LINE',
                sourceUserId: randomWallet(),
                generation: Math.floor(Math.random() * 5) + 1,
                createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
            }
        });
    }
    console.log('📊 Created sample Commission Logs');

    // ========================
    // Add some Payouts
    // ========================
    await prisma.payout.create({
        data: {
            referrerId: superPartner.id,
            amountUsd: 5000,
            status: 'COMPLETED',
            txHash: '0x' + 'a'.repeat(64),
        }
    });
    await prisma.payout.create({
        data: {
            referrerId: partners[0].id,
            amountUsd: 1200,
            status: 'PENDING',
        }
    });
    console.log('💰 Created sample Payouts\n');

    // ========================
    // Summary
    // ========================
    const stats = {
        superPartners: 1,
        partners: partners.length,
        elites: elites.length,
        vips: vips.length,
        ordinary: ordinaryCount,
        total: 1 + partners.length + elites.length + vips.length + ordinaryCount
    };

    console.log('═══════════════════════════════════════');
    console.log('📈 SEED COMPLETE - Summary:');
    console.log('═══════════════════════════════════════');
    console.log(`  🐋 Super Partners: ${stats.superPartners}`);
    console.log(`  🤝 Partners:       ${stats.partners}`);
    console.log(`  💎 Elites:         ${stats.elites}`);
    console.log(`  ⭐ VIPs:           ${stats.vips}`);
    console.log(`  👤 Ordinary:       ${stats.ordinary}`);
    console.log('───────────────────────────────────────');
    console.log(`  📊 TOTAL:          ${stats.total} affiliates`);
    console.log('═══════════════════════════════════════\n');

    console.log('🎯 Now visit Admin Dashboard → Affiliates tab to view data!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
