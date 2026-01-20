
1. **Scaffold API Routes**
   - [ ] Create `/api/copy-trading/metrics` endpoint to return aggregated stats (totalInvested, unrealizedPnL, realizedPnL).
   - [ ] Update `/api/copy-trading/positions` (if not exists) or create it to return `UserPosition` records enriched with current market prices.

2. **Frontend Data Hooks**
   - [ ] Create `useCopyTradingMetrics` hook to poll the metrics endpoint.
   - [ ] Create `useCopyTradingPositions` hook to poll the positions endpoint.

3. **UI Implementation - Metric Cards**
   - [ ] Add "Invested Funds" Card to `PortfolioPage`.
   - [ ] Update "Profit/Loss" Card to display the aggregated PnL from the new hook.
   - [ ] Ensure numbers animate or update smoothly.

4. **UI Implementation - Positions Table**
   - [ ] Merge (or switch to) local `UserPosition` data in the "Positions" tab when in simulation mode (or append them).
   - [ ] Verify that new trades from the simulation script appear automatically.
