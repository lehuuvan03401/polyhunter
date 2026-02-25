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
import { applyOneTimeReferralSubscriptionBonus } from '@/lib/participation-program/referral-subscription-bonus';
import { resolveManagedSubscriptionTrial } from '@/lib/managed-wealth/subscription-trial';

export const dynamic = 'force-dynamic';
const WITHDRAW_GUARDRAILS = {
    cooldownHours: resolveNumberEnv('MANAGED_WITHDRAW_COOLDOWN_HOURS', 6, 0, 168),
    earlyWithdrawalFeeRate: resolveNumberEnv('MANAGED_EARLY_WITHDRAW_FEE_RATE', 0.01, 0, 0.5),
    drawdownAlertThreshold: resolveNumberEnv('MANAGED_WITHDRAW_DRAWDOWN_ALERT_THRESHOLD', 0.35, 0, 1),
};
const MANAGED_MIN_PRINCIPAL_USD = resolveNumberEnv(
    'PARTICIPATION_MANAGED_MIN_PRINCIPAL_USD',
    500,
    1,
    1_000_000_000
);
const REQUIRE_MANAGED_ACTIVATION = process.env.PARTICIPATION_REQUIRE_MANAGED_ACTIVATION === 'true';
const REQUIRE_CUSTODY_AUTH = process.env.PARTICIPATION_REQUIRE_CUSTODY_AUTH === 'true';

type ReserveCoverageResult = {
    balance: number;
    existingGuaranteedLiability: number;
    projectedLiability: number;
    coverageRatio: number;
};

type ReserveCoverageDb = {
    reserveFundLedger: {
        findMany: typeof prisma.reserveFundLedger.findMany;
    };
    managedSubscription: {
        findMany: typeof prisma.managedSubscription.findMany;
    };
};

class ReserveCoverageError extends Error {
    reserveCoverage: ReserveCoverageResult;
    requiredCoverageRatio: number;

    constructor(message: string, reserveCoverage: ReserveCoverageResult, requiredCoverageRatio: number) {
        super(message);
        this.reserveCoverage = reserveCoverage;
        this.requiredCoverageRatio = requiredCoverageRatio;
    }
}

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

