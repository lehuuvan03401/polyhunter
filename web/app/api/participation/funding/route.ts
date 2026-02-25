import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { resolveWalletContext } from '@/lib/managed-wealth/request-wallet';
import {
    PARTICIPATION_FUNDING_CHANNELS,
    PARTICIPATION_MINIMUMS,
} from '@/lib/participation-program/rules';

export const dynamic = 'force-dynamic';

const fundingCreateSchema = z.object({
    walletAddress: z.string().min(3),
    channel: z.enum(PARTICIPATION_FUNDING_CHANNELS),
    direction: z.enum(['DEPOSIT', 'WITHDRAW']).optional().default('DEPOSIT'),
    tokenSymbol: z.string().min(1).max(16).optional().default('MCN'),
    rawAmount: z.number().positive(),
    usdAmount: z.number().positive().optional(),
    mcnEquivalentAmount: z.number().positive().optional(),
    txHash: z.string().min(3).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
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

export async function POST(request: NextRequest) {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const body = await request.json();
        const parsed = fundingCreateSchema.safeParse(body);
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
        const usdAmount = Number(parsed.data.usdAmount ?? parsed.data.rawAmount);
        const mcnEquivalentAmount = Number(parsed.data.mcnEquivalentAmount ?? usdAmount);
        const metadata = parsed.data.metadata as Prisma.InputJsonValue | undefined;
        const now = new Date();

        const result = await prisma.$transaction(async (tx) => {
            const account = await tx.participationAccount.upsert({
                where: { walletAddress },
                update: {},
                create: {
                    walletAddress,
                    status: 'PENDING',
                    isRegistrationComplete: false,
                },
            });

            const fundingRecord = await tx.participationFundingRecord.create({
                data: {
                    accountId: account.id,
                    walletAddress,
                    channel: parsed.data.channel,
                    direction: parsed.data.direction,
                    tokenSymbol: parsed.data.tokenSymbol,
                    rawAmount: parsed.data.rawAmount,
                    usdAmount,
                    mcnEquivalentAmount,
                    txHash: parsed.data.txHash,
                    metadata,
                    confirmedAt: now,
                },
            });

            await tx.netDepositLedger.create({
                data: {
                    accountId: account.id,
                    fundingRecordId: fundingRecord.id,
                    walletAddress,
                    channel: parsed.data.channel,
                    direction: parsed.data.direction,
                    usdAmount,
                    mcnEquivalentAmount,
                },
            });

            return { account, fundingRecord };
        });

        const netDeposits = await getWalletNetDeposits(walletAddress);

        return NextResponse.json(
            {
                account: result.account,
                fundingRecord: result.fundingRecord,
                netDeposits,
                eligibility: {
                    freeQualified: netDeposits.netMcnEquivalent >= PARTICIPATION_MINIMUMS.FREE,
                    managedQualified: netDeposits.netMcnEquivalent >= PARTICIPATION_MINIMUMS.MANAGED,
                    thresholds: PARTICIPATION_MINIMUMS,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return NextResponse.json(
                { error: 'Funding record already exists for this txHash' },
                { status: 409 }
            );
        }

        console.error('[ParticipationFunding] POST failed:', error);
        return NextResponse.json({ error: 'Failed to create funding record' }, { status: 500 });
    }
}
