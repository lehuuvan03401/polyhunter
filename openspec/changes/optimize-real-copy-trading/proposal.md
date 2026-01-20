# Proposal: Optimize Real Copy Trading (Low Latency & Realistic Sim)

## Goal
Bridge the gap between simulation and reality by:
1.  **Reducing Production Latency**: Switch `copy-trading-worker.ts` from chain events (slow) to WebSocket events (fast) to match simulation speed.
2.  **Increasing Simulation Realism**: Add Slippage and Gas/Fee modeling to `simulate-copy-trading.ts` to provide conservative, realistic PnL estimates.

## Problem
- **Latency**: Production worker listens to `TransferSingle` events, which lag behind orderbook matching by seconds. This causes missed entry prices.
- **Optimism**: Simulation assumes 0ms latency, exact price matching, and 0 costs, leading to inflated PnL expectations compared to reality.

## Solution

### 1. Low Latency Execution (Production)
- **Component**: `copy-trading-worker.ts`
- **Change**: Replace `ethers` contract listener with `RealtimeService` (WebSocket) listener.
- **Logic**: Trigger copy trades on CLOB `trade` events (instant), filter by "Maker" address (the tracked trader).

### 2. Realistic Simulation (Dev)
- **Component**: `simulate-copy-trading.ts`
- **Change**:
    - **Slippage**: Apply a configurable "market impact" penalty (e.g., 0.5% or dynamic based on size).
    - **Fees**: Deduct estimated Polygon gas (~0.01 MATIC) and Proxy fees per trade.
    - **Failure Rate**: Randomly fail X% of trades to simulate network issues or max slippage aborts.

## Risks
- **WebSocket Stability**: CLOB WebSocket can disconnect; requires robust reconnection logic (already present in `RealtimeService`?).
- **False Positives**: WEBSOCKET `trade` events don't guaranteed settlement (though highly likely on Polymarket). We might copy a trade that technically reverts on-chain (rare for CLOB matches).
