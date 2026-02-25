import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { resolveWalletContext } from '@/lib/managed-wealth/request-wallet';
import { buildParticipationLevelProgress, startOfUtcDay } from '@/lib/participation-program/levels';

export const dynamic = 'force-dynamic';

const snapshotSchema = z.object({
    date: z.string().datetime().optional(),
    walletAddresses: z.array(z.string().min(3)).max(2000).optional(),
    dryRun: z.boolean().optional().default(false),
});

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '')
    .split(',')
    .map((wallet) => wallet.toLowerCase().trim())
    .filter(Boolean);

function isAdmin(request: NextRequest): boolean {
    const adminWallet = request.headers.get('x-admin-wallet');
    if (process.env.NODE_ENV === 'development' && ADMIN_WALLETS.length === 0) {
        console.warn('[ParticipationLevels] Admin auth bypassed in development mode');
        return true;
    }
    if (!adminWallet) return false;
    return ADMIN_WALLETS.includes(adminWallet.toLowerCase());
}

export async function GET(request: NextRequest) {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const { searchParams } = new URL(request.url);
        const walletContext = resolveWalletContext(request, {
            queryWallet: searchParams.get('wallet'),
            requireHeader: true,
            requireSignature: true,
        });
        if (!walletContext.ok) {
            return NextResponse.json({ error: walletContext.error }, { status: walletContext.status });
        }

        const walletAddress = walletContext.wallet;
        const [progress] = await buildParticipationLevelProgress(prisma, [walletAddress]);

        const latestSnapshot = await prisma.dailyLevelSnapshot.findFirst({
            where: { walletAddress },
            orderBy: { snapshotDate: 'desc' },
        });

        return NextResponse.json({
            walletAddress,
            progress: progress ?? null,
            latestSnapshot,
        });
    } catch (error) {
        console.error('[ParticipationLevels] GET failed:', error);
        return NextResponse.json({ error: 'Failed to fetch level progress' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!isAdmin(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const body = await request.json().catch(() => ({}));
        const parsed = snapshotSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const snapshotDate = startOfUtcDay(parsed.data.date ? new Date(parsed.data.date) : new Date());

        const wallets = parsed.data.walletAddresses?.length
            ? parsed.data.walletAddresses.map((wallet) => wallet.toLowerCase())
            : (
                await prisma.participationAccount.findMany({
                    where: { isRegistrationComplete: true },
                    select: { walletAddress: true },
                })
            ).map((row) => row.walletAddress.toLowerCase());

        const progressRows = await buildParticipationLevelProgress(prisma, wallets);

        if (parsed.data.dryRun) {
            return NextResponse.json({
                snapshotDate,
                dryRun: true,
                processed: progressRows.length,
                rows: progressRows,
            });
        }

        const existingAccounts = await prisma.participationAccount.findMany({
            where: { walletAddress: { in: progressRows.map((row) => row.walletAddress) } },
            select: { id: true, walletAddress: true },
        });
        const existingWalletSet = new Set(existingAccounts.map((row) => row.walletAddress.toLowerCase()));
        const missingWallets = progressRows
            .map((row) => row.walletAddress.toLowerCase())
            .filter((wallet) => !existingWalletSet.has(wallet));

        if (missingWallets.length > 0) {
            await prisma.participationAccount.createMany({
                data: missingWallets.map((walletAddress) => ({
                    walletAddress,
                    status: 'PENDING',
                    isRegistrationComplete: false,
                })),
                skipDuplicates: true,
            });
        }

        const accountRows = await prisma.participationAccount.findMany({
            where: { walletAddress: { in: progressRows.map((row) => row.walletAddress) } },
            select: { id: true, walletAddress: true },
        });
        const accountIdByWallet = new Map(
            accountRows.map((row) => [row.walletAddress.toLowerCase(), row.id])
        );

        const upsertOps = [];
        for (const row of progressRows) {
            const accountId = accountIdByWallet.get(row.walletAddress.toLowerCase());
            if (!accountId) continue;

            upsertOps.push(
                prisma.dailyLevelSnapshot.upsert({
                    where: {
                        walletAddress_snapshotDate: {
                            walletAddress: row.walletAddress,
                            snapshotDate,
                        },
                    },
                    update: {
                        selfNetDepositUsd: row.selfNetDepositUsd,
                        teamNetDepositUsd: row.teamNetDepositUsd,
                        level: row.level,
                        dividendRate: row.dividendRate,
                    },
                    create: {
                        accountId,
                        walletAddress: row.walletAddress,
                        snapshotDate,
                        selfNetDepositUsd: row.selfNetDepositUsd,
                        teamNetDepositUsd: row.teamNetDepositUsd,
                        level: row.level,
                        dividendRate: row.dividendRate,
                    },
                })
            );
        }

        const results = upsertOps.length > 0 ? await prisma.$transaction(upsertOps) : [];

        return NextResponse.json({
            snapshotDate,
            dryRun: false,
            processed: progressRows.length,
            upserted: results.length,
        });
    } catch (error) {
        console.error('[ParticipationLevels] POST failed:', error);
        return NextResponse.json({ error: 'Failed to run level snapshot' }, { status: 500 });
    }
}
