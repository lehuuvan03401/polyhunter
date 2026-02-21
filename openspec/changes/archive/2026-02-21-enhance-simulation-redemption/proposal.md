# Enhance Simulation Redemption Logic
> change-id: enhance-simulation-redemption
> type: enhancement
> status: proposed

## Summary
Update the `simulate-copy-trading.ts` script to use more robust logic for detecting market resolution and settling positions. It will now check the `winner` flag and `closed` status from the Gamma API, mirroring the logic used in the Portfolio UI.

## Problem
The current simulation script only redeems a position if the market price is strictly `>= 0.95` or `<= 0.05`. However, sometimes a market is resolved (closed) and the winner is declared, but the price data might be missing, zero, or stale. This leads to a discrepancy where the Portfolio UI correctly identifies the position as "WON" (based on metadata), but the simulation refuses to redeem it, leaving the PnL as "Unrealized".

## Solution
Update `processRedemptions` in `simulate-copy-trading.ts`:
1.  Check for `t.winner` boolean in Gamma API response.
2.  Check for `market.closed` status.
3.  If `winner === true` OR `price >= 0.95` -> Execute Win Redemption.
4.  If `winner === false` (and closed) OR `price <= 0.05` -> Execute Loss Settlement.

## Risks
-   Improved redemption might trigger a wave of redemptions for old positions if the user restarts the script without clearing the DB (though currently it clears DB on start).

## Dependencies
-   `web/scripts/simulate-copy-trading.ts`
