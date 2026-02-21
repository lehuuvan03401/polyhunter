# Expand Quick Amount Options
> change-id: expand-quick-amounts
> type: enhancement
> status: proposed

## Summary
Add $1 and $5 to the quick amount options and display them in a 2-row grid.

## Problem
Users want to easily select smaller "test" amounts ($1, $5) without typing. The current list ($10+) is not comprehensive enough for small-scale testing.

## Solution
1.  **Frontend (`copy-trade-modal.tsx`)**:
    -   Update options to: `[1, 5, 10, 25, 50, 100]`.
    -   Use a Grid layout (`grid grid-cols-3 gap-2`) to display them in two neat rows.

## Dependencies
- `frontend/components/copy-trading/copy-trade-modal.tsx`
