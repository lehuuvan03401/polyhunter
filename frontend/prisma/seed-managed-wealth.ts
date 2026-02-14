import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, StrategyProfile } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local.secrets' });

type TermTemplate = {
    durationDays: number;
    label: string;
    targetReturnMin: number;
    targetReturnMax: number;
    maxDrawdown: number;
    minYieldRate?: number;
};

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const termsByStrategy: Record<StrategyProfile, TermTemplate[]> = {
    CONSERVATIVE: [
        { durationDays: 1, label: '1D', targetReturnMin: 0.02, targetReturnMax: 0.05, maxDrawdown: 0.3, minYieldRate: 0.005 },
        { durationDays: 3, label: '3D', targetReturnMin: 0.05, targetReturnMax: 0.12, maxDrawdown: 0.6, minYieldRate: 0.012 },
        { durationDays: 7, label: '7D', targetReturnMin: 0.12, targetReturnMax: 0.35, maxDrawdown: 1.2, minYieldRate: 0.03 },
        { durationDays: 15, label: '15D', targetReturnMin: 0.3, targetReturnMax: 0.9, maxDrawdown: 2.0, minYieldRate: 0.06 },
        { durationDays: 30, label: '30D', targetReturnMin: 0.8, targetReturnMax: 2.2, maxDrawdown: 3.5, minYieldRate: 0.12 },
        { durationDays: 60, label: '60D', targetReturnMin: 1.8, targetReturnMax: 4.8, maxDrawdown: 5.0, minYieldRate: 0.25 },
        { durationDays: 90, label: '90D', targetReturnMin: 2.8, targetReturnMax: 7.0, maxDrawdown: 6.5, minYieldRate: 0.4 },
        { durationDays: 180, label: '180D', targetReturnMin: 5.5, targetReturnMax: 14.5, maxDrawdown: 9.0, minYieldRate: 0.8 },
        { durationDays: 365, label: '365D', targetReturnMin: 12, targetReturnMax: 30, maxDrawdown: 12.0, minYieldRate: 1.6 },
    ],
    MODERATE: [
        { durationDays: 1, label: '1D', targetReturnMin: 0.04, targetReturnMax: 0.12, maxDrawdown: 0.8 },
        { durationDays: 3, label: '3D', targetReturnMin: 0.12, targetReturnMax: 0.35, maxDrawdown: 1.5 },
        { durationDays: 7, label: '7D', targetReturnMin: 0.35, targetReturnMax: 1.2, maxDrawdown: 3.0 },
        { durationDays: 15, label: '15D', targetReturnMin: 0.8, targetReturnMax: 2.8, maxDrawdown: 4.5 },
        { durationDays: 30, label: '30D', targetReturnMin: 2.0, targetReturnMax: 6.0, maxDrawdown: 7.0 },
        { durationDays: 60, label: '60D', targetReturnMin: 4.5, targetReturnMax: 13.0, maxDrawdown: 10.0 },
        { durationDays: 90, label: '90D', targetReturnMin: 7.0, targetReturnMax: 19.0, maxDrawdown: 12.0 },
        { durationDays: 180, label: '180D', targetReturnMin: 14.0, targetReturnMax: 38.0, maxDrawdown: 16.0 },
        { durationDays: 365, label: '365D', targetReturnMin: 30.0, targetReturnMax: 70.0, maxDrawdown: 22.0 },
    ],
    AGGRESSIVE: [
        { durationDays: 1, label: '1D', targetReturnMin: 0.08, targetReturnMax: 0.25, maxDrawdown: 1.8 },
        { durationDays: 3, label: '3D', targetReturnMin: 0.25, targetReturnMax: 0.9, maxDrawdown: 3.5 },
        { durationDays: 7, label: '7D', targetReturnMin: 0.9, targetReturnMax: 3.0, maxDrawdown: 6.5 },
        { durationDays: 15, label: '15D', targetReturnMin: 2.0, targetReturnMax: 7.5, maxDrawdown: 10.0 },
        { durationDays: 30, label: '30D', targetReturnMin: 5.0, targetReturnMax: 16.0, maxDrawdown: 15.0 },
        { durationDays: 60, label: '60D', targetReturnMin: 11.0, targetReturnMax: 32.0, maxDrawdown: 20.0 },
        { durationDays: 90, label: '90D', targetReturnMin: 18.0, targetReturnMax: 50.0, maxDrawdown: 25.0 },
        { durationDays: 180, label: '180D', targetReturnMin: 35.0, targetReturnMax: 90.0, maxDrawdown: 32.0 },
        { durationDays: 365, label: '365D', targetReturnMin: 70.0, targetReturnMax: 180.0, maxDrawdown: 42.0 },
    ],
};

