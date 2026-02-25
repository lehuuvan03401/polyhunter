import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { resolveWalletContext } from '@/lib/managed-wealth/request-wallet';
import {
    PARTICIPATION_MINIMUMS,
    PARTICIPATION_MODES,
    type ParticipationModeValue,
} from '@/lib/participation-program/rules';

export const dynamic = 'force-dynamic';

const accountActionSchema = z.object({
    walletAddress: z.string().min(3),
    action: z.enum(['REGISTER', 'ACTIVATE']),
    mode: z.enum(PARTICIPATION_MODES).optional(),
});

async function getWalletNetDeposits(walletAddress: string) {
    const [depositAgg, withdrawAgg] = await Promise.all([
        prisma.netDepositLedger.aggregate({
            where: { walletAddress, direction: 'DEPOSIT' },
            _sum: {
                usdAmount: true,
                mcnEquivalentAmount: true,
            },
        }),
        prisma.netDepositLedger.aggregate({
            where: { walletAddress, direction: 'WITHDRAW' },
            _sum: {
                usdAmount: true,
                mcnEquivalentAmount: true,
            },
        }),
    ]);

    const depositUsd = Number(depositAgg._sum.usdAmount ?? 0);
    const withdrawUsd = Number(withdrawAgg._sum.usdAmount ?? 0);
    const depositMcn = Number(depositAgg._sum.mcnEquivalentAmount ?? 0);
    const withdrawMcn = Number(withdrawAgg._sum.mcnEquivalentAmount ?? 0);

    return {
        depositUsd,
        withdrawUsd,
        netUsd: depositUsd - withdrawUsd,
        depositMcn,
        withdrawMcn,
        netMcnEquivalent: depositMcn - withdrawMcn,
    };
}

function getEligibility(netMcnEquivalent: number) {
    return {
        freeQualified: netMcnEquivalent >= PARTICIPATION_MINIMUMS.FREE,
        managedQualified: netMcnEquivalent >= PARTICIPATION_MINIMUMS.MANAGED,
        thresholds: PARTICIPATION_MINIMUMS,
    };
}

function getRequiredThreshold(mode: ParticipationModeValue): number {
    return mode === 'MANAGED' ? PARTICIPATION_MINIMUMS.MANAGED : PARTICIPATION_MINIMUMS.FREE;
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
        const account = await prisma.participationAccount.findUnique({
            where: { walletAddress },
        });
        const netDeposits = await getWalletNetDeposits(walletAddress);

        return NextResponse.json({
            account,
            netDeposits,
            eligibility: getEligibility(netDeposits.netMcnEquivalent),
        });
    } catch (error) {
        console.error('[ParticipationAccount] GET failed:', error);
        return NextResponse.json({ error: 'Failed to fetch participation account' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const body = await request.json();
        const parsed = accountActionSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const walletContext = resolveWalletContext(request, {
            bodyWallet: parsed.data.walletAddress,
            requireHeader: true,
            requireSignature: true,
        });
        if (!walletContext.ok) {
            return NextResponse.json({ error: walletContext.error }, { status: walletContext.status });
        }

        const walletAddress = walletContext.wallet;
        const now = new Date();

        if (parsed.data.action === 'REGISTER') {
            const account = await prisma.participationAccount.upsert({
                where: { walletAddress },
                update: {
                    isRegistrationComplete: true,
                    registrationCompletedAt: now,
                },
                create: {
                    walletAddress,
                    isRegistrationComplete: true,
                    registrationCompletedAt: now,
                    status: 'PENDING',
                },
            });

            const netDeposits = await getWalletNetDeposits(walletAddress);
            return NextResponse.json({
                account,
                netDeposits,
                eligibility: getEligibility(netDeposits.netMcnEquivalent),
                message: 'Registration completed',
            });
        }

        if (!parsed.data.mode) {
            return NextResponse.json(
                { error: 'Activation requires mode (FREE or MANAGED)' },
                { status: 400 }
            );
        }

        const existing = await prisma.participationAccount.findUnique({
            where: { walletAddress },
            select: {
                id: true,
                status: true,
                isRegistrationComplete: true,
            },
        });

        if (!existing || !existing.isRegistrationComplete) {
            return NextResponse.json(
                { error: 'Registration must be completed before activation' },
                { status: 409 }
            );
        }

        const netDeposits = await getWalletNetDeposits(walletAddress);
        const requiredThreshold = getRequiredThreshold(parsed.data.mode);
        if (netDeposits.netMcnEquivalent < requiredThreshold) {
            return NextResponse.json(
                {
                    error: 'Qualified funding required before activation',
                    mode: parsed.data.mode,
                    requiredThreshold,
                    currentNetMcnEquivalent: netDeposits.netMcnEquivalent,
                    deficit: requiredThreshold - netDeposits.netMcnEquivalent,
                },
                { status: 409 }
            );
        }

        const account = await prisma.participationAccount.update({
            where: { walletAddress },
            data: {
                status: 'ACTIVE',
                preferredMode: parsed.data.mode,
                activatedAt: now,
            },
        });

        return NextResponse.json({
            account,
            netDeposits,
            eligibility: getEligibility(netDeposits.netMcnEquivalent),
            message: 'Participation activated',
        });
    } catch (error) {
        console.error('[ParticipationAccount] POST failed:', error);
        return NextResponse.json({ error: 'Failed to update participation account' }, { status: 500 });
    }
}
