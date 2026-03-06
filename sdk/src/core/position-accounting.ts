export interface ApplySellToPositionParams {
    currentBalance: number;
    currentTotalCost: number;
    currentAvgEntryPrice: number;
    sellShares: number;
    sellTotalValue: number;
}

export interface ApplySellToPositionResult {
    remainingBalance: number;
    remainingTotalCost: number;
    remainingAvgEntryPrice: number;
    realizedProfit: number;
    realizedProfitPercent: number;
    settledShares: number;
    settledCostBasis: number;
}

export interface ApplyBuyToPositionParams {
    currentBalance: number;
    currentTotalCost: number;
    buyShares: number;
    buyTotalValue: number;
}

export interface ApplyBuyToPositionResult {
    nextBalance: number;
    nextTotalCost: number;
    nextAvgEntryPrice: number;
}

export function applyBuyToPosition(params: ApplyBuyToPositionParams): ApplyBuyToPositionResult {
    const nextBalance = params.currentBalance + params.buyShares;
    const nextTotalCost = params.currentTotalCost + params.buyTotalValue;
    const nextAvgEntryPrice = nextBalance > 0 ? (nextTotalCost / nextBalance) : 0;

    return {
        nextBalance,
        nextTotalCost,
        nextAvgEntryPrice,
    };
}

export function applySellToPosition(params: ApplySellToPositionParams): ApplySellToPositionResult {
    const settledShares = Math.max(0, Math.min(params.sellShares, params.currentBalance));
    const settledCostBasis = settledShares * params.currentAvgEntryPrice;
    const remainingBalance = Math.max(0, params.currentBalance - settledShares);
    const remainingTotalCost = Math.max(0, params.currentTotalCost - settledCostBasis);
    const remainingAvgEntryPrice = remainingBalance > 0 ? (remainingTotalCost / remainingBalance) : 0;
    const realizedProfit = params.sellTotalValue - settledCostBasis;
    const realizedProfitPercent = settledCostBasis > 0 ? (realizedProfit / settledCostBasis) : 0;

    return {
        remainingBalance,
        remainingTotalCost,
        remainingAvgEntryPrice,
        realizedProfit,
        realizedProfitPercent,
        settledShares,
        settledCostBasis,
    };
}
