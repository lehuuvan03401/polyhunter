import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: '.env.local.secrets' });

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL or POSTGRES_PRISMA_URL is required');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function normalizeManagedTermsTo360d() {
    const legacyTerms = await prisma.managedTerm.findMany({
        where: { durationDays: 365 },
        include: {
            product: {
                select: {
                    slug: true,
                    strategyProfile: true,
                },
            },
        },
        orderBy: { createdAt: 'asc' },
    });

    if (legacyTerms.length === 0) {
        console.log('No legacy 365-day managed terms found.');
        return;
    }

    let created360 = 0;
    let updated360 = 0;
    let deactivated365 = 0;

    console.log(`Found ${legacyTerms.length} legacy 365-day terms. Normalizing to 360-day terms...`);

    for (const legacyTerm of legacyTerms) {
        await prisma.$transaction(async (tx) => {
            const existing360 = await tx.managedTerm.findUnique({
                where: {
                    productId_durationDays: {
                        productId: legacyTerm.productId,
                        durationDays: 360,
                    },
                },
            });

            if (existing360) {
                await tx.managedTerm.update({
                    where: { id: existing360.id },
                    data: {
                        label: '360D',
                        targetReturnMin: legacyTerm.targetReturnMin,
                        targetReturnMax: legacyTerm.targetReturnMax,
                        maxDrawdown: legacyTerm.maxDrawdown,
                        minYieldRate: legacyTerm.minYieldRate,
                        performanceFeeRate: legacyTerm.performanceFeeRate,
                        maxSubscriptionAmount: legacyTerm.maxSubscriptionAmount,
                        isActive: true,
                    },
                });
                updated360 += 1;
            } else {
                await tx.managedTerm.create({
                    data: {
                        productId: legacyTerm.productId,
                        label: '360D',
                        durationDays: 360,
                        targetReturnMin: legacyTerm.targetReturnMin,
                        targetReturnMax: legacyTerm.targetReturnMax,
                        maxDrawdown: legacyTerm.maxDrawdown,
                        minYieldRate: legacyTerm.minYieldRate,
                        performanceFeeRate: legacyTerm.performanceFeeRate,
                        maxSubscriptionAmount: legacyTerm.maxSubscriptionAmount,
                        isActive: true,
                    },
                });
                created360 += 1;
            }

            if (legacyTerm.isActive) {
                await tx.managedTerm.update({
                    where: { id: legacyTerm.id },
                    data: { isActive: false },
                });
                deactivated365 += 1;
            }
        });

        const activeSubscriptions = await prisma.managedSubscription.count({
            where: {
                termId: legacyTerm.id,
                status: { in: ['PENDING', 'RUNNING', 'MATURED'] },
            },
        });

        if (activeSubscriptions > 0) {
            console.log(
                `- ${legacyTerm.product.slug}: kept ${activeSubscriptions} active subscription(s) on legacy 365-day term id=${legacyTerm.id}`
            );
        } else {
            console.log(`- ${legacyTerm.product.slug}: normalized to 360-day term`);
        }
    }

    console.log('Normalization complete.');
    console.log(`created 360-day terms: ${created360}`);
    console.log(`updated existing 360-day terms: ${updated360}`);
    console.log(`deactivated legacy 365-day terms: ${deactivated365}`);
}

normalizeManagedTermsTo360d()
    .catch((error) => {
        console.error('Failed to normalize managed terms:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
