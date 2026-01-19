/**
 * Trader Scoring Service
 * 
 * Scientific scoring system for evaluating traders for copy trading.
 * Uses multi-factor analysis with risk-adjusted metrics.
 */

// ============================================================================
// Types
// ============================================================================

export interface Trade {
    timestamp: number;
    side: 'BUY' | 'SELL';
    size: number;
    price: number;
    value: number; // size * price in USDC
    pnl?: number;  // realized PnL if closed
}

export interface TraderMetrics {
    profitFactor: number;
    volumeWeightedWinRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
    copyFriendliness: number;
    activityScore: number;
    scientificScore: number;
    dataQuality: 'full' | 'limited' | 'insufficient';
    tradeCount: number;
}

export interface DailyReturn {
    date: string;
    return: number;
}

// ============================================================================
// Constants
// ============================================================================

const WEIGHTS = {
    sharpeRatio: 0.25,
    profitFactor: 0.20,
    maxDrawdown: 0.15,
    winRate: 0.15,
    activity: 0.10,
    copyFriendliness: 0.15,
};

const MIN_TRADES_FOR_FULL_SCORE = 10;
const MIN_TRADES_FOR_LIMITED_SCORE = 3;
const PROFIT_FACTOR_CAP = 10.0;
const MAX_ORDER_SIZE_PENALTY_THRESHOLD = 50000; // $50k
const RAPID_EXECUTION_THRESHOLD_MS = 60000; // 1 minute

// ============================================================================
// Metric Calculations
// ============================================================================

/**
 * Calculate Profit Factor: Total Gross Profit / Total Gross Loss
 * Values > 2.0 indicate strong profitability
 */
export function calculateProfitFactor(trades: Trade[]): number {
    const closedTrades = trades.filter(t => t.pnl !== undefined);
    if (closedTrades.length === 0) return 1.0;

    let grossProfit = 0;
    let grossLoss = 0;

    for (const trade of closedTrades) {
        if (trade.pnl! > 0) {
            grossProfit += trade.pnl!;
        } else {
            grossLoss += Math.abs(trade.pnl!);
        }
    }

    if (grossLoss === 0) {
        return grossProfit > 0 ? PROFIT_FACTOR_CAP : 1.0;
    }

    return Math.min(grossProfit / grossLoss, PROFIT_FACTOR_CAP);
}

/**
 * Calculate Volume-Weighted Win Rate
 * Weights each trade by USD value for more accurate assessment
 */
export function calculateVolumeWeightedWinRate(trades: Trade[]): number {
    const closedTrades = trades.filter(t => t.pnl !== undefined);
    if (closedTrades.length === 0) return 0.5;

    let winningValue = 0;
    let totalValue = 0;

    for (const trade of closedTrades) {
        const value = trade.value || (trade.size * trade.price);
        totalValue += value;
        if (trade.pnl! > 0) {
            winningValue += value;
        }
    }

    if (totalValue === 0) return 0.5;
    return winningValue / totalValue;
}

/**
 * Calculate Maximum Drawdown from equity curve
 * Returns percentage (0-1) of max peak-to-trough decline
 */
export function calculateMaxDrawdown(equityCurve: number[]): number {
    if (equityCurve.length < 2) return 0;

    let maxDrawdown = 0;
    let peak = equityCurve[0];

    for (const equity of equityCurve) {
        if (equity > peak) {
            peak = equity;
        } else {
            const drawdown = (peak - equity) / peak;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }
    }

    return maxDrawdown;
}

/**
 * Build equity curve from trades
 */
export function buildEquityCurve(trades: Trade[], startingEquity: number = 10000): number[] {
    const curve: number[] = [startingEquity];
    let equity = startingEquity;

    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);

    for (const trade of sortedTrades) {
        if (trade.pnl !== undefined) {
            equity += trade.pnl;
            curve.push(equity);
        }
    }

    return curve;
}

/**
 * Calculate Sharpe-like Ratio
 * Uses daily returns with 0 as risk-free rate
 */
export function calculateSharpeRatio(dailyReturns: DailyReturn[]): number {
    if (dailyReturns.length < 2) return 0;

    const returns = dailyReturns.map(d => d.return);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return avgReturn > 0 ? 3 : 0; // Cap at 3 if no volatility

    // Annualize: multiply by sqrt(365) for daily returns
    const annualizedSharpe = (avgReturn / stdDev) * Math.sqrt(365);

    // Cap between -3 and 3 for scoring purposes
    return Math.max(-3, Math.min(3, annualizedSharpe));
}

