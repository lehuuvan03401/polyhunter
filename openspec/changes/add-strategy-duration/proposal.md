# Add Strategy Duration & Stop Time
> change-id: add-strategy-duration
> type: enhancement
> status: proposed

## Summary
Display the stop time and total active duration for stopped copy trading strategies.

## Problem
The "Stopped" strategies list currently looks identical to the "Active" list (showing only Start Time). Users requested to see "End Time" and "Total Run Time" to evaluate past strategies.

## Solution
1.  **Backend (`strategies/route.ts`)**: Fetch `updatedAt` from the database.
2.  **Frontend (`active-strategies-panel.tsx`)**:
    -   Calculate `duration = updatedAt - createdAt`.
    -   Format duration nicely (e.g., "active for 2d 14h").
    -   Display "Stopped: [Date]" alongside the Start Date in the card footer.

## Dependencies
- `frontend/components/copy-trading/active-strategies-panel.tsx`
