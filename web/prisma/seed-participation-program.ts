import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { DEFAULT_MANAGED_RETURN_MATRIX } from '../lib/participation-program/rules';

dotenv.config({ path: '.env.local.secrets' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedManagedReturnMatrix() {
    console.log('Seeding managed return matrix...');

    for (const row of DEFAULT_MANAGED_RETURN_MATRIX) {
        await prisma.managedReturnMatrix.upsert({
            where: {
                principalBand_termDays_strategyProfile: {
                    principalBand: row.principalBand,
                    termDays: row.termDays,
                    strategyProfile: row.strategyProfile,
                },
            },
            update: {
                minPrincipalUsd: row.minPrincipalUsd,
                maxPrincipalUsd: row.maxPrincipalUsd,
                returnMin: row.returnMin,
                returnMax: row.returnMax,
                returnUnit: row.returnUnit,
                isActive: true,
            },
            create: {
                principalBand: row.principalBand,
                minPrincipalUsd: row.minPrincipalUsd,
                maxPrincipalUsd: row.maxPrincipalUsd,
                termDays: row.termDays,
                strategyProfile: row.strategyProfile,
                returnMin: row.returnMin,
                returnMax: row.returnMax,
                returnUnit: row.returnUnit,
                isActive: true,
            },
        });
    }

    console.log(`Seeded ${DEFAULT_MANAGED_RETURN_MATRIX.length} matrix rows.`);
}

async function main() {
    await seedManagedReturnMatrix();
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
