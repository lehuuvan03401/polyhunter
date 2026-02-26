import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/participation-program/partner-program';
import { countManagedOpenPositionsWithFallback } from '@/lib/managed-wealth/subscription-position-scope';
import {
    PARTICIPATION_PROFIT_FEE_RATE,
    PARTICIPATION_PROFIT_FEE_SCOPE_PREFIX,
} from '@/lib/participation-program/fee-scope';

export const dynamic = 'force-dynamic';

const HEALTH_QUERY_SCHEMA = z.object({
    windowDays: z.coerce.number().int().min(1).max(90).optional(),
    liquidationLimit: z.coerce.number().int().positive().max(500).optional(),
    parityLimit: z.coerce.number().int().positive().max(1000).optional(),
    staleMappingMinutes: z.coerce.number().int().positive().max(24 * 60).optional(),
});

const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_LIQUIDATION_LIMIT = 200;
const DEFAULT_PARITY_LIMIT = 500;
const DEFAULT_STALE_MAPPING_MINUTES = 30;
const FEE_TOLERANCE = 0.0001;

function ageMinutes(from: Date, now: Date): number {
    return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000));
}

export async function GET(request: NextRequest) {
    try {
        if (!isAdminRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const params = Object.fromEntries(request.nextUrl.searchParams.entries());
        const parsed = HEALTH_QUERY_SCHEMA.safeParse(params);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid query params', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const now = new Date();
        const windowDays = parsed.data.windowDays ?? DEFAULT_WINDOW_DAYS;
        const liquidationLimit = parsed.data.liquidationLimit ?? DEFAULT_LIQUIDATION_LIMIT;
        const parityLimit = parsed.data.parityLimit ?? DEFAULT_PARITY_LIMIT;
        const staleMappingMinutes = parsed.data.staleMappingMinutes ?? DEFAULT_STALE_MAPPING_MINUTES;

        const executionSubscriptions = await prisma.managedSubscription.findMany({
            where: {
                status: {
                    in: ['RUNNING', 'MATURED', 'LIQUIDATING'],
                },
            },
            select: {
                id: true,
                status: true,
                walletAddress: true,
                copyConfigId: true,
                createdAt: true,
                updatedAt: true,
                endAt: true,
            },
            orderBy: { updatedAt: 'asc' },
        });

        const executionByStatus = executionSubscriptions.reduce(
            (acc, sub) => {
                if (sub.status === 'RUNNING') acc.running += 1;
                if (sub.status === 'MATURED') acc.matured += 1;
                if (sub.status === 'LIQUIDATING') acc.liquidating += 1;
                return acc;
            },
            {
                running: 0,
                matured: 0,
                liquidating: 0,
            }
        );

        const mappedExecution = executionSubscriptions.filter((sub) => Boolean(sub.copyConfigId));
        const unmappedExecution = executionSubscriptions.filter((sub) => !sub.copyConfigId);
        const staleUnmapped = unmappedExecution
            .filter((sub) => ageMinutes(sub.createdAt, now) >= staleMappingMinutes)
            .map((sub) => ({
                subscriptionId: sub.id,
                status: sub.status,
                walletAddress: sub.walletAddress,
                createdAt: sub.createdAt,
                ageMinutes: ageMinutes(sub.createdAt, now),
            }))
            .sort((left, right) => right.ageMinutes - left.ageMinutes)
            .slice(0, 20);

        const liquidatingSubscriptions = executionSubscriptions.filter(
            (sub) => sub.status === 'LIQUIDATING'
        );
        const inspectedLiquidating = liquidatingSubscriptions.slice(0, liquidationLimit);
        const liquidationDetails = await Promise.all(
            inspectedLiquidating.map(async (sub) => {
                const openPositionsCount = await countManagedOpenPositionsWithFallback(prisma, {
                    subscriptionId: sub.id,
                    walletAddress: sub.walletAddress,
                    copyConfigId: sub.copyConfigId,
                });
                return {
                    subscriptionId: sub.id,
                    walletAddress: sub.walletAddress,
                    openPositionsCount,
                    updatedAt: sub.updatedAt,
                    ageMinutes: ageMinutes(sub.updatedAt, now),
                };
            })
        );

        const liquidationBacklog = liquidationDetails
            .filter((entry) => entry.openPositionsCount > 0)
            .sort((left, right) => right.ageMinutes - left.ageMinutes);
        const readyToSettle = liquidationDetails.filter((entry) => entry.openPositionsCount === 0);

        const parityWindowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
        const profitableSettlements = await prisma.managedSettlement.findMany({
            where: {
                status: 'COMPLETED',
                grossPnl: { gt: 0 },
                settledAt: { gte: parityWindowStart },
            },
            orderBy: { settledAt: 'desc' },
            take: parityLimit,
            select: {
                id: true,
                subscriptionId: true,
                grossPnl: true,
                settledAt: true,
                subscription: {
                    select: {
                        walletAddress: true,
                    },
                },
            },
        });

        const settlementWallets = Array.from(
            new Set(
                profitableSettlements
                    .map((settlement) => settlement.subscription.walletAddress.toLowerCase())
                    .filter(Boolean)
            )
        );

        const referrals = settlementWallets.length > 0
            ? await prisma.referral.findMany({
                where: {
                    refereeAddress: { in: settlementWallets },
                },
                select: {
                    refereeAddress: true,
                },
            })
            : [];

        const referredWallets = new Set(
            referrals.map((referral) => referral.refereeAddress.toLowerCase())
        );

        const parityCandidates = profitableSettlements.map((settlement) => {
            const walletAddress = settlement.subscription.walletAddress.toLowerCase();
            const tradeId = `${PARTICIPATION_PROFIT_FEE_SCOPE_PREFIX.MANAGED_WITHDRAWAL}${settlement.subscriptionId}:${settlement.id}`;
            return {
                settlementId: settlement.id,
                subscriptionId: settlement.subscriptionId,
                walletAddress,
                grossPnl: settlement.grossPnl,
                expectedFee: Number((settlement.grossPnl * PARTICIPATION_PROFIT_FEE_RATE).toFixed(8)),
                settledAt: settlement.settledAt,
                tradeId,
                hasReferral: referredWallets.has(walletAddress),
            };
        });

        const referredCandidates = parityCandidates.filter((candidate) => candidate.hasReferral);
        const commissionTradeIds = referredCandidates.map((candidate) => candidate.tradeId);

        const feeLogs = commissionTradeIds.length > 0
            ? await prisma.commissionLog.findMany({
                where: {
                    type: 'PROFIT_FEE',
                    sourceTradeId: { in: commissionTradeIds },
                },
                select: {
                    sourceTradeId: true,
                    amount: true,
                    createdAt: true,
                },
            })
            : [];

        const feeLogMap = new Map<string, { count: number; totalAmount: number; latestAt: Date }>();
        for (const log of feeLogs) {
            if (!log.sourceTradeId) continue;
            const prev = feeLogMap.get(log.sourceTradeId);
            if (!prev) {
                feeLogMap.set(log.sourceTradeId, {
                    count: 1,
                    totalAmount: log.amount,
                    latestAt: log.createdAt,
                });
                continue;
            }
            feeLogMap.set(log.sourceTradeId, {
                count: prev.count + 1,
                totalAmount: prev.totalAmount + log.amount,
                latestAt: log.createdAt > prev.latestAt ? log.createdAt : prev.latestAt,
            });
        }

        const missingParity = referredCandidates
            .filter((candidate) => !feeLogMap.has(candidate.tradeId))
            .map((candidate) => ({
                settlementId: candidate.settlementId,
                subscriptionId: candidate.subscriptionId,
                walletAddress: candidate.walletAddress,
                tradeId: candidate.tradeId,
                grossPnl: candidate.grossPnl,
                expectedFee: candidate.expectedFee,
                settledAt: candidate.settledAt,
            }));

        const feeMismatches = referredCandidates
            .map((candidate) => {
                const feeLog = feeLogMap.get(candidate.tradeId);
                if (!feeLog) return null;
                const drift = Number((feeLog.totalAmount - candidate.expectedFee).toFixed(8));
                if (Math.abs(drift) <= FEE_TOLERANCE) {
                    return null;
                }
                return {
                    settlementId: candidate.settlementId,
                    subscriptionId: candidate.subscriptionId,
                    walletAddress: candidate.walletAddress,
                    tradeId: candidate.tradeId,
                    expectedFee: candidate.expectedFee,
                    actualFee: Number(feeLog.totalAmount.toFixed(8)),
                    drift,
                    logCount: feeLog.count,
                };
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

        return NextResponse.json({
            generatedAt: now.toISOString(),
            allocation: {
                executionScopeSubscriptions: executionSubscriptions.length,
                byStatus: executionByStatus,
                mappedCount: mappedExecution.length,
                unmappedCount: unmappedExecution.length,
                staleMappingMinutes,
                staleUnmapped,
            },
            liquidation: {
                totalLiquidating: liquidatingSubscriptions.length,
                inspectedCount: inspectedLiquidating.length,
                inspectionLimit: liquidationLimit,
                backlogCount: liquidationBacklog.length,
                readyToSettleCount: readyToSettle.length,
                backlogOldestAgeMinutes: liquidationBacklog[0]?.ageMinutes ?? 0,
                backlog: liquidationBacklog.slice(0, 20),
            },
            settlementCommissionParity: {
                windowDays,
                windowStart: parityWindowStart.toISOString(),
                checkedSettlements: profitableSettlements.length,
                settlementsWithReferral: referredCandidates.length,
                settlementsWithoutReferral: parityCandidates.length - referredCandidates.length,
                matchedCount: referredCandidates.length - missingParity.length - feeMismatches.length,
                missingCount: missingParity.length,
                feeMismatchCount: feeMismatches.length,
                missing: missingParity.slice(0, 50),
                feeMismatches: feeMismatches.slice(0, 50),
            },
        });
    } catch (error) {
        console.error('[ManagedSettlementHealth] Failed to collect health metrics:', error);
        return NextResponse.json(
            { error: 'Failed to collect managed settlement health metrics' },
            { status: 500 }
        );
    }
}
