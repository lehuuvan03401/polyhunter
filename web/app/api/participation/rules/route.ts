import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import {
    DEFAULT_MANAGED_RETURN_MATRIX,
    formatReturnRange,
    PARTICIPATION_FUNDING_CHANNELS,
    PARTICIPATION_MINIMUMS,
    PARTICIPATION_MODES,
    PARTICIPATION_RULES_VERSION,
    PARTICIPATION_SERVICE_PERIODS_DAYS,
    PARTICIPATION_STRATEGIES,
    PARTICIPATION_STRATEGY_LABEL_KEYS,
    REALIZED_PROFIT_FEE_RATE,
    type ManagedReturnMatrixRow,
} from '@/lib/participation-program/rules';

export const dynamic = 'force-dynamic';

type MatrixRowShape = {
    principalBand: 'A' | 'B' | 'C';
    minPrincipalUsd: number;
    maxPrincipalUsd: number;
    termDays: number;
    strategyProfile: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
    returnMin: number;
    returnMax: number;
    returnUnit: 'PERCENT' | 'MULTIPLIER';
};

function normalizeRows(rows: MatrixRowShape[]) {
    const grouped = {
        A: [] as Array<MatrixRowShape & { displayRange: string }>,
        B: [] as Array<MatrixRowShape & { displayRange: string }>,
        C: [] as Array<MatrixRowShape & { displayRange: string }>,
    };

    for (const row of rows) {
        grouped[row.principalBand].push({
            ...row,
            displayRange: formatReturnRange(row),
        });
    }

    return grouped;
}

function toMatrixRowShape(row: ManagedReturnMatrixRow): MatrixRowShape {
    return {
        principalBand: row.principalBand,
        minPrincipalUsd: row.minPrincipalUsd,
        maxPrincipalUsd: row.maxPrincipalUsd,
        termDays: row.termDays,
        strategyProfile: row.strategyProfile,
        returnMin: row.returnMin,
        returnMax: row.returnMax,
        returnUnit: row.returnUnit,
    };
}

export async function GET() {
    let matrixSource: 'database' | 'default' = 'default';
    let rows: MatrixRowShape[] = DEFAULT_MANAGED_RETURN_MATRIX.map(toMatrixRowShape);

    if (isDatabaseEnabled) {
        try {
            const dbRows = await prisma.managedReturnMatrix.findMany({
                where: { isActive: true },
                orderBy: [
                    { principalBand: 'asc' },
                    { termDays: 'asc' },
                    { strategyProfile: 'asc' },
                ],
            });

            if (dbRows.length > 0) {
                rows = dbRows.map((row) => ({
                    principalBand: row.principalBand,
                    minPrincipalUsd: row.minPrincipalUsd,
                    maxPrincipalUsd: row.maxPrincipalUsd,
                    termDays: row.termDays,
                    strategyProfile: row.strategyProfile,
                    returnMin: row.returnMin,
                    returnMax: row.returnMax,
                    returnUnit: row.returnUnit as 'PERCENT' | 'MULTIPLIER',
                }));
                matrixSource = 'database';
            }
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                (error.code === 'P2021' || error.code === 'P2022')
            ) {
                matrixSource = 'default';
            } else {
                console.error('[ParticipationRules] Failed to query managed return matrix:', error);
            }
        }
    }

    return NextResponse.json({
        version: PARTICIPATION_RULES_VERSION,
        fundingChannels: PARTICIPATION_FUNDING_CHANNELS,
        modes: PARTICIPATION_MODES,
        strategies: PARTICIPATION_STRATEGIES,
        strategyOptions: PARTICIPATION_STRATEGIES.map((id) => ({
            id,
            labelKey: PARTICIPATION_STRATEGY_LABEL_KEYS[id],
        })),
        servicePeriodsDays: PARTICIPATION_SERVICE_PERIODS_DAYS,
        minimums: {
            FREE: PARTICIPATION_MINIMUMS.FREE,
            MANAGED: PARTICIPATION_MINIMUMS.MANAGED,
            unit: 'MCN_EQUIVALENT',
        },
        feePolicy: {
            onlyProfitFee: true,
            noProfitNoFee: true,
            realizedProfitFeeRate: REALIZED_PROFIT_FEE_RATE,
        },
        settlementPolicy: {
            usdtRulesUseMcnEquivalent: true,
        },
        matrixSource,
        managedReturnMatrix: rows,
        managedReturnMatrixByBand: normalizeRows(rows),
    });
}
