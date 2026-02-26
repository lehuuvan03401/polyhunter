import {
    formatReturnRange,
    inferPrincipalBand,
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
