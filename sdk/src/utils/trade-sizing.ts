export type TradeSizeMode = 'SHARES' | 'NOTIONAL';

export interface TradeSizingConfig {
    tradeSizeMode?: TradeSizeMode | null;
}

export function normalizeTradeSizing(
    config: TradeSizingConfig,
    rawSize: number,
    price: number
): { tradeShares: number; tradeNotional: number } {
    const mode = config.tradeSizeMode || 'SHARES';
    if (mode === 'NOTIONAL') {
        const tradeNotional = rawSize;
        const tradeShares = price > 0 ? tradeNotional / price : 0;
        return { tradeShares, tradeNotional };
    }

    const tradeShares = rawSize;
    const tradeNotional = tradeShares * price;
    return { tradeShares, tradeNotional };
}

export function normalizeTradeSizingFromShares(
    config: TradeSizingConfig,
    shares: number,
    price: number
): { tradeShares: number; tradeNotional: number } {
    const mode = config.tradeSizeMode || 'SHARES';
    const rawSize = mode === 'NOTIONAL' ? shares * price : shares;
    return normalizeTradeSizing({ tradeSizeMode: mode }, rawSize, price);
}
