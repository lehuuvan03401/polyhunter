# Fix Trade Count Discrepancy
> change-id: fix-trade-count
> type: fix
> status: proposed

## Summary
Update the Simulation Summary to report the total number of database records as "Total Orders", ensuring it matches the Frontend Dashboard count.

## Problem
The Simulation script tracks `tradesRecorded` (Copy Trades only) separately from the database records. When the script performs settlements (redemptions/closes), these generate additional database records that are not reflected in `tradesRecorded`. This causes a confusing discrepancy between the "Trades Recorded" summary line and the Dashboard's "Orders" count.

## Solution
In `printSummary` via `simulate-copy-trading.ts`:
- Replace the usage of the memory variable `tradesRecorded` with `dbTrades.length` for the summary output.
- Rename the label from "Trades Recorded" to "Total Orders Recorded" to accurately reflect that it includes settlements.

## Dependencies
- `web/scripts/simulate-copy-trading.ts`
