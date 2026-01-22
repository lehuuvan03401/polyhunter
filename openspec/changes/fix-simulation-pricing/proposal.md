# Fix Simulation Pricing

## Metadata
- **Type**: Bug Fix
- **Status**: Proposed
- **Priority**: High

## Problem
Users monitoring simulated copy trading positions observe that "Current Price" often exactly matches "Entry Price" in the dashboard, and position counts seem lower than expected. This occurs because:
1. The `frontend/app/api/copy-trading/positions/route.ts` endpoint fails to fetch live orderbook prices (CLOB) for simulated positions (likely due to API limitations or errors) and defaults to `avgEntryPrice`.
2. The simulation script (`simulate-copy-trading.ts`) explicitly calculates unrealized PnL assuming current price equals entry price for its summary.

## Solution
1. **Enhance Position API**: Modify `route.ts` to use Gamma API data (which is already being fetched for resolution checks) as a fallback for current prices when CLOB orderbook fetching fails or returns no liquidity.
2. **Upgrade Simulation Script**: Update `simulate-copy-trading.ts` to fetch real market prices for its end-of-run summary instead of assuming static prices.
3. **Validation**: Rely on the improved pricing logic to verify the fix by running the simulation and observing distinct Entry vs Current prices.

## Impact
- **Dashboard**: "Portfolio" tab will show accurate, live market prices for simulated positions.
- **Simulation**: CLI summary will report realistic PnL based on live data.