function resolveNumberEnv(name: string, fallback: number, min: number, max: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

async function getReserveCoverageAfterSubscription(
    db: ReserveCoverageDb,
    principal: number,
    minYieldRate: number,
): Promise<ReserveCoverageResult> {
    const ledgerRows = await db.reserveFundLedger.findMany({
        select: { entryType: true, amount: true },
    });

    const balance = calculateReserveBalance(ledgerRows);

    const existingGuaranteed = await db.managedSubscription.findMany({
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
        (acc: number, sub: { principal: number; term: { minYieldRate: number | null } }) =>
            acc + calculateGuaranteeLiability(sub.principal, sub.term.minYieldRate),
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
            requireSignature: true,
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
                        principal: true,
                        finalEquity: true,
                        grossPnl: true,
                        performanceFeeRate: true,
                        performanceFee: true,
                        finalPayout: true,
                        guaranteedPayout: true,
                        reserveTopup: true,
                        settledAt: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({
            subscriptions,
            withdrawGuardrails: WITHDRAW_GUARDRAILS,
        });
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
            requireSignature: true,
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

        if (principal < MANAGED_MIN_PRINCIPAL_USD) {
            return NextResponse.json(
                {
                    error: 'Principal below managed minimum threshold',
                    minimumPrincipal: MANAGED_MIN_PRINCIPAL_USD,
                },
                { status: 400 }
            );
        }

        if (REQUIRE_MANAGED_ACTIVATION) {
            const account = await prisma.participationAccount.findUnique({
                where: { walletAddress: requestWallet },
                select: {
                    status: true,
                    preferredMode: true,
                    isRegistrationComplete: true,
                },
            });

            if (!account || !account.isRegistrationComplete) {
                return NextResponse.json(
                    {
                        error: 'Participation registration is required before managed subscription',
                        code: 'PARTICIPATION_REGISTRATION_REQUIRED',
                    },
                    { status: 409 }
                );
            }

            if (account.status !== 'ACTIVE' || account.preferredMode !== 'MANAGED') {
                return NextResponse.json(
                    {
                        error: 'Managed participation activation is required',
                        code: 'MANAGED_ACTIVATION_REQUIRED',
                    },
                    { status: 409 }
                );
            }

            const [depositAgg, withdrawAgg] = await Promise.all([
                prisma.netDepositLedger.aggregate({
                    where: { walletAddress: requestWallet, direction: 'DEPOSIT' },
                    _sum: { mcnEquivalentAmount: true },
                }),
                prisma.netDepositLedger.aggregate({
                    where: { walletAddress: requestWallet, direction: 'WITHDRAW' },
                    _sum: { mcnEquivalentAmount: true },
                }),
            ]);
            const netMcnEquivalent =
                Number(depositAgg._sum.mcnEquivalentAmount ?? 0) -
                Number(withdrawAgg._sum.mcnEquivalentAmount ?? 0);

            if (netMcnEquivalent < MANAGED_MIN_PRINCIPAL_USD) {
                return NextResponse.json(
                    {
                        error: 'Qualified funding below managed activation threshold',
                        code: 'QUALIFIED_FUNDING_REQUIRED',
                        netMcnEquivalent,
                        minimumRequired: MANAGED_MIN_PRINCIPAL_USD,
                    },
                    { status: 409 }
                );
            }
        }

        if (REQUIRE_CUSTODY_AUTH) {
            const activeAuthorization = await prisma.managedCustodyAuthorization.findFirst({
                where: {
                    walletAddress: requestWallet,
                    status: 'ACTIVE',
                    mode: 'MANAGED',
                },
                orderBy: { grantedAt: 'desc' },
                select: {
                    id: true,
                    grantedAt: true,
                },
            });

            if (!activeAuthorization) {
                return NextResponse.json(
                    {
                        error: 'Managed custody authorization is required',
                        code: 'CUSTODY_AUTH_REQUIRED',
                    },
                    { status: 409 }
                );
            }
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

        const now = new Date();
        const endAt = new Date(now.getTime() + term.durationDays * 24 * 60 * 60 * 1000);

        const subscription = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`managed_wealth_trial_${requestWallet}`}))`;

            const existingCount = await tx.managedSubscription.count({
                where: { walletAddress: requestWallet },
            });
            const { trialApplied, trialEndsAt } = resolveManagedSubscriptionTrial({
                existingSubscriptionCount: existingCount,
                termDurationDays: term.durationDays,
                now,
            });

            if (product.isGuaranteed) {
                const lockKey = `managed_wealth_guaranteed_${product.id}`;
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

                const minYieldRate = Number(term.minYieldRate ?? 0);
                const reserveCoverage = await getReserveCoverageAfterSubscription(tx, principal, minYieldRate);
                if (reserveCoverage.coverageRatio < product.reserveCoverageMin) {
                    throw new ReserveCoverageError(
                        'Guaranteed subscriptions temporarily unavailable due to reserve coverage',
                        reserveCoverage,
                        product.reserveCoverageMin
                    );
                }
            }

            const createdSubscription = await tx.managedSubscription.create({
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
                    isTrial: trialApplied,
                    trialEndsAt,
                    copyConfigId: copyConfigId ?? null,
                },
                include: {
                    product: true,
                    term: true,
                },
            });

            await tx.managedNavSnapshot.create({
                data: {
                    subscriptionId: createdSubscription.id,
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

            const referralBonus = await applyOneTimeReferralSubscriptionBonus(tx, {
                refereeWallet: requestWallet,
                now,
            });
            const referralBonusApplied = referralBonus.applied;

            return {
                createdSubscription,
                trialApplied,
                trialEndsAt,
                referralBonusApplied,
            };
        });

        return NextResponse.json({
            subscription: subscription.createdSubscription,
            marketing: {
                trialApplied: subscription.trialApplied,
                trialEndsAt: subscription.trialEndsAt,
                referralBonusApplied: subscription.referralBonusApplied,
            },
        }, { status: 201 });
    } catch (error) {
        if (error instanceof ReserveCoverageError) {
            return NextResponse.json(
                {
                    error: error.message,
                    reserveCoverage: error.reserveCoverage,
                    requiredCoverageRatio: error.requiredCoverageRatio,
                },
                { status: 409 }
            );
        }

        console.error('Failed to create managed subscription:', error);
        return NextResponse.json(
            { error: 'Failed to create managed subscription' },
            { status: 500 }
        );
    }
}
