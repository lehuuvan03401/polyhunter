# Change: Implement Scientific Trader Scoring System

## Why

The current trader ranking systems ("Top 10 Most Followed Traders" and "Top Performers") use simplistic metrics that don't adequately help copy traders identify profitable opportunities. The existing algorithms:

1. **Lack risk-adjusted metrics** - Only look at total PnL without considering volatility or drawdowns
2. **Have flawed win rate calculation** - Only count current positions, ignoring closed trades
3. **Missing profitability consistency** - No profit factor calculation (total gains / total losses)
4. **No copy-friendliness assessment** - Don't evaluate if a trader's style is suitable for copy trading

Copy traders need scientifically sound metrics to maximize their profits while managing risk.

## What Changes

### New Capabilities
- **Scientific Scoring Algorithm** with weighted multi-factor analysis
- **Risk-Adjusted Performance Metrics** (Sharpe Ratio, Max Drawdown)
- **Profitability Metrics** (Profit Factor, Volume-Weighted Win Rate)
- **Copy-Friendliness Score** (order size distribution, execution speed)

### UI Enhancements
- New metrics displayed on trader leaderboard
- Filtering/sorting by different risk profiles
- Warning indicators for high-risk traders

## Impact

- **Affected specs**: New capability `trader-scoring` (no existing specs affected)
- **Affected code**:
  - `app/api/traders/active/route.ts` - Enhanced scoring algorithm
  - `components/home/leaderboard-table.tsx` - Display new metrics  
  - `components/smart-money/smart-money-table.tsx` - Display new metrics
  - `Horus/src/services/smart-money-service.ts` - SDK scoring updates
