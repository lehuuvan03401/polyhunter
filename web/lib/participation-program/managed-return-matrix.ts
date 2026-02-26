import {
    formatReturnRange,
    inferPrincipalBand,
    type ManagedReturnPrincipalBandValue,
    type ManagedReturnMatrixRow,
    type ParticipationStrategyValue,
} from './rules';

export type ManagedReturnMatrixLookupInput = {
    principalUsd: number;
    cycleDays: number;
    strategyProfile: ParticipationStrategyValue;
};

export type ManagedReturnMatrixLookupResult = {
    principalBand: 'A' | 'B' | 'C' | null;
    row: ManagedReturnMatrixRow | null;
    displayRange: string | null;
};

export type ManagedReturnMatrixLookupByBandInput = {
    principalBand: ManagedReturnPrincipalBandValue;
    cycleDays: number;
    strategyProfile: ParticipationStrategyValue;
};

export function lookupManagedReturnMatrixRow(
    rows: ManagedReturnMatrixRow[],
    input: ManagedReturnMatrixLookupInput
): ManagedReturnMatrixLookupResult {
    const principalBand = inferPrincipalBand(input.principalUsd);
    if (!principalBand) {
        return {
            principalBand: null,
            row: null,
            displayRange: null,
        };
    }

    const row =
        rows.find(
            (candidate) =>
                candidate.principalBand === principalBand &&
                candidate.termDays === input.cycleDays &&
                candidate.strategyProfile === input.strategyProfile
        ) ?? null;

    if (!row) {
        return {
            principalBand,
            row: null,
            displayRange: null,
        };
    }

    return {
        principalBand,
        row,
        displayRange: formatReturnRange(row),
    };
}

export function lookupManagedReturnMatrixRowByBand(
    rows: ManagedReturnMatrixRow[],
    input: ManagedReturnMatrixLookupByBandInput
): ManagedReturnMatrixLookupResult {
    const row =
        rows.find(
            (candidate) =>
                candidate.principalBand === input.principalBand &&
                candidate.termDays === input.cycleDays &&
                candidate.strategyProfile === input.strategyProfile
        ) ?? null;

    if (!row) {
        return {
            principalBand: input.principalBand,
            row: null,
            displayRange: null,
        };
    }

    return {
        principalBand: input.principalBand,
        row,
        displayRange: formatReturnRange(row),
    };
}
