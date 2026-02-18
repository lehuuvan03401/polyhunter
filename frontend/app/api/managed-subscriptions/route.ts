import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { z } from 'zod';
import { Prisma, ManagedSubscriptionStatus } from '@prisma/client';
import {
    calculateCoverageRatio,
    calculateGuaranteeLiability,
    calculateReserveBalance,
} from '@/lib/managed-wealth/settlement-math';
import { resolveWalletContext } from '@/lib/managed-wealth/request-wallet';

export const dynamic = 'force-dynamic';

type ReserveCoverageResult = {
    balance: number;
    existingGuaranteedLiability: number;
    projectedLiability: number;
    coverageRatio: number;
};

const createSubscriptionSchema = z.object({
    walletAddress: z.string().min(3),
    productId: z.string().optional(),
    productSlug: z.string().optional(),
    termId: z.string().min(1),
    principal: z.number().positive(),
    acceptedTerms: z.boolean(),
    copyConfigId: z.string().optional(),
}).refine((data) => Boolean(data.productId || data.productSlug), {
    message: 'Either productId or productSlug is required',
    path: ['productId'],
});

function parseStatusParam(value: string | null): ManagedSubscriptionStatus | undefined {
    if (!value) return undefined;
    const normalized = value.toUpperCase();
    if (
        normalized === 'PENDING' ||
        normalized === 'RUNNING' ||
        normalized === 'MATURED' ||
        normalized === 'SETTLED' ||
        normalized === 'CANCELLED'
    ) {
        return normalized as ManagedSubscriptionStatus;
    }
    return undefined;
}

async function getReserveCoverageAfterSubscription(
    principal: number,
    minYieldRate: number,
): Promise<ReserveCoverageResult> {
    const ledgerRows = await prisma.reserveFundLedger.findMany({
        select: { entryType: true, amount: true },
    });

    const balance = calculateReserveBalance(ledgerRows);

    const existingGuaranteed = await prisma.managedSubscription.findMany({
        where: {
            status: { in: ['PENDING', 'RUNNING', 'MATURED'] },
            product: {
                isGuaranteed: true,
                isActive: true,
            },
        },
        select: {
            principal: true,
            term: {
                select: { minYieldRate: true },
            },
        },
    });

    const existingGuaranteedLiability = existingGuaranteed.reduce(
        (acc, sub) => acc + calculateGuaranteeLiability(sub.principal, sub.term.minYieldRate),
        0
    );

    const additionalLiability = calculateGuaranteeLiability(principal, minYieldRate);
    const projectedLiability = existingGuaranteedLiability + additionalLiability;
    const coverageRatio = calculateCoverageRatio(balance, existingGuaranteedLiability, additionalLiability);

    return {
        balance,
        existingGuaranteedLiability,
        projectedLiability,
        coverageRatio,
    };
}

