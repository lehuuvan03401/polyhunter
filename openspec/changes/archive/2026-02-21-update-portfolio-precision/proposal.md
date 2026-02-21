# Update Portfolio Table Precision
> change-id: update-portfolio-precision
> type: enhancement
> status: proposed

## Summary
Increase the decimal precision from 2 to 4 places for "Avg. Price", "Current", "Total Invested", and "PnL" columns in the Portfolio table.

## Problem
The user sees 2 decimal places (e.g. $0.43), which hides significant digits for share prices and PnL calculation, especially for outcome tokens which often trade in the 0-1 range. This makes it hard to see small movements or precise entry costs.

## Solution
In `frontend/app/portfolio/page.tsx`, update the `.toFixed(2)` calls to `.toFixed(4)` for the relevant columns in the positions table.

## Dependencies
- `frontend/app/portfolio/page.tsx`
