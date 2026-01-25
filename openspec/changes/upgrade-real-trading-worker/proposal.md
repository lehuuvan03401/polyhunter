# Upgrade Real Trading Worker
> change-id: upgrade-real-trading-worker
> type: enhancement
> status: proposed

## Summary
Upgrade the `copy-trading-worker.ts` script to support **Real On-Chain Redemption** and robust settlement logic, matching the improvements made to the simulation engine. This ensures that when a copy-traded market resolves, the user's funds are actually redeemed on-chain and PnL is accurately recorded.

## Problem
1.  **Funds Stuck**: The current worker detects market resolution but only updates the local database ("Simulated Settlement"). It fails to call the `CTF` contract to redeem the real tokens held by the user's proxy.
2.  **Missing Redemptions**: The worker relies on strict price thresholds (`>0.95`), which can miss valid wins if price data is stale or missing (a common issue fixed in the simulation).
3.  **PnL Gaps**: Realized PnL is not explicitly calculated for these settlements, leading to gaps in Portfolio metrics.

## Solution
1.  **Refactor `resolveSimulatedPositions`**: Rename to `resolvePositions` and integrate `executionService.redeemPositions` to execute the redemption on the blockchain.
2.  **Robust Logic**: Implement the `winner` / `closed` check logic to ensure all valid wins are redeemed.
3.  **PnL Recording**: Explicitly calculate `(Value - Cost)` and save to `realizedPnL` in the database.

## Risks
-   **Gas Costs**: Auto-redemption incurs gas fees. This is standard for real trading but worth noting.
-   **Double Redemption**: Logic must ensure we don't try to redeem already redeemed positions (the DB check handles this).

## Dependencies
-   `frontend/scripts/copy-trading-worker.ts`
-   `src/services/copy-trading-execution-service.ts`
