# Implement Profit-Based Fee Logic

## Goal
Switch the affiliate/copy-trading fee model from a purely volume-based transaction fee (0.1% of volume) to a **profit-based performance fee**. Fees should only be collected when a copy-trade results in a profit for the follower.

The fee rate (percentage of profit) will be determined dynamically based on the follower's **cumulative trading volume**.

## Context
Currently, the system charges a fixed percentage (e.g., 0.1%) of the trading volume for every trade, regardless of the outcome (profit or loss). This creates a "toll" system.

The new requirement is to align incentives by only charging when the user makes money ("No win, no fee" / High Water Mark conceptually, though applied per-trade here), while rewarding high-volume traders with potentially better rates.

## Changes
- **Fee Trigger:** Change from "Always" to "Only when Profit > 0".
- **Fee Rate:** Change from "Fixed 0.1% of Volume" to "Dynamic % of Profit" based on Tiers.
- **Tiers:** Define Volume-based tiers for the Fee Rate.
