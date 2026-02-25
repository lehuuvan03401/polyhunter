export const SAME_LEVEL_BONUS_RATES = {
    1: 0.04,
    2: 0.01,
} as const;

export type SameLevelGeneration = keyof typeof SAME_LEVEL_BONUS_RATES;

export function getSameLevelBonusRate(generation: number): number {
    if (generation === 1) return SAME_LEVEL_BONUS_RATES[1];
    if (generation === 2) return SAME_LEVEL_BONUS_RATES[2];
    return 0;
}

export function calculateSameLevelBonus(realizedProfit: number, generation: number): {
    generation: number;
    rate: number;
    amount: number;
} {
    const rate = getSameLevelBonusRate(generation);
    if (realizedProfit <= 0 || rate <= 0) {
        return {
            generation,
            rate,
            amount: 0,
        };
    }

    return {
        generation,
        rate,
        amount: Number((realizedProfit * rate).toFixed(8)),
    };
}
