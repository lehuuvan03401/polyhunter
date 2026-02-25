export const PARTICIPATION_RULES_VERSION = '2026-02-25';

export const PARTICIPATION_FUNDING_CHANNELS = ['EXCHANGE', 'TP_WALLET'] as const;
export type ParticipationFundingChannelValue = (typeof PARTICIPATION_FUNDING_CHANNELS)[number];

export const PARTICIPATION_MODES = ['FREE', 'MANAGED'] as const;
export type ParticipationModeValue = (typeof PARTICIPATION_MODES)[number];

export const PARTICIPATION_STRATEGIES = ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'] as const;
export type ParticipationStrategyValue = (typeof PARTICIPATION_STRATEGIES)[number];
export const PARTICIPATION_STRATEGY_LABEL_KEYS: Record<
    ParticipationStrategyValue,
    'Conservative' | 'Moderate' | 'Aggressive'
> = {
    CONSERVATIVE: 'Conservative',
    MODERATE: 'Moderate',
    AGGRESSIVE: 'Aggressive',
};

export function parseParticipationStrategy(
    value: string | null | undefined
): ParticipationStrategyValue | undefined {
    if (!value) return undefined;
    const normalized = value.toUpperCase();
    return PARTICIPATION_STRATEGIES.find((strategy) => strategy === normalized);
}

export const PARTICIPATION_SERVICE_PERIODS_DAYS = [1, 7, 30, 90, 180, 360] as const;

export const PARTICIPATION_MINIMUMS = {
    FREE: 100,
    MANAGED: 500,
} as const;

export const REALIZED_PROFIT_FEE_RATE = 0.2;

export type ManagedReturnPrincipalBandValue = 'A' | 'B' | 'C';
export type ManagedReturnUnit = 'PERCENT' | 'MULTIPLIER';

export type ManagedReturnMatrixRow = {
    principalBand: ManagedReturnPrincipalBandValue;
    minPrincipalUsd: number;
    maxPrincipalUsd: number;
    termDays: 7 | 30 | 90 | 180 | 360;
    strategyProfile: ParticipationStrategyValue;
    returnMin: number;
    returnMax: number;
    returnUnit: ManagedReturnUnit;
};

const BAND_A = { principalBand: 'A' as const, minPrincipalUsd: 500, maxPrincipalUsd: 5000 };
const BAND_B = { principalBand: 'B' as const, minPrincipalUsd: 5000, maxPrincipalUsd: 50000 };
const BAND_C = { principalBand: 'C' as const, minPrincipalUsd: 50000, maxPrincipalUsd: 300000 };

