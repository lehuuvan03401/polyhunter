import { PrismaClient } from '../frontend/node_modules/@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to determine which .env file to load
const getEnvFile = () => {
    // If explicit file, return it
    if (process.env.ENV_FILE) return process.env.ENV_FILE;
    if (process.env.NODE_ENV === 'production') return '.env.production';
    if (process.env.NODE_ENV === 'test') return '.env.test';
    return '.env.local';
};

// Load environment variables from the correct file in frontend directory
const envPath = path.resolve(__dirname, '../frontend', getEnvFile());
console.log(`[Archive] Loading environment from: ${envPath}`);
dotenv.config({ path: envPath });

if (!process.env.DATABASE_URL) {
    console.error('[Archive] DATABASE_URL is missing!');
    process.exit(1);
}
console.log(`[Archive] DB URL found (length: ${process.env.DATABASE_URL.length})`);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const RETENTION_DAYS = 90;
const BATCH_SIZE = 1000;
const RUN_POST_ARCHIVE_MAINTENANCE = process.env.ARCHIVE_RUN_VACUUM !== 'false';

async function archiveCopyTrades() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    console.log(`[Archive] Archiving CopyTrades older than ${cutoffDate.toISOString()}...`);

    let totalArchived = 0;
    while (true) {
        // Fetch batch of old records
        const records = await prisma.copyTrade.findMany({
            where: {
                detectedAt: { lt: cutoffDate },
                status: { in: ['EXECUTED', 'SKIPPED', 'FAILED'] }
            },
            take: BATCH_SIZE
        });

        if (records.length === 0) break;

        console.log(`[Archive] Processing batch of ${records.length} records...`);

        // Perform Transaction: Copy to Archive -> Delete from Main
        await prisma.$transaction(async (tx: any) => {
            // Bulk Create in Archive
            await tx.copyTradeArchive.createMany({
                data: records.map((r: any) => ({
                    id: r.id,
                    configId: r.configId,
                    originalTrader: r.originalTrader,
                    originalSide: r.originalSide,
                    leaderSide: r.leaderSide,
                    originalSize: r.originalSize,
                    originalPrice: r.originalPrice,
                    marketSlug: r.marketSlug,
                    originalTxHash: r.originalTxHash,
                    conditionId: r.conditionId,
                    tokenId: r.tokenId,
                    outcome: r.outcome,
                    copySize: r.copySize,
                    copyPrice: r.copyPrice,
                    status: r.status,
                    txHash: r.txHash,
                    errorMessage: r.errorMessage,
                    realizedPnL: r.realizedPnL,
                    usedBotFloat: r.usedBotFloat,
                    executedBy: r.executedBy,
                    retryCount: r.retryCount,
                    nextRetryAt: r.nextRetryAt,
                    detectedAt: r.detectedAt,
                    executedAt: r.executedAt,
                    expiresAt: r.expiresAt,
                    archivedAt: new Date()
                })),
                skipDuplicates: true // Safety against re-runs
            });

            // Bulk Delete from Main
            await tx.copyTrade.deleteMany({
                where: {
                    id: { in: records.map((r: any) => r.id) }
                }
            });
        });

        totalArchived += records.length;
        console.log(`[Archive] Archived ${totalArchived} records so far...`);
    }

    console.log(`[Archive] CopyTrade Archiving Complete. Total: ${totalArchived}`);
}

async function archiveCommissionLogs() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    console.log(`[Archive] Archiving CommissionLogs older than ${cutoffDate.toISOString()}...`);

    let totalArchived = 0;
    while (true) {
        const records = await prisma.commissionLog.findMany({
            where: {
                createdAt: { lt: cutoffDate }
            },
            take: BATCH_SIZE
        });

        if (records.length === 0) break;

        await prisma.$transaction(async (tx: any) => {
            await tx.commissionLogArchive.createMany({
                data: records.map((r: any) => ({
                    id: r.id,
                    referrerId: r.referrerId,
                    amount: r.amount,
                    type: r.type,
                    sourceTradeId: r.sourceTradeId,
                    sourceUserId: r.sourceUserId,
                    generation: r.generation,
                    createdAt: r.createdAt,
                    archivedAt: new Date()
                })),
                skipDuplicates: true
            });

            await tx.commissionLog.deleteMany({
                where: {
                    id: { in: records.map((r: any) => r.id) }
                }
            });
        });

        totalArchived += records.length;
        console.log(`[Archive] Archived ${records.length} logs (Total: ${totalArchived})...`);
    }
    console.log(`[Archive] CommissionLog Archiving Complete. Total: ${totalArchived}`);
}

async function runPostArchiveMaintenance() {
    if (!RUN_POST_ARCHIVE_MAINTENANCE) {
        console.log('[Archive] Post-archive maintenance disabled (ARCHIVE_RUN_VACUUM=false).');
        return;
    }

    console.log('[Archive] Running VACUUM (ANALYZE) on CopyTrade and CommissionLog...');
    await pool.query('VACUUM (ANALYZE) "CopyTrade";');
    await pool.query('VACUUM (ANALYZE) "CommissionLog";');
    console.log('[Archive] Post-archive maintenance complete.');
}

async function main() {
    try {
        await archiveCopyTrades();
        await archiveCommissionLogs();
        await runPostArchiveMaintenance();
    } catch (e) {
        console.error('[Archive] Error during archiving:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