export async function GET(request: NextRequest) {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json({
                subscriptions: [],
                source: 'static',
                message: 'Database not configured',
            });
        }

        const { searchParams } = new URL(request.url);
        const walletContext = resolveWalletContext(request, {
            queryWallet: searchParams.get('wallet'),
            requireHeader: true,
        });
        const rawStatus = searchParams.get('status');
        const status = parseStatusParam(rawStatus);

        if (!walletContext.ok) {
            return NextResponse.json(
                { error: walletContext.error },
                { status: walletContext.status }
            );
        }

        if (rawStatus && !status) {
            return NextResponse.json(
                {
                    error: 'Invalid status',
                    allowed: ['PENDING', 'RUNNING', 'MATURED', 'SETTLED', 'CANCELLED'],
                },
                { status: 400 }
            );
        }

        const where: Prisma.ManagedSubscriptionWhereInput = {
            walletAddress: walletContext.wallet,
            ...(status ? { status } : {}),
        };

        const subscriptions = await prisma.managedSubscription.findMany({
            where,
            include: {
                product: {
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        strategyProfile: true,
                        isGuaranteed: true,
                        disclosurePolicy: true,
                        disclosureDelayHours: true,
                    },
                },
                term: {
                    select: {
                        id: true,
                        label: true,
                        durationDays: true,
                        targetReturnMin: true,
                        targetReturnMax: true,
                        maxDrawdown: true,
                        minYieldRate: true,
                        performanceFeeRate: true,
                    },
                },
                navSnapshots: {
                    orderBy: { snapshotAt: 'desc' },
                    take: 30,
                    select: {
                        snapshotAt: true,
                        nav: true,
                        equity: true,
                        cumulativeReturn: true,
                        drawdown: true,
                    },
                },
                settlement: {
                    select: {
                        id: true,
                        status: true,
                        finalPayout: true,
                        reserveTopup: true,
                        settledAt: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ subscriptions });
    } catch (error) {
        console.error('Failed to fetch managed subscriptions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch managed subscriptions' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json(
                { error: 'Database not configured' },
                { status: 503 }
            );
        }

        const body = await request.json();
        const validation = createSubscriptionSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.format() },
                { status: 400 }
            );
        }

        const {
            walletAddress,
            productId,
            productSlug,
            termId,
            principal,
            acceptedTerms,
            copyConfigId,
        } = validation.data;

        const walletContext = resolveWalletContext(request, {
            bodyWallet: walletAddress,
            requireHeader: true,
        });
        if (!walletContext.ok) {
            return NextResponse.json(
                { error: walletContext.error },
                { status: walletContext.status }
            );
        }
        const requestWallet = walletContext.wallet;

        if (!acceptedTerms) {
            return NextResponse.json(
                { error: 'Terms must be accepted before subscribing' },
                { status: 400 }
            );
        }

        const product = await prisma.managedProduct.findFirst({
            where: {
                OR: [
                    ...(productId ? [{ id: productId }] : []),
                    ...(productSlug ? [{ slug: productSlug }] : []),
                ],
            },
        });

        if (!product) {
            return NextResponse.json(
                { error: 'Managed product not found' },
                { status: 404 }
            );
        }

        if (!product.isActive || product.status !== 'ACTIVE') {
            return NextResponse.json(
                { error: 'Managed product is not open for subscriptions' },
                { status: 409 }
            );
        }

        const term = await prisma.managedTerm.findFirst({
            where: {
                id: termId,
                productId: product.id,
                isActive: true,
            },
        });

        if (!term) {
            return NextResponse.json(
                { error: 'Managed term not found for this product' },
                { status: 404 }
            );
        }

        if (term.maxSubscriptionAmount && principal > term.maxSubscriptionAmount) {
            return NextResponse.json(
                {
                    error: 'Principal exceeds subscription limit for selected term',
                    maxSubscriptionAmount: term.maxSubscriptionAmount,
                },
                { status: 400 }
            );
        }

        if (copyConfigId) {
            const copyConfig = await prisma.copyTradingConfig.findFirst({
                where: {
                    id: copyConfigId,
                    walletAddress: requestWallet,
                },
                select: { id: true },
            });

            if (!copyConfig) {
                return NextResponse.json(
                    { error: 'copyConfigId is invalid or does not belong to wallet' },
                    { status: 400 }
                );
            }
        }

        if (product.isGuaranteed) {
            const minYieldRate = Number(term.minYieldRate ?? 0);
            const reserveCoverage = await getReserveCoverageAfterSubscription(principal, minYieldRate);
            if (reserveCoverage.coverageRatio < product.reserveCoverageMin) {
                return NextResponse.json(
                    {
                        error: 'Guaranteed subscriptions temporarily unavailable due to reserve coverage',
                        reserveCoverage,
                        requiredCoverageRatio: product.reserveCoverageMin,
                    },
                    { status: 409 }
                );
            }
        }

        const now = new Date();
        const endAt = new Date(now.getTime() + term.durationDays * 24 * 60 * 60 * 1000);

        const subscription = await prisma.managedSubscription.create({
            data: {
                walletAddress: requestWallet,
                productId: product.id,
                termId: term.id,
                principal,
                disclosurePolicy: product.disclosurePolicy,
                disclosureDelayHours: product.disclosureDelayHours,
                highWaterMark: principal,
                currentEquity: principal,
                status: 'RUNNING',
                acceptedTermsAt: now,
                startAt: now,
                endAt,
                copyConfigId: copyConfigId ?? null,
            },
            include: {
                product: true,
                term: true,
            },
        });

        await prisma.managedNavSnapshot.create({
            data: {
                subscriptionId: subscription.id,
                snapshotAt: now,
                nav: 1,
                equity: principal,
                periodReturn: 0,
                cumulativeReturn: 0,
                drawdown: 0,
                volatility: 0,
                isFallbackPrice: false,
                priceSource: 'INITIAL',
            },
        });

        return NextResponse.json({ subscription }, { status: 201 });
    } catch (error) {
        console.error('Failed to create managed subscription:', error);
        return NextResponse.json(
            { error: 'Failed to create managed subscription' },
            { status: 500 }
        );
    }
}
