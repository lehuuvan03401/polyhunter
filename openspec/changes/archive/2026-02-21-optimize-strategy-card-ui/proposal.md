# Optimize Strategy Card UI
> change-id: optimize-strategy-card-ui
> type: enhancement
> status: proposed

## Summary
Refine the Strategy Card UI to concise, visual-rich layout with better alignment for Risk Settings.

## Problem
User feedback indicates the Risk Settings details are not detailed enough and the UI layout needs optimization (current "spread" layout is hard to read).

## Solution
1.  **Frontend (`active-strategies-panel.tsx`)**:
    -   **Compact Layout**: Group stats into a unified status bar or compact grid.
    -   **Visual Icons**: Add icons for key metrics (Mode, Max Trade, Slippage, Direction).
    -   **Clearer Labels**: Use descriptive labels and better proximity.
    -   **Styling**: Use a subtle background for the stats block to distinguish it from the header.

## Dependencies
- `web/components/copy-trading/active-strategies-panel.tsx`
