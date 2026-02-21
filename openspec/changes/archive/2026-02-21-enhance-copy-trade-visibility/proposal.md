# Proposal: Enhanced Copy Trade Visibility

## Goal
Improve transparency for copy traders by providing detailed metrics connecting the Leader's original action to the User's copy execution. This enables users to audit performance, verify execution speed (latency), and understand price slippage.

Specific enhancements:
1.  **Leader Transaction Link**: Direct link to the leader's on-chain transaction (e.g., PolygonScan) for verification.
2.  **Price Slippage**: Explicit comparison between Leader's Entry Price and User's Execution Price.
3.  **Latency Metrics**: Leader's detected time vs. User's specific execution time.
4.  **Order Context**: (Future safe) Structure for capturing Order Type (Market/Limit) if available.

## Context
Currently, the Order Status panel shows the User's execution details and recently added Leader Size. However, users cannot easily verify the "truth" of the original trade (e.g., did the leader actually trade this? when exactly?).

Linking to the blockchain provides the ultimate source of truth.

## Proposed Changes
1.  **Schema Migration**: Add `originalTxHash` (String?) to `CopyTrade` model.
2.  **Backend Logic**: Updates `TradingService` (implied) or the detection logic to capture and save `originalTxHash`.
3.  **API Update**: Expose `originalTxHash`, `originalPrice`, `copyPrice`, and timestamps in `/api/copy-trading/orders`.
4.  **Frontend**: Update `OrderStatusPanel` to render:
    *   Leader Tx Link (icon).
    *   Price Slippage (e.g., "Slippage: 0.5%").
    *   Latency (implicitly shown by timestamps).