const productDefs = [
    {
        slug: 'safe-income-vault',
        name: 'Safe Income Vault',
        description: 'Conservative managed strategy with principal and minimum-yield protection backed by reserve fund.',
        strategyProfile: 'CONSERVATIVE' as const,
        isGuaranteed: true,
        performanceFeeRate: 0.1,
        reserveCoverageMin: 1.5,
    },
    {
        slug: 'balanced-alpha-vault',
        name: 'Balanced Alpha Vault',
        description: 'Moderate strategy targeting balanced risk and medium-horizon growth.',
        strategyProfile: 'MODERATE' as const,
        isGuaranteed: false,
        performanceFeeRate: 0.15,
        reserveCoverageMin: 1.2,
    },
    {
        slug: 'moonshot-opportunity-vault',
        name: 'Moonshot Opportunity Vault',
        description: 'Aggressive strategy focused on high-volatility opportunities and larger drawdown tolerance.',
        strategyProfile: 'AGGRESSIVE' as const,
        isGuaranteed: false,
        performanceFeeRate: 0.2,
        reserveCoverageMin: 1.2,
    },
];

async function seedProductAndTerms() {
    console.log('Seeding managed wealth products and terms...');

    for (const def of productDefs) {
        const product = await prisma.managedProduct.upsert({
            where: { slug: def.slug },
            update: {
                name: def.name,
                description: def.description,
                strategyProfile: def.strategyProfile,
                isGuaranteed: def.isGuaranteed,
                performanceFeeRate: def.performanceFeeRate,
                reserveCoverageMin: def.reserveCoverageMin,
                isActive: true,
            },
            create: {
                slug: def.slug,
                name: def.name,
                description: def.description,
                strategyProfile: def.strategyProfile,
                isGuaranteed: def.isGuaranteed,
                performanceFeeRate: def.performanceFeeRate,
                reserveCoverageMin: def.reserveCoverageMin,
                disclosurePolicy: 'TRANSPARENT',
                disclosureDelayHours: 0,
                isActive: true,
            },
        });

        const terms = termsByStrategy[def.strategyProfile];
        for (const term of terms) {
            await prisma.managedTerm.upsert({
                where: {
                    productId_durationDays: {
                        productId: product.id,
                        durationDays: term.durationDays,
                    },
                },
                update: {
                    label: term.label,
                    targetReturnMin: term.targetReturnMin,
                    targetReturnMax: term.targetReturnMax,
                    maxDrawdown: term.maxDrawdown,
                    minYieldRate: def.isGuaranteed ? term.minYieldRate ?? null : null,
                    performanceFeeRate: def.performanceFeeRate,
                    isActive: true,
                },
                create: {
                    productId: product.id,
                    label: term.label,
                    durationDays: term.durationDays,
                    targetReturnMin: term.targetReturnMin,
                    targetReturnMax: term.targetReturnMax,
                    maxDrawdown: term.maxDrawdown,
                    minYieldRate: def.isGuaranteed ? term.minYieldRate ?? null : null,
                    performanceFeeRate: def.performanceFeeRate,
                    isActive: true,
                },
            });
        }

        console.log(`Seeded terms for ${product.name}`);
    }
}

async function seedAgentMapping() {
    console.log('Linking managed products with existing agent templates...');

    for (const def of productDefs) {
        const product = await prisma.managedProduct.findUnique({ where: { slug: def.slug } });
        if (!product) continue;

        const matchedAgents = await prisma.agentTemplate.findMany({
            where: {
                isActive: true,
                strategyProfile: def.strategyProfile,
            },
            take: 3,
            orderBy: { createdAt: 'desc' },
        });

        for (const [index, agent] of matchedAgents.entries()) {
            await prisma.managedProductAgent.upsert({
                where: {
                    productId_agentId: {
                        productId: product.id,
                        agentId: agent.id,
                    },
                },
                update: {
                    isPrimary: index === 0,
                    weight: index === 0 ? 0.6 : 0.2,
                },
                create: {
                    productId: product.id,
                    agentId: agent.id,
                    isPrimary: index === 0,
                    weight: index === 0 ? 0.6 : 0.2,
                },
            });
        }

        console.log(`Mapped ${matchedAgents.length} agents to ${def.slug}`);
    }
}

async function main() {
    await seedProductAndTerms();
    await seedAgentMapping();
    console.log('Managed wealth seed completed.');
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
