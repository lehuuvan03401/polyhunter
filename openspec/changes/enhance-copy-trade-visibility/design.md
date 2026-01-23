# Design: Enhanced Copy Trade Visibility

## Schema Changes

### `CopyTrade` Model
Old:
```prisma
model CopyTrade {
  // ...
  originalTrader String
  // ...
}
```

New:
```prisma
model CopyTrade {
  // ...
  originalTrader String
  originalTxHash String? // [NEW] Stores the transaction hash of the leader's trade
  // ...
}
```

## Data Flow
1.  **Detection**: When `CopyTradingWorker` detects a trade (via WebSocket or polling), it extracts the `transactionHash` from the log/event.
2.  **Storage**: Passing this `transactionHash` to the `CopyTrade.create` call.
3.  **Retrieval**: The `GET /api/copy-trading/orders` endpoint aliases this as `leaderTxHash` for the frontend.

## UX Design
*   **Leader Column**: Add a small "Link" icon next to the "Leader Size" or "Leader Time".
*   **Tooltip**: "View Leader's Transaction on PolygonScan".
*   **Price Column**:
    *   Display "My Price: $X".
    *   Subtext/Badge: "Diff: +0.1%".
