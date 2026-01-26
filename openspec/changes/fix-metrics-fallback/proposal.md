# Fix Metrics Fallback Logic
> change-id: fix-metrics-fallback
> type: fix
> status: proposed

## Summary
Update the metrics API to correctly attribute fallback PnL calculations (for legacy records) to the `realizedWins` and `realizedLosses` breakdown.

## Problem
The user reported that the "W" (Wins) metric in the dashboard is significantly lower than the sum of "Won" trades in the table. Investigation revealed that the `metrics/route.ts` uses a fallback to calculate PnL on the fly for old records (where `realizedPnL` is null), but it fails to add these values to the `realizedWins` and `realizedLosses` variables.

## Solution
In `frontend/app/api/copy-trading/metrics/route.ts`:
-   In the loop iterating over `sellTradesWithoutPnL`:
    -   If `profit > 0`: `realizedWins += profit`
    -   If `profit < 0`: `realizedLosses += profit`

## Dependencies
-   `frontend/app/api/copy-trading/metrics/route.ts`
