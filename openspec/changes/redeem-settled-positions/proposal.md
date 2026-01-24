# Proposal: Redeem Settled Positions

## Context
Users currently see "Unrealized P&L" for positions that have already settled (Won/Lost). While technically correct (funds are still in position tokens), it causes confusion. To "Realize" this profit and clean up the portfolio, we need a mechanism to Redeem (or Sell) these settled positions.

## Objective
Implement robust Redemption logic for both Simulated and Real trading to allow users to convert settled winning Outcome Tokens back into Collateral (USDC).

## Scope
-   **Simulation**: Auto-redeem or provide manual redeem for simulated winning positions.
-   **Real Trading**: Provide "Redeem" action in the UI for settled winning positions.
