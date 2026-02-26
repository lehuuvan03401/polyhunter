import { REALIZED_PROFIT_FEE_RATE } from './rules';

export const PARTICIPATION_PROFIT_FEE_RATE = REALIZED_PROFIT_FEE_RATE;

export const PARTICIPATION_PROFIT_FEE_SCOPE_PREFIX = {
    MANAGED_WITHDRAWAL: 'managed-withdraw:',
    PARTICIPATION_WITHDRAWAL: 'participation-withdraw:',
} as const;

export type ParticipationProfitFeeScope = keyof typeof PARTICIPATION_PROFIT_FEE_SCOPE_PREFIX;

export function resolveParticipationProfitFeeScope(
    tradeId: string,
    explicitScope?: ParticipationProfitFeeScope
): ParticipationProfitFeeScope | null {
    if (explicitScope) {
        return explicitScope;
    }

    if (tradeId.startsWith(PARTICIPATION_PROFIT_FEE_SCOPE_PREFIX.MANAGED_WITHDRAWAL)) {
        return 'MANAGED_WITHDRAWAL';
    }

    if (tradeId.startsWith(PARTICIPATION_PROFIT_FEE_SCOPE_PREFIX.PARTICIPATION_WITHDRAWAL)) {
        return 'PARTICIPATION_WITHDRAWAL';
    }

    return null;
}
