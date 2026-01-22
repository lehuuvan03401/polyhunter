# Fix Simulated Settlement Logic

## Problem
Simulated copy trading positions for settled markets currently remain in an "OPEN" state with incorrect prices (often stuck at entry price or $0). This occurs because:
1.  The system relies on live orderbook data, which disappears or becomes stale when a market settles.
2.  There is no logic to handle market resolution events and "redeem" the winning share for $1.00 or expire losing shares at $0.00.
3.  This leads to inaccurate PnL reporting and unrealistic "zombie" positions in the portfolio.

## Solution
Implement a realistic settlement simulation within the `copy-trading-worker`. The worker will:
1.  Listen for `market_resolved` events from the Polymarket WebSocket.
2.  Determine the winning outcome.
3.  Automatically "redeem" simulated positions:
    *   **Winners**: marked as WON, position closed at $1.00/share.
    *   **Losers**: marked as LOST, position closed at $0.00/share.
4.  Update the database (`UserPosition` and potentially a new `History` entry) to reflect this settlement, ensuring the Portfolio UI displays correct historic PnL.

## Goals
-   **Accuracy**: Settled markets should reflect their final value ($1 or $0).
-   **Realism**: Simulate the redemption process (converting winning shares to cash).
-   **Clean UI**: Settled positions should move from "Open Positions" to "History" (or be clearly marked as Settled in a separate view).
