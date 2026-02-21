# Fix Simulation PnL Logic
> change-id: fix-simulation-pnl-logic
> type: fix
> status: proposed

## Summary
Fix the PnL discrepancies in the simulation and portfolio metrics by ensuring the simulation script records realized PnL for valid SELL trades and correcting the fallback calculation logic in the metrics API.

## Problem
1.  **Missing Data**: The `simulate-copy-trading.ts` script calculates PnL for SELL trades but fails to save it to the `realizedPnL` column in the database.
2.  **Incorrect Calculation**: The `metrics/route.ts` API has a fallback mechanism for trades missing `realizedPnL`, but it incorrectly treats `copySize` (which is in Shares) as an Investment Amount (USD), leading to wrong cost basis and profit calculations.

## Solution
1.  **Update Simulation Script**: Modify `recordCopyTrade` in `simulate-copy-trading.ts` to include the `realizedPnL` field in the Prisma `create` call.
2.  **Update Metrics API**: Correct the fallback logic in `metrics/route.ts` to treat `copySize` as shares:
    -   Cost Basis = `copySize * copyPrice`
    -   Profit = `(SellPrice - BuyAvgPrice) * Shares`

## Risks
-   Changing the metrics fallback logic will alter the displayed historical PnL for existing buggy records. This is desired (it currently shows wrong numbers), but might look like a sudden jump.

## Dependencies
-   `web/scripts/simulate-copy-trading.ts`
-   `web/app/api/copy-trading/metrics/route.ts`
