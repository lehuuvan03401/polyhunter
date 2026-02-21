
// export { StrategyProfile } from '@prisma/client'; // Avoid importing entire client for FE compatibility

export enum StrategyProfile {
    CONSERVATIVE = 'CONSERVATIVE',
    MODERATE = 'MODERATE',
    AGGRESSIVE = 'AGGRESSIVE'
}

export interface StrategyConfig {
    maxSlippage: number; // Decimal (e.g. 0.01 for 1%)
    gasPriority: 'normal' | 'fast' | 'instant';
    stopLossPercentage: number; // 0.1 for 10%
    description: string;
}

export const STRATEGY_CONFIGS: Record<StrategyProfile, StrategyConfig> = {
    [StrategyProfile.CONSERVATIVE]: {
        maxSlippage: 0.005, // 0.5%
        gasPriority: 'normal',
        stopLossPercentage: 0.10, // 10%
        description: 'Low slippage (0.5%), tight stop loss. Prioritizes capital preservation.'
    },
    [StrategyProfile.MODERATE]: {
        maxSlippage: 0.01, // 1.0%
        gasPriority: 'fast',
        stopLossPercentage: 0.30, // 30%
        description: 'Standard slippage (1%), medium risk. Balanced approach.'
    },
    [StrategyProfile.AGGRESSIVE]: {
        maxSlippage: 0.05, // 5.0%
        gasPriority: 'instant',
        stopLossPercentage: 1.0, // 100% (effectively none/liquidation)
        description: 'High slippage (5%), high risk. Prioritizes entry speed.'
    }
};

export function getStrategyConfig(profile: StrategyProfile | string): StrategyConfig {
    const key = profile as StrategyProfile;
    return STRATEGY_CONFIGS[key] || STRATEGY_CONFIGS[StrategyProfile.MODERATE];
}
