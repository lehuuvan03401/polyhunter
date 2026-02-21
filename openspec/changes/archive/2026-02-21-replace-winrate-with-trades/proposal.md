# Replace Win Rate with Total Trades
> change-id: replace-winrate-with-trades
> type: enhancement
> status: proposed

## Summary
Replace the unreliable "Win Rate" metric with "Total Trades" on the profile page.

## Problem
Users reported "100% Win Rate" as impossible/fake. Calculating accurate all-time win rate is not feasible with current data, and partial win rates are misleading.

## Solution
1.  **Frontend (`traders/[address]/page.tsx`)**:
    -   Switch the 3rd metric column from Win Rate (`%`) to Total Trades (`#`).
    -   Format large numbers (e.g., 1.2K).

## Dependencies
- `web/app/traders/[address]/page.tsx`
