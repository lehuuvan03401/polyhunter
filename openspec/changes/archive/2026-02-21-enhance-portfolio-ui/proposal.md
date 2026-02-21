# Enhance Portfolio UI

## Metadata
- **Type**: UI Improvement
- **Status**: Proposed
- **Priority**: Medium

## Problem
The current Portfolio page uses terminology that can be ambiguous ("Outcome" instead of "Side") or less precise ("Entry" instead of "Avg. Price"). Additionally, users lack a clear view of their Return on Investment (ROI) and potential Max Payout, making it harder to assess position performance at a glance.

## Solution
Update the `PortfolioPage` table headers and columns to:
1.  **Rename Headers**:
    - Change "Outcome" to **"Side"**.
    - Change "Entry" to **"Avg. Price"**.
    - Change "Size" to **"Shares"**.
2.  **Add ROI Column**: Display ROI % explicitly, separate from PnL ($).
3.  **Add Total Invested Column**: Display the total cost basis (`Shares * Avg. Price`).
4.  **Add Max Payout**: Display the potential payout if the position resolves to Yes/Win (Shares * $1).
5.  **Formatting**: Ensure consistent coloring for Sides (Green/Red) and PnL/ROI.

## Impact
- **Clarity**: Users will intuitively understand they are holding a "Side" (Yes/No) and "Shares".
- **Precision**: "Avg. Price" correctly implies the cost basis. "Total Invested" shows skin in the game.
- **Insight**: ROI and Max Payout provide immediate context on risk/reward.
