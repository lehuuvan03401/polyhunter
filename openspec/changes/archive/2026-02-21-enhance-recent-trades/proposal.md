# Enhance Recent Trades Display
> change-id: enhance-recent-trades
> type: enhancement
> status: proposed

## Summary
Add Price, Shares, and Precise Time (seconds) to the Recent Trades list on the Trader Profile.

## Problem
The current display is too simple. It lacks execution price, share count, and precise timestamps, making it hard to evaluate the specific trade mechanics.

## Solution
1.  **Backend (`api/traders/[address]/route.ts`)**: Update timestamp formatting to include seconds.
2.  **Frontend (`traders/[address]/page.tsx`)**:
    -   Consume `shares`, `price`, and `time` properties.
    -   Redesign the trade card to show "Bought X Shares at $Price".
    -   Display precise timestamp.

## Dependencies
- `web/app/traders/[address]/page.tsx`
- `web/app/api/traders/[address]/route.ts`
