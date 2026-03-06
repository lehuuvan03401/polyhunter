import 'dotenv/config';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { applyBuyToPosition, applySellToPosition } from '../../../../sdk/src/core/position-accounting.js';

type PositionState = {
    walletAddress: string;
    tokenId: string;
    balance: number;
    avgEntryPrice: number;
    totalCost: number;
};

type DriftRow = {
    walletAddress: string;
    tokenId: string;
    expected: PositionState | null;
    actual: PositionState | null;
};

const DATABASE_URL = process.env.DATABASE_URL || '';
const APPLY = process.env.APPLY === 'true' || process.env.APPLY === '1';
const INCLUDE_SETTLEMENT_PENDING = process.env.INCLUDE_SETTLEMENT_PENDING !== 'false';
const TARGET_WALLET = process.env.TARGET_WALLET?.trim().toLowerCase() || null;
const POSITION_EPSILON = 1e-8;

if (!DATABASE_URL) {
    console.error('[BackfillCopyTradingPositions] Missing DATABASE_URL');
    process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

function normalizeTradeSide(value: string | null | undefined): 'BUY' | 'SELL' | null {
    const side = String(value || '').toUpperCase();
    if (side === 'BUY') return 'BUY';
    if (side === 'SELL' || side === 'REDEEM') return 'SELL';
    return null;
}

function upsertPositionState(
    state: Map<string, PositionState>,
    walletAddress: string,
    tokenId: string,
    side: 'BUY' | 'SELL',
    notionalUsd: number,
    price: number
): void {
    if (!Number.isFinite(notionalUsd) || notionalUsd <= 0 || !Number.isFinite(price) || price <= 0) {
        return;
    }

    const shares = notionalUsd / price;
    if (!Number.isFinite(shares) || shares <= 0) {
        return;
    }

    const key = `${walletAddress}:${tokenId}`;
    const current = state.get(key) || {
        walletAddress,
        tokenId,
        balance: 0,
        avgEntryPrice: 0,
        totalCost: 0,
    };

    const next = side === 'BUY'
        ? applyBuyToPosition({
            currentBalance: current.balance,
            currentTotalCost: current.totalCost,
            buyShares: shares,
            buyTotalValue: notionalUsd,
        })
        : applySellToPosition({
            currentBalance: current.balance,
            currentTotalCost: current.totalCost,
            currentAvgEntryPrice: current.avgEntryPrice,
            sellShares: shares,
            sellTotalValue: notionalUsd,
        });

    if (side === 'BUY') {
        state.set(key, {
            walletAddress,
            tokenId,
            balance: next.nextBalance,
            avgEntryPrice: next.nextAvgEntryPrice,
            totalCost: next.nextTotalCost,
        });
        return;
    }

    state.set(key, {
        walletAddress,
        tokenId,
        balance: next.remainingBalance,
        avgEntryPrice: next.remainingAvgEntryPrice,
        totalCost: next.remainingTotalCost,
    });
}

function isSamePosition(a: PositionState | null, b: PositionState | null): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;

    return (
        Math.abs(a.balance - b.balance) <= POSITION_EPSILON
        && Math.abs(a.avgEntryPrice - b.avgEntryPrice) <= POSITION_EPSILON
        && Math.abs(a.totalCost - b.totalCost) <= POSITION_EPSILON
    );
}

