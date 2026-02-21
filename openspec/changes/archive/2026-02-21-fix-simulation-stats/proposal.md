# Fix Simulation Statistics
> change-id: fix-simulation-stats
> type: fix
> status: proposed

## Summary
Correct the volume calculation logic in the simulation script (`simulate-copy-trading.ts`) and align the price fetching logic for the summary report with the Frontend to ensure data consistency.

## Problem
1.  **Volume Underreporting**: The script hardcodes `totalBuyVolume += FIXED_COPY_AMOUNT` (which defaults to 1), completely ignoring the actual trade size. This causes the reported volume to be ~50x lower than reality.
2.  **Unrealized PnL Mismatch**: The script uses a different price source strategy (Gamma only) than the Frontend (CLOB -> Gamma). This leads to differing "Current Price" values and thus different PnL numbers.

## Solution
1.  **Fix Volume**: Update `handleTrade` to use `copyAmount` (Buy) and `pnl + costBasis` (Sell Proceeds) for volume tracking.
2.  **Align Pricing**: Update `printSummary` to attempt fetching CLOB prices for active tokens before falling back to Gamma, mirroring the Frontend's logic.

## Dependencies
-   `web/scripts/simulate-copy-trading.ts`
