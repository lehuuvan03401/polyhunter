export type LiquidationIntentStatus = 'PENDING' | 'RETRYING' | 'BLOCKED';

export type LiquidationIntent = {
    status: LiquidationIntentStatus;
    errorCode: string | null;
    errorMessage: string | null;
};

export function resolveManagedLiquidationIntent(input: {
    hasCopyConfig: boolean;
    indicativeBidPrice: number;
}): LiquidationIntent {
    if (!input.hasCopyConfig) {
        return {
            status: 'BLOCKED',
            errorCode: 'MISSING_COPY_CONFIG',
            errorMessage: 'Cannot liquidate because managed subscription has no active copy config',
        };
    }

    if (!Number.isFinite(input.indicativeBidPrice) || input.indicativeBidPrice <= 0) {
        return {
            status: 'RETRYING',
            errorCode: 'NO_BID_LIQUIDITY',
            errorMessage: 'No executable bid liquidity for liquidation token',
        };
    }

    return {
        status: 'PENDING',
        errorCode: 'PENDING_EXTERNAL_EXECUTION',
        errorMessage: 'Liquidation task is pending external execution',
    };
}