/**
 * Calculate daily returns from trades
 */
export function calculateDailyReturns(trades: Trade[], startingEquity: number = 10000): DailyReturn[] {
    const closedTrades = trades.filter(t => t.pnl !== undefined);
    if (closedTrades.length === 0) return [];

    // Group PnL by day
    const dailyPnL = new Map<string, number>();

    for (const trade of closedTrades) {
        const date = new Date(trade.timestamp * 1000).toISOString().split('T')[0];
        dailyPnL.set(date, (dailyPnL.get(date) || 0) + trade.pnl!);
    }

    // Convert to returns
    let equity = startingEquity;
    const returns: DailyReturn[] = [];

    const sortedDates = [...dailyPnL.keys()].sort();

    for (const date of sortedDates) {
        const pnl = dailyPnL.get(date)!;
        const dayReturn = pnl / equity;
        returns.push({ date, return: dayReturn });
        equity += pnl;
    }

    return returns;
}

/**
 * Calculate Activity Score (0-100)
 * Based on trade frequency and recency
 */
export function calculateActivityScore(trades: Trade[], periodDays: number = 30): number {
    if (trades.length === 0) return 0;

    const now = Date.now() / 1000;
    const periodStart = now - (periodDays * 24 * 60 * 60);

    const recentTrades = trades.filter(t => t.timestamp >= periodStart);
    const tradeCount = recentTrades.length;

    // Score based on trades per week (ideal: 5-20 trades/week)
    const tradesPerWeek = (tradeCount / periodDays) * 7;

    let score: number;
    if (tradesPerWeek < 1) {
        score = tradesPerWeek * 30; // 0-30 for very inactive
    } else if (tradesPerWeek <= 5) {
        score = 30 + (tradesPerWeek - 1) * 10; // 30-70 for moderately active
    } else if (tradesPerWeek <= 20) {
        score = 70 + ((tradesPerWeek - 5) / 15) * 30; // 70-100 for active
    } else {
        score = 100; // Cap at 100
    }

    // Recency bonus: last trade within 3 days?
    if (recentTrades.length > 0) {
        const lastTradeAge = now - Math.max(...recentTrades.map(t => t.timestamp));
        if (lastTradeAge < 3 * 24 * 60 * 60) {
            score = Math.min(100, score * 1.1);
        }
    }

    return Math.round(score);
}

/**
 * Calculate Copy-Friendliness Score (0-100)
 * Evaluates how suitable trades are for copy trading
 */
export function calculateCopyFriendliness(trades: Trade[]): number {
    if (trades.length < 2) return 50; // Neutral if insufficient data

    let score = 100;

    // 1. Order Size Penalty (large orders harder to fill at same price)
    const avgOrderSize = trades.reduce((sum, t) => sum + t.value, 0) / trades.length;
    if (avgOrderSize > MAX_ORDER_SIZE_PENALTY_THRESHOLD) {
        const penalty = Math.min(30, ((avgOrderSize - MAX_ORDER_SIZE_PENALTY_THRESHOLD) / MAX_ORDER_SIZE_PENALTY_THRESHOLD) * 30);
        score -= penalty;
    }

    // 2. Order Size Variance Penalty (erratic sizing is harder to follow)
    const sizeVariance = calculateVariance(trades.map(t => t.value));
    const normalizedVariance = Math.sqrt(sizeVariance) / avgOrderSize;
    if (normalizedVariance > 1.5) {
        score -= 15;
    }

    // 3. Rapid Execution Penalty (clustered orders hard to follow)
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    let rapidExecutionCount = 0;

    for (let i = 1; i < sortedTrades.length; i++) {
        const gap = (sortedTrades[i].timestamp - sortedTrades[i - 1].timestamp) * 1000;
        if (gap < RAPID_EXECUTION_THRESHOLD_MS) {
            rapidExecutionCount++;
        }
    }

    const rapidRatio = rapidExecutionCount / (sortedTrades.length - 1);
    if (rapidRatio > 0.3) {
        score -= rapidRatio * 30;
    }

    // 4. Market Diversification Bonus (not implemented - would need market data)
    // This would reward traders who trade across multiple markets

    return Math.max(0, Math.round(score));
}

function calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Calculate comprehensive scientific score for a trader
 */
