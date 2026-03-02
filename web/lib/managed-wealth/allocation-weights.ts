import type { Prisma } from '@prisma/client';

export type NormalizedAllocationWeight = {
    address: string;
    weight: number;
    weightScore: number | null;
};

/**
 * Parse and normalize a raw `selectedWeights` JSON column into a typed array.
 *
 * The function tolerates both layouts:
 *   - Full layout (from subscriptions): `{ address, weight, weightScore }`
 *   - Compact layout (from product detail): `{ address, weight }`
 *
 * Invalid or missing fields are dropped / defaulted.
 */
export function normalizeManagedAllocationWeights(
    value: Prisma.JsonValue | null | undefined
): NormalizedAllocationWeight[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((row) => {
        if (typeof row !== 'object' || row === null) {
            return [];
        }

        const candidate = row as {
            address?: unknown;
            weight?: unknown;
            weightScore?: unknown;
        };
        if (typeof candidate.address !== 'string') {
            return [];
        }

        const weight = Number(candidate.weight ?? 0);
        const weightScore = candidate.weightScore == null
            ? null
            : Number(candidate.weightScore);

        return [{
            address: candidate.address.toLowerCase(),
            weight: Number.isFinite(weight) ? weight : 0,
            weightScore: weightScore !== null && Number.isFinite(weightScore) ? weightScore : null,
        }];
    });
}
