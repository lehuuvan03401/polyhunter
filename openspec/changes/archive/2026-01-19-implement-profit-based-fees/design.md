# Design: Profit-Based Fee Logic

## Problem
The current system charges a flat fee on *Trading Volume* at the moment of execution. The new requirement is to charge a fee only on *Realized Profit*.

## Challenges
1.  **statefulness:** To calculate profit, we must link a "Sell" (Closing) transaction to a previous "Buy" (Opening) transaction to determine the Cost Basis.
2.  **Cost Basis Calculation:** We need a method (FIFO or Weighted Average) to track the user's entry price for the specific token being sold.
3.  **Data Persistence:** The current `distributeCommissions` is stateless regarding positions. We might need a `Position` or `CostBasis` table if not already present.

## Solution Architecture

### 1. Cost Basis Tracking
The `CopyTradingSupervisor` or `AffiliateEngine` must track the `Average Entry Price` for each user-token pair.

**Algorithm (Weighted Average):**
- **On Buy:** Update Average Entry Price.
    - `Total Value = (Old Balance * Old Avg) + (New Amt * New Price)`
    - `New Avg = Total Value / (Old Balance + New Amt)`
- **On Sell:** Calculate Profit.
    - `Profit = (Sell Price - Avg Mean Price) * Sell Amount`
    - *Note:* Average Entry Price does not change on Sell.

### 2. Fee Calculation
- **Trigger:** If `Profit > 0` on a Sell transaction.
- **Base:** `Profit`.
- **Rate:** Determined by `User.totalVolume` (Cumulative).

**Tier Structure (Proposed):**
| Cumulative Volume | Fee Rate on Profit |
|-------------------|--------------------|
| \$0 - \$10k       | 20%                |
| \$10k - \$100k    | 15%                |
| \$100k+           | 10%                |

### 3. Database Updates
- We might need to store `avgEntryPrice` in a table (e.g., `UserPosition` or add to `Referral`?).
- Currently `Referral` tracks volume, but not open positions.
- *Alternative:* Query `CommissionLog` or `TradeHistory` to reconstruction position? Too slow.
- *Recommendation:* Add `averageEntryPrice` to a new or existing model.

## Component Changes
- **`AffiliateEngine`**:
    - Add `calculateProfit(trade)` method.
    - Update `distributeCommissions` to accept `profitUSD`.
    - Implement `getFeeRate(totalVolume)` logic.
- **`CopyTradingSupervisor`**:
    - Maintain local or DB-based state of User Positions to provide "Profit" data to the engine.

## Trade-offs
- **Complexity:** Moving from stateless volume fees to stateful profit fees introduces significant complexity in tracking cost basis.
- **Accuracy:** Requires accurate tracking of *all* user trades (not just copied ones) if we want true PnL, or we limit it to "Copied Trades PnL" (easier). *Assumption: Limit to Copied Trades PnL.*
