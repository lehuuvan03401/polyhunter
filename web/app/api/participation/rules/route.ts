import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import {
    DEFAULT_MANAGED_RETURN_MATRIX,
    formatReturnRange,
    parseParticipationStrategy,
    PARTICIPATION_FUNDING_CHANNELS,
    PARTICIPATION_MINIMUMS,
    PARTICIPATION_MODES,
    PARTICIPATION_RULES_VERSION,
    PARTICIPATION_SERVICE_PERIODS_DAYS,
    PARTICIPATION_STRATEGIES,
    PARTICIPATION_STRATEGY_LABEL_KEYS,
    REALIZED_PROFIT_FEE_RATE,
    type ManagedReturnMatrixRow,
    type ParticipationStrategyValue,
} from '@/lib/participation-program/rules';
import { lookupManagedReturnMatrixRow } from '@/lib/participation-program/managed-return-matrix';

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

type ManagedReturnEstimate = {
    input: {
        principalUsd: number;
        cycleDays: number;
        strategyProfile: ParticipationStrategyValue;
    };
    principalBand: 'A' | 'B' | 'C' | null;
    matched: boolean;
    row: (MatrixRowShape & { displayRange: string }) | null;
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

function parsePositiveNumberParam(value: string | null): number | null {
    if (value === null) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

function parsePositiveIntegerParam(value: string | null): number | null {
    if (value === null) return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
}
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const principalUsdRaw = searchParams.get('principalUsd');
    const cycleDaysRaw = searchParams.get('cycleDays');
    const strategyRaw = searchParams.get('strategy');

    const hasEstimateParams =
        principalUsdRaw !== null ||
        cycleDaysRaw !== null ||
        strategyRaw !== null;

    if (hasEstimateParams && (principalUsdRaw === null || cycleDaysRaw === null || strategyRaw === null)) {
        return NextResponse.json(
            {
                error: 'principalUsd, cycleDays, and strategy are required together for managed return estimate',
            },
            { status: 400 }
        );
    }

    const principalUsd = parsePositiveNumberParam(principalUsdRaw);
    const cycleDays = parsePositiveIntegerParam(cycleDaysRaw);
    const strategyProfile = parseParticipationStrategy(strategyRaw);

    if (principalUsdRaw !== null && principalUsd === null) {
        return NextResponse.json(
            { error: 'Invalid principalUsd' },
            { status: 400 }
        );
    }
    if (cycleDaysRaw !== null && cycleDays === null) {
        return NextResponse.json(
            { error: 'Invalid cycleDays' },
            { status: 400 }
        );
    }
    if (strategyRaw !== null && !strategyProfile) {
        return NextResponse.json(
            {
                error: 'Invalid strategy',
                allowed: [...PARTICIPATION_STRATEGIES, 'BALANCED'],
            },
            { status: 400 }
        );
    }

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

    let managedReturnEstimate: ManagedReturnEstimate | null = null;
    if (principalUsd !== null && cycleDays !== null && strategyProfile) {
        const lookupRows: ManagedReturnMatrixRow[] = rows.map((row) => ({
            principalBand: row.principalBand,
            minPrincipalUsd: row.minPrincipalUsd,
            maxPrincipalUsd: row.maxPrincipalUsd,
            termDays: row.termDays as ManagedReturnMatrixRow['termDays'],
            strategyProfile: row.strategyProfile,
            returnMin: row.returnMin,
            returnMax: row.returnMax,
            returnUnit: row.returnUnit,
        }));

        const matched = lookupManagedReturnMatrixRow(lookupRows, {
            principalUsd,
            cycleDays,
            strategyProfile,
        });

        managedReturnEstimate = {
            input: {
                principalUsd,
                cycleDays,
                strategyProfile,
            },
            principalBand: matched.principalBand,
            matched: Boolean(matched.row),
            row: matched.row
                ? {
                    ...toMatrixRowShape(matched.row),
                    displayRange: matched.displayRange ?? formatReturnRange(matched.row),
                }
                : null,
        };
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
        managedReturnEstimate,
    });
}
