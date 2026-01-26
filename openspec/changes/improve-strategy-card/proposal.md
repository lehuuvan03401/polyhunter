# Improve Strategy Card UI
> change-id: improve-strategy-card
> type: enhancement
> status: proposed

## Summary
Enrich the Strategy Card in the Portfolio UI to display comprehensive configuration details, including Execution Mode, Automation Status, and Risk Settings.

## Problem
Users reported that the strategy list "info is too brief". Critical settings chosen during creation (like Security vs Speed mode, Hands-Free automation) are invisible after creation.

## Solution
1.  **Backend (`strategies/route.ts`)**: Fetch additional fields (`executionMode`, `autoExecute`, `slippageType`, `maxSlippage`, `infiniteMode`, `direction`).
2.  **Frontend (`active-strategies-panel.tsx`)**: Update the card layout to display:
    -   ⚡ Speed Mode vs 🛡️ Security Mode badge.
    -   🤖 Hands-Free vs Manual badge.
    -   Risk settings (Slippage, Max Limit).
    -   Win Rate / PnL (if available in future, but for now just config).

## Dependencies
- `frontend/app/api/copy-trading/strategies/route.ts`
- `frontend/components/copy-trading/active-strategies-panel.tsx`