export const DEFAULT_MANAGED_RETURN_MATRIX: ManagedReturnMatrixRow[] = [
    { ...BAND_A, termDays: 7, strategyProfile: 'CONSERVATIVE', returnMin: 4, returnMax: 6, returnUnit: 'PERCENT' },
    { ...BAND_A, termDays: 7, strategyProfile: 'MODERATE', returnMin: 7, returnMax: 11, returnUnit: 'PERCENT' },
    { ...BAND_A, termDays: 7, strategyProfile: 'AGGRESSIVE', returnMin: 10, returnMax: 16, returnUnit: 'PERCENT' },
    { ...BAND_A, termDays: 30, strategyProfile: 'CONSERVATIVE', returnMin: 20, returnMax: 25, returnUnit: 'PERCENT' },
    { ...BAND_A, termDays: 30, strategyProfile: 'MODERATE', returnMin: 23, returnMax: 30, returnUnit: 'PERCENT' },
    { ...BAND_A, termDays: 30, strategyProfile: 'AGGRESSIVE', returnMin: 26, returnMax: 35, returnUnit: 'PERCENT' },
    { ...BAND_A, termDays: 90, strategyProfile: 'CONSERVATIVE', returnMin: 70, returnMax: 100, returnUnit: 'PERCENT' },
    { ...BAND_A, termDays: 90, strategyProfile: 'MODERATE', returnMin: 73, returnMax: 105, returnUnit: 'PERCENT' },
    { ...BAND_A, termDays: 90, strategyProfile: 'AGGRESSIVE', returnMin: 76, returnMax: 110, returnUnit: 'PERCENT' },
    { ...BAND_A, termDays: 180, strategyProfile: 'CONSERVATIVE', returnMin: 1.6, returnMax: 2.1, returnUnit: 'MULTIPLIER' },
    { ...BAND_A, termDays: 180, strategyProfile: 'MODERATE', returnMin: 1.63, returnMax: 2.15, returnUnit: 'MULTIPLIER' },
    { ...BAND_A, termDays: 180, strategyProfile: 'AGGRESSIVE', returnMin: 1.66, returnMax: 2.2, returnUnit: 'MULTIPLIER' },
    { ...BAND_A, termDays: 360, strategyProfile: 'CONSERVATIVE', returnMin: 2.5, returnMax: 3, returnUnit: 'MULTIPLIER' },
    { ...BAND_A, termDays: 360, strategyProfile: 'MODERATE', returnMin: 2.53, returnMax: 3.05, returnUnit: 'MULTIPLIER' },
    { ...BAND_A, termDays: 360, strategyProfile: 'AGGRESSIVE', returnMin: 2.56, returnMax: 3.1, returnUnit: 'MULTIPLIER' },

    { ...BAND_B, termDays: 7, strategyProfile: 'CONSERVATIVE', returnMin: 5, returnMax: 7, returnUnit: 'PERCENT' },
    { ...BAND_B, termDays: 7, strategyProfile: 'MODERATE', returnMin: 8, returnMax: 12, returnUnit: 'PERCENT' },
    { ...BAND_B, termDays: 7, strategyProfile: 'AGGRESSIVE', returnMin: 11, returnMax: 17, returnUnit: 'PERCENT' },
    { ...BAND_B, termDays: 30, strategyProfile: 'CONSERVATIVE', returnMin: 22, returnMax: 28, returnUnit: 'PERCENT' },
    { ...BAND_B, termDays: 30, strategyProfile: 'MODERATE', returnMin: 25, returnMax: 33, returnUnit: 'PERCENT' },
    { ...BAND_B, termDays: 30, strategyProfile: 'AGGRESSIVE', returnMin: 28, returnMax: 38, returnUnit: 'PERCENT' },
    { ...BAND_B, termDays: 90, strategyProfile: 'CONSERVATIVE', returnMin: 80, returnMax: 115, returnUnit: 'PERCENT' },
    { ...BAND_B, termDays: 90, strategyProfile: 'MODERATE', returnMin: 83, returnMax: 120, returnUnit: 'PERCENT' },
    { ...BAND_B, termDays: 90, strategyProfile: 'AGGRESSIVE', returnMin: 86, returnMax: 125, returnUnit: 'PERCENT' },
    { ...BAND_B, termDays: 180, strategyProfile: 'CONSERVATIVE', returnMin: 1.7, returnMax: 2.3, returnUnit: 'MULTIPLIER' },
    { ...BAND_B, termDays: 180, strategyProfile: 'MODERATE', returnMin: 1.73, returnMax: 2.35, returnUnit: 'MULTIPLIER' },
    { ...BAND_B, termDays: 180, strategyProfile: 'AGGRESSIVE', returnMin: 1.76, returnMax: 2.4, returnUnit: 'MULTIPLIER' },
    { ...BAND_B, termDays: 360, strategyProfile: 'CONSERVATIVE', returnMin: 2.7, returnMax: 3.3, returnUnit: 'MULTIPLIER' },
    { ...BAND_B, termDays: 360, strategyProfile: 'MODERATE', returnMin: 2.73, returnMax: 3.35, returnUnit: 'MULTIPLIER' },
    { ...BAND_B, termDays: 360, strategyProfile: 'AGGRESSIVE', returnMin: 2.76, returnMax: 3.4, returnUnit: 'MULTIPLIER' },

    { ...BAND_C, termDays: 7, strategyProfile: 'CONSERVATIVE', returnMin: 6, returnMax: 9, returnUnit: 'PERCENT' },
    { ...BAND_C, termDays: 7, strategyProfile: 'MODERATE', returnMin: 9, returnMax: 14, returnUnit: 'PERCENT' },
    { ...BAND_C, termDays: 7, strategyProfile: 'AGGRESSIVE', returnMin: 12, returnMax: 19, returnUnit: 'PERCENT' },
    { ...BAND_C, termDays: 30, strategyProfile: 'CONSERVATIVE', returnMin: 25, returnMax: 32, returnUnit: 'PERCENT' },
    { ...BAND_C, termDays: 30, strategyProfile: 'MODERATE', returnMin: 28, returnMax: 37, returnUnit: 'PERCENT' },
    { ...BAND_C, termDays: 30, strategyProfile: 'AGGRESSIVE', returnMin: 31, returnMax: 42, returnUnit: 'PERCENT' },
    { ...BAND_C, termDays: 90, strategyProfile: 'CONSERVATIVE', returnMin: 95, returnMax: 135, returnUnit: 'PERCENT' },
    { ...BAND_C, termDays: 90, strategyProfile: 'MODERATE', returnMin: 98, returnMax: 140, returnUnit: 'PERCENT' },
    { ...BAND_C, termDays: 90, strategyProfile: 'AGGRESSIVE', returnMin: 101, returnMax: 145, returnUnit: 'PERCENT' },
    { ...BAND_C, termDays: 180, strategyProfile: 'CONSERVATIVE', returnMin: 1.9, returnMax: 2.6, returnUnit: 'MULTIPLIER' },
    { ...BAND_C, termDays: 180, strategyProfile: 'MODERATE', returnMin: 1.93, returnMax: 2.65, returnUnit: 'MULTIPLIER' },
    { ...BAND_C, termDays: 180, strategyProfile: 'AGGRESSIVE', returnMin: 1.96, returnMax: 2.7, returnUnit: 'MULTIPLIER' },
    { ...BAND_C, termDays: 360, strategyProfile: 'CONSERVATIVE', returnMin: 3, returnMax: 3.8, returnUnit: 'MULTIPLIER' },
    { ...BAND_C, termDays: 360, strategyProfile: 'MODERATE', returnMin: 3.03, returnMax: 3.85, returnUnit: 'MULTIPLIER' },
    { ...BAND_C, termDays: 360, strategyProfile: 'AGGRESSIVE', returnMin: 3.06, returnMax: 3.9, returnUnit: 'MULTIPLIER' },
];

export function formatReturnRange(row: Pick<ManagedReturnMatrixRow, 'returnMin' | 'returnMax' | 'returnUnit'>): string {
    if (row.returnUnit === 'MULTIPLIER') {
        return `${row.returnMin.toFixed(2)}x-${row.returnMax.toFixed(2)}x`;
    }
    return `${row.returnMin.toFixed(2).replace(/\.00$/, '')}%-${row.returnMax.toFixed(2).replace(/\.00$/, '')}%`;
}

export function inferPrincipalBand(principalUsd: number): ManagedReturnPrincipalBandValue | null {
    if (principalUsd >= 500 && principalUsd <= 5000) return 'A';
    if (principalUsd > 5000 && principalUsd <= 50000) return 'B';
    if (principalUsd > 50000 && principalUsd <= 300000) return 'C';
    return null;
}
