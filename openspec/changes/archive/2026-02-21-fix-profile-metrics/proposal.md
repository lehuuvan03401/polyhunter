# Fix Profile Metrics & Time Period
> change-id: fix-profile-metrics
> type: fix
> status: proposed

## Summary
Add "All Time" labels to PnL/Volume and fix misleading Win Rate calculation.

## Problem
The UI lacks time period context for metrics. The "Win Rate" calculation uses heuristics or active positions which produces misleading "100%" values.

## Solution
1.  **Frontend (`traders/[address]/page.tsx`)**:
    -   Add "ALL TIME" label to PnL and Volume headers.
    -   Rename "Win Rate" to "Active Accuracy" if derived from active positions, or clarify it's an estimate.
2.  **Backend (`api/traders/[address]/route.ts`)**:
    -   Use `profile.tradeCount` for correct total trades.
    -   Remove heuristic win rate estimation.
    -   Prioritize upstream `winRate` if available.

## Dependencies
- `web/app/traders/[address]/page.tsx`
- `web/app/api/traders/[address]/route.ts`