export function calculateScientificScore(
    trades: Trade[],
    options: {
        startingEquity?: number;
        periodDays?: number;
    } = {}
): TraderMetrics {
    const { startingEquity = 10000, periodDays = 30 } = options;
    const tradeCount = trades.filter(t => t.pnl !== undefined).length;

    // Determine data quality
    let dataQuality: 'full' | 'limited' | 'insufficient';
    if (tradeCount >= MIN_TRADES_FOR_FULL_SCORE) {
        dataQuality = 'full';
    } else if (tradeCount >= MIN_TRADES_FOR_LIMITED_SCORE) {
        dataQuality = 'limited';
    } else {
        dataQuality = 'insufficient';
    }

    // Calculate all metrics
    const profitFactor = calculateProfitFactor(trades);
    const volumeWeightedWinRate = calculateVolumeWeightedWinRate(trades);
    const equityCurve = buildEquityCurve(trades, startingEquity);
    const maxDrawdown = calculateMaxDrawdown(equityCurve);
    const dailyReturns = calculateDailyReturns(trades, startingEquity);
    const sharpeRatio = calculateSharpeRatio(dailyReturns);
    const activityScore = calculateActivityScore(trades, periodDays);
    const copyFriendliness = calculateCopyFriendliness(trades);

    // Normalize metrics to 0-100 scale for scoring
    const normalizedSharpe = normalizeToScore(sharpeRatio, -1, 2); // -1 to 2 range
    const normalizedPF = normalizeToScore(profitFactor, 0.5, 3); // 0.5 to 3 range
    const normalizedDrawdown = 100 - (maxDrawdown * 100); // Invert: low drawdown = high score
    const normalizedWinRate = volumeWeightedWinRate * 100;

    // Calculate weighted score
    let scientificScore = 0;

    if (dataQuality !== 'insufficient') {
        scientificScore =
            normalizedSharpe * WEIGHTS.sharpeRatio +
            normalizedPF * WEIGHTS.profitFactor +
            normalizedDrawdown * WEIGHTS.maxDrawdown +
            normalizedWinRate * WEIGHTS.winRate +
            activityScore * WEIGHTS.activity +
            copyFriendliness * WEIGHTS.copyFriendliness;

        scientificScore = Math.max(0, Math.min(100, Math.round(scientificScore)));
    }

    return {
        profitFactor: Math.round(profitFactor * 100) / 100,
        volumeWeightedWinRate: Math.round(volumeWeightedWinRate * 1000) / 10, // percentage
        maxDrawdown: Math.round(maxDrawdown * 1000) / 10, // percentage
        sharpeRatio: Math.round(sharpeRatio * 100) / 100,
        copyFriendliness,
        activityScore,
        scientificScore,
        dataQuality,
        tradeCount,
    };
}

function normalizeToScore(value: number, min: number, max: number): number {
    const normalized = (value - min) / (max - min);
    return Math.max(0, Math.min(100, normalized * 100));
}

// ============================================================================
// Utility: Convert API Data to Trade Format
// ============================================================================

export interface ActivityData {
    type: string;
    timestamp: number;
    side?: 'BUY' | 'SELL';
    size?: number;
    price?: number;
    usdcSize?: number;
}

export interface PositionData {
    size: number;
    avgPrice: number;
    cashPnl?: number;
    currentValue?: number;
}

/**
 * Convert Polymarket activity data to Trade format
 */
export function convertActivityToTrades(activities: ActivityData[]): Trade[] {
    return activities
        .filter(a => a.type === 'TRADE' && a.side && a.size && a.price)
        .map(a => ({
            timestamp: a.timestamp,
            side: a.side as 'BUY' | 'SELL',
            size: a.size!,
            price: a.price!,
            value: a.usdcSize || (a.size! * a.price!),
            pnl: undefined, // Will be calculated from positions
        }));
}

/**
 * Enrich trades with PnL data from positions
 */
export function enrichTradesWithPnL(trades: Trade[], positions: PositionData[]): Trade[] {
    // This is a simplified version - in production you'd match trades to positions
    // For now, we'll estimate PnL from positions
    const totalPnL = positions.reduce((sum, p) => sum + (p.cashPnl || 0), 0);
    const profitableTrades = trades.filter(t => t.side === 'SELL');

    if (profitableTrades.length === 0) return trades;

    // Distribute PnL proportionally across sell trades
    const pnlPerTrade = totalPnL / profitableTrades.length;

    return trades.map(t => {
        if (t.side === 'SELL') {
            return { ...t, pnl: pnlPerTrade };
        }
        return t;
    });
}
