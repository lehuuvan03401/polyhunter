# Design: Simulated Settlement Engine

## Architecture

The `copy-trading-worker` will be expanded to include a **Settlement Engine**.

### 1. Event Listener
-   The worker currently subscribes to `clob_market` data but needs to explicitly handle `market_resolved` events.
-   We will leverage `RealtimeServiceV2.subscribeMarketEvents` to listen for resolution.

### 2. Resolution Handler
When a `market_resolved` event is received:
1.  **Extract Data**: Get `conditionId` and resolution data (winning outcome token ID).
2.  **Identify Positions**: Query the database (`UserPosition` joined with `CopyTrade` or metadata) to find all simulated positions holding tokens for this market.
    *   *Challenge*: `UserPosition` only has `tokenId`. We need to map `tokenId` -> `market` or `conditionId`.
    *   *Solution*: We can use the cached `CopyTrade` metadata or query the `PolyClient` (Reference Data) to identify the market for a given token if needed. However, since the event gives us `conditionId`, we might need to lookup which tokens belong to it.
    *   *Optimization*: We can maintain a cache of `conditionId -> tokenIds[]` for active positions.

### 3. Redemption Logic
For each affected position:
-   **Winning Position**:
    -   Calculate Value: `Shares * $1.00`.
    -   Action:
        1.  Create a "Sell" record (simulated) at price $1.00 to crystallize PnL in history.
        2.  Credit simulated cash (if tracked) or just update PnL stats.
        3.  Delete/Archive the `UserPosition` record so it leaves the "Open" list.
-   **Losing Position**:
    -   Calculate Value: `Shares * $0.00`.
    -   Action:
        1.  Create a "Sell" record at price $0.00.
        2.  Delete/Archive the `UserPosition`.

### 4. Database Schema
-   No schema changes strictly required if we use the existing tables creatively.
-   However, adding `status` to `UserPosition` might be safer than deleting it, if we want to show "Settled" positions before they are archived.
    -   *Decision*: For now, we will simulate "Auto-Redemption", which means they are effectively "Sold". So creating a `CopyTrade` (or `TradeHistory` equivalent) and removing `UserPosition` is the most realistic representation of "Claiming Winnings".

## Components to Modify
-   `scripts/copy-trading-worker.ts`: Add subscription and handler.
-   `src/services/copy-trading-execution-service.ts`: Add `simulateRedemption` method? Or keep it in worker for now.
