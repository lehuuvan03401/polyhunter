import { NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import {
    calculateCoverageRatio,
    calculateGuaranteeLiability,
    calculateReserveBalance,
} from '@/lib/managed-wealth/settlement-math';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json(
                { error: 'Database not configured' },
                { status: 503 }
            );
        }

        const [ledgerRows, activeGuaranteedSubs, guaranteedProducts] = await Promise.all([
            prisma.reserveFundLedger.findMany({
                orderBy: { createdAt: 'asc' },
                select: {
                    id: true,
                    entryType: true,
                    amount: true,
                    balanceAfter: true,
                    note: true,
                    createdAt: true,
                },
            }),
            prisma.managedSubscription.findMany({
                where: {
                    status: { in: ['PENDING', 'RUNNING', 'MATURED'] },
                    product: {
                        isGuaranteed: true,
                        isActive: true,
                    },
                },
                select: {
                    id: true,
                    principal: true,
                    term: {
                        select: { minYieldRate: true },
                    },
                },
            }),
            prisma.managedProduct.findMany({
                where: { isActive: true, isGuaranteed: true },
                select: { reserveCoverageMin: true },
            }),
        ]);

        const totals = {
            deposits: 0,
            withdrawals: 0,
            guaranteeTopups: 0,
            adjustments: 0,
        };

        const currentBalance = calculateReserveBalance(ledgerRows);
        ledgerRows.forEach((row) => {
            if (row.entryType === 'DEPOSIT') {
                totals.deposits += row.amount;
                return;
            }
            if (row.entryType === 'WITHDRAW') {
                totals.withdrawals += row.amount;
                return;
            }
            if (row.entryType === 'GUARANTEE_TOPUP') {
                totals.guaranteeTopups += row.amount;
                return;
            }
            totals.adjustments += row.amount;
        });

        const outstandingGuaranteedLiability = activeGuaranteedSubs.reduce(
            (acc, sub) => acc + calculateGuaranteeLiability(sub.principal, sub.term.minYieldRate),
            0
        );

        const requiredCoverageRatio = guaranteedProducts.length > 0
            ? Math.max(...guaranteedProducts.map((p) => p.reserveCoverageMin))
            : 1;

        const coverageRatio = calculateCoverageRatio(currentBalance, outstandingGuaranteedLiability);

        const shouldPauseGuaranteed = coverageRatio < requiredCoverageRatio;

        return NextResponse.json({
            currentBalance,
            totals,
            outstandingGuaranteedLiability,
            coverageRatio,
            requiredCoverageRatio,
            shouldPauseGuaranteed,
            activeGuaranteedSubscriptions: activeGuaranteedSubs.length,
            ledgerEntries: ledgerRows.length,
            latestEntry: ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1] : null,
        });
    } catch (error) {
        console.error('Failed to fetch reserve fund summary:', error);
        return NextResponse.json(
            { error: 'Failed to fetch reserve fund summary' },
            { status: 500 }
        );
    }
}