async function main() {
    const statuses = INCLUDE_SETTLEMENT_PENDING
        ? ['EXECUTED', 'SETTLEMENT_PENDING']
        : ['EXECUTED'];

    const trades = await prisma.copyTrade.findMany({
        where: {
            status: { in: statuses as any[] },
            tokenId: { not: null },
            copySize: { gt: 0 },
            OR: [
                { copyPrice: { gt: 0 } },
                { originalPrice: { gt: 0 } },
            ],
            ...(TARGET_WALLET
                ? {
                    config: {
                        walletAddress: TARGET_WALLET,
                    },
                }
                : {}),
        },
        select: {
            id: true,
            tokenId: true,
            originalSide: true,
            copySize: true,
            copyPrice: true,
            originalPrice: true,
            executedAt: true,
            detectedAt: true,
            config: {
                select: {
                    walletAddress: true,
                },
            },
        },
        orderBy: [
            { executedAt: 'asc' },
            { detectedAt: 'asc' },
            { id: 'asc' },
        ],
    });

    const expectedPositions = new Map<string, PositionState>();
    const wallets = new Set<string>();
    let skippedTrades = 0;

    for (const trade of trades) {
        const tokenId = trade.tokenId;
        const walletAddress = trade.config.walletAddress.toLowerCase();
        const side = normalizeTradeSide(trade.originalSide);
        const notionalUsd = Number(trade.copySize || 0);
        const price = Number(trade.copyPrice || trade.originalPrice || 0);

        if (!tokenId || !side || !Number.isFinite(notionalUsd) || !Number.isFinite(price) || notionalUsd <= 0 || price <= 0) {
            skippedTrades += 1;
            continue;
        }

        wallets.add(walletAddress);
        upsertPositionState(expectedPositions, walletAddress, tokenId, side, notionalUsd, price);
    }

    const walletList = Array.from(wallets);
    const actualRows = walletList.length > 0
        ? await prisma.userPosition.findMany({
            where: {
                walletAddress: { in: walletList },
            },
            select: {
                walletAddress: true,
                tokenId: true,
                balance: true,
                avgEntryPrice: true,
                totalCost: true,
            },
            orderBy: [
                { walletAddress: 'asc' },
                { tokenId: 'asc' },
            ],
        })
        : [];

    const actualPositions = new Map<string, PositionState>(
        actualRows.map((row) => [
            `${row.walletAddress.toLowerCase()}:${row.tokenId}`,
            {
                walletAddress: row.walletAddress.toLowerCase(),
                tokenId: row.tokenId,
                balance: row.balance,
                avgEntryPrice: row.avgEntryPrice,
                totalCost: row.totalCost,
            },
        ])
    );

    const allKeys = new Set<string>([
        ...expectedPositions.keys(),
        ...actualPositions.keys(),
    ]);

    const driftRows: DriftRow[] = [];
    for (const key of allKeys) {
        const expected = expectedPositions.get(key) || null;
        const actual = actualPositions.get(key) || null;

        const normalizedExpected = expected && expected.balance > POSITION_EPSILON
            ? expected
            : null;
        const normalizedActual = actual && actual.balance > POSITION_EPSILON
            ? actual
            : null;

        if (!isSamePosition(normalizedExpected, normalizedActual)) {
            driftRows.push({
                walletAddress: normalizedExpected?.walletAddress || normalizedActual?.walletAddress || key.split(':')[0],
                tokenId: normalizedExpected?.tokenId || normalizedActual?.tokenId || key.split(':')[1],
                expected: normalizedExpected,
                actual: normalizedActual,
            });
        }
    }

    const rowsToWrite = Array.from(expectedPositions.values())
        .filter((row) => row.balance > POSITION_EPSILON)
        .map((row) => ({
            walletAddress: row.walletAddress,
            tokenId: row.tokenId,
            balance: Number(row.balance.toFixed(10)),
            avgEntryPrice: Number(row.avgEntryPrice.toFixed(10)),
            totalCost: Number(row.totalCost.toFixed(10)),
        }));

    console.log(
        `[BackfillCopyTradingPositions] trades=${trades.length} skippedTrades=${skippedTrades} wallets=${walletList.length} driftRows=${driftRows.length} apply=${APPLY}`
    );

    for (const row of driftRows.slice(0, 20)) {
        console.log(
            `[BackfillCopyTradingPositions] drift wallet=${row.walletAddress} token=${row.tokenId} expected=${JSON.stringify(row.expected)} actual=${JSON.stringify(row.actual)}`
        );
    }

    if (!APPLY) {
        console.log('[BackfillCopyTradingPositions] Dry run only. Re-run with APPLY=true to write rebuilt positions.');
        return;
    }

    if (walletList.length === 0) {
        console.log('[BackfillCopyTradingPositions] No wallets matched the selected scope. Nothing to write.');
        return;
    }

    await prisma.$transaction(async (tx) => {
        await tx.userPosition.deleteMany({
            where: {
                walletAddress: { in: walletList },
            },
        });

        if (rowsToWrite.length > 0) {
            await tx.userPosition.createMany({
                data: rowsToWrite,
            });
        }
    });

    console.log(
        `[BackfillCopyTradingPositions] Applied rebuilt positions for wallets=${walletList.length} rows=${rowsToWrite.length}`
    );
}

main()
    .catch((error) => {
        console.error('[BackfillCopyTradingPositions] Failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
