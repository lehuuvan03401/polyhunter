# Fix PnL Rounding Error
> change-id: fix-pnl-rounding
> type: fix
> status: proposed

## Summary
Enforce mathematical consistency in the Metrics API by recalculating the total `tradingPnL` as the exact sum of `realizedWins` and `realizedLosses` before sending the response.

## Problem
Due to floating-point precision issues during the aggregation of thousands of trades, the independently calculated `tradingPnL` can differ slightly (e.g., by 1 cent) from the sum of its components (`realizedWins` and `realizedLosses`). This causes "W + L != Total" on the user dashboard.

## Solution
In `web/app/api/copy-trading/metrics/route.ts`:
- After all accumulations (DB + Fallback) are complete:
- Set `realizedPnL = realizedWins + realizedLosses`
- Set `tradingPnL = realizedWins + realizedLosses`

## Dependencies
- `web/app/api/copy-trading/metrics/route.ts`
