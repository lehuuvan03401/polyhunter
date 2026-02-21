# Design: Redemption vs Selling for Settled Positions

## Analysis: Redeem vs Sell

The user asked: *"Should it be better to implement the 'Redeem' or 'Sell' functionality?"*

### Option A: Selling
-   **Mechanism**: Place a SELL order on the CLOB (or AMM).
-   **Pros**: Unified interface (everything is a Buy/Sell). Can exit positions *before* settlement.
-   **Cons**:
    -   Requires Liquidity: Someone must be willing to buy your winning share.
    -   Slippage/Spread: You might get $0.99 or $0.98 instead of $1.00.
    -   Fees: Exchange fees may apply.
    -   Impossible if market is deprecated/delisted after resolution.

### Option B: Redemption
-   **Mechanism**: Call `redeemPositions` on the Conditional Tokens Framework (CTF) contract.
-   **Pros**:
    -   **Guaranteed Value**: Always returns exactly $1.00 per winning share (minus gas). No slippage.
    -   **No Liquidity Needed**: Contractual guarantee. Works forever (even years later).
-   **Cons**:
    -   Gas Cost: Requires a transaction (on Polygon).
    -   UX Complexity: Different flow than Selling.

### Recommendation
1.  **For Settled, Winning Positions**: **Redemption is strictly superior** (economically) assuming Gas < Spread. Since Polymarket is on Polygon (cheap gas), Redemption is almost always better than Selling for $0.99.
2.  **For Simulation**: **Redemption** should be simulated. Since we are simulating "Perfect Play", we should simulate converting winning shares to $1.00 cash instantly (or lazily).
3.  **For Losing Positions**: Neither applies. They expire worthless ($0). No action needed (other than hiding them from UI).

## Proposed Solution (Hybrid)

1.  **UI**: Introduce a "Redeem" action for positions where `Status = WON`.
    -   This distinguishes "Taking Profit" (Redeem) from "Exiting Early" (Sell).
2.  **Simulation**:
    -   Implement `redeemSimulatedPositions` which converts `Won` positions to `Cash` balance.
    -   This moves PnL from "Unrealized" to "Realized" in the metrics.

## Technical Architecture

### Simulation
-   New cron/script function: `processRedemptions()`.
-   Trigger: When `sim-worker` detects market status `closed` AND we have `Won` positions.
-   Action: 
    -   Calculate `Value = Shares * $1`.
    -   Credit `USDC` (Simulated).
    -   Remove `UserPosition`.
    -   Create `CopyTrade` record of type `REDEEM` (or `SELL` but marked as settlement).

### Real Trading
-   New UI Hook: `useRedeem()`.
-   Interaction: `CTFExchange.redeemPositions(...)`.
-   Display: Show "Redeem Winnings" button on Portfolio when applicable.
