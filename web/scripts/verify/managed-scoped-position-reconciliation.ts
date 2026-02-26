import 'dotenv/config';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ManagedSubscriptionStatus } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL || '';
if (!DATABASE_URL) {
    console.error('[VerifyManagedScopedPositions] Missing DATABASE_URL');
    process.exit(1);
}

const STRICT = process.argv.includes('--strict');
const BALANCE_TOLERANCE = Number(process.env.MANAGED_SCOPE_RECON_BALANCE_TOLERANCE || 0.0001);
const COST_TOLERANCE = Number(process.env.MANAGED_SCOPE_RECON_COST_TOLERANCE || 0.01);

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

type PositionState = {
    tokenId: string;
    balance: number;
    avgEntryPrice: number;
    totalCost: number;
};

function mapByToken(rows: PositionState[]): Map<string, PositionState> {
    return new Map(rows.map((row) => [row.tokenId, row]));
}

async function main() {
    const activeStatuses: ManagedSubscriptionStatus[] = ['RUNNING', 'MATURED', 'LIQUIDATING'];

    const subscriptions = await prisma.managedSubscription.findMany({
        where: {
            status: { in: activeStatuses },
            copyConfigId: { not: null },
        },
        select: {
            id: true,
            walletAddress: true,
            copyConfigId: true,
        },
        orderBy: { createdAt: 'asc' },
    });

    let checked = 0;
    let clean = 0;
    let backfillRequired = 0;
    let mismatched = 0;

    for (const sub of subscriptions) {
        if (!sub.copyConfigId) continue;
        checked += 1;

        const [tokenRows, scopedRows] = await Promise.all([
            prisma.copyTrade.findMany({
                where: {
                    configId: sub.copyConfigId,
                    tokenId: { not: null },
                    status: { in: ['EXECUTED', 'SETTLEMENT_PENDING'] },
                },
                select: { tokenId: true },
                distinct: ['tokenId'],
            }),
            prisma.managedSubscriptionPosition.findMany({
                where: {
                    subscriptionId: sub.id,
                    balance: { gt: 0 },
                },
                select: {
                    tokenId: true,
                    balance: true,
                    avgEntryPrice: true,
                    totalCost: true,
                },
            }),
        ]);

        const tokenIds = tokenRows
            .map((row) => row.tokenId)
            .filter((tokenId): tokenId is string => Boolean(tokenId));

        if (tokenIds.length === 0) {
            clean += 1;
            continue;
        }

        const legacyRows = await prisma.userPosition.findMany({
            where: {
                walletAddress: sub.walletAddress,
                tokenId: { in: tokenIds },
                balance: { gt: 0 },
            },
            select: {
                tokenId: true,
                balance: true,
                avgEntryPrice: true,
                totalCost: true,
            },
        });

        if (scopedRows.length === 0 && legacyRows.length > 0) {
            backfillRequired += 1;
            console.warn(
                `[VerifyManagedScopedPositions] BACKFILL_REQUIRED subscription=${sub.id} wallet=${sub.walletAddress} legacyTokens=${legacyRows.length}`
            );
            continue;
        }

        const scopedMap = mapByToken(scopedRows);
        const legacyMap = mapByToken(legacyRows);
        const unionTokens = new Set<string>([
            ...Array.from(scopedMap.keys()),
            ...Array.from(legacyMap.keys()),
        ]);

        let hasMismatch = false;

        for (const tokenId of unionTokens) {
            const scoped = scopedMap.get(tokenId);
            const legacy = legacyMap.get(tokenId);

            if (!scoped || !legacy) {
                hasMismatch = true;
                console.warn(
                    `[VerifyManagedScopedPositions] TOKEN_SET_MISMATCH subscription=${sub.id} token=${tokenId} scoped=${Boolean(scoped)} legacy=${Boolean(legacy)}`
                );
                continue;
            }

            const balanceDiff = Math.abs(scoped.balance - legacy.balance);
            const costDiff = Math.abs(scoped.totalCost - legacy.totalCost);
            if (balanceDiff > BALANCE_TOLERANCE || costDiff > COST_TOLERANCE) {
                hasMismatch = true;
                console.warn(
                    `[VerifyManagedScopedPositions] VALUE_MISMATCH subscription=${sub.id} token=${tokenId} balanceDiff=${balanceDiff.toFixed(8)} costDiff=${costDiff.toFixed(6)}`
                );
            }
        }

        if (hasMismatch) {
            mismatched += 1;
        } else {
            clean += 1;
        }
    }

    console.log(
        `[VerifyManagedScopedPositions] checked=${checked} clean=${clean} backfillRequired=${backfillRequired} mismatched=${mismatched}`
    );

    if (STRICT && (backfillRequired > 0 || mismatched > 0)) {
        console.error('[VerifyManagedScopedPositions] Strict mode failed.');
        process.exitCode = 1;
    }
}

main()
    .catch((error) => {
        console.error('[VerifyManagedScopedPositions] Failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
