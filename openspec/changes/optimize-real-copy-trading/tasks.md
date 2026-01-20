# Tasks: Optimize Real Copy Trading

- [ ] **Phase 1: Realistic Simulation** (`simulate-copy-trading.ts`)
    - [ ] Implement `SlippageModel` class (Fixed % or Random range).
    - [ ] Add `GasEstimator` to deduct ~0.03 USD equivalent per trade.
    - [ ] Update PnL calculation to include `netProfit` (after costs).
    - [ ] Verify: Run simulation and compare "Gross PnL" vs "Net PnL".

- [ ] **Phase 2: Low Latency Production** (`copy-trading-worker.ts`)
    - [ ] Instantiate `RealtimeService` (WebSocket) in worker.
    - [ ] Subscribe to `trade` channel for ALL markets (or filtered list if possible).
    - [ ] Implement `handleWebsocketTrade` parser (map `maker_address` to Config).
    - [ ] Replace `ctf.on('TransferSingle')` with WebSocket listener.
    - [ ] Verify: Run worker in "Dry Run" mode against live WebSocket to confirm detection speed.

- [ ] **Phase 3: Verification**
    - [ ] Monitor Latency: Measure "Event Time" vs "Action Time".
    - [ ] Compare "Simulated Result" vs "Real Execution" for a test account.
