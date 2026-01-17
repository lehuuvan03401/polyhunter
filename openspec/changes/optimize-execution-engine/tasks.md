## 1. Initialization Fix
- [ ] 1.1 Update `TradingService` to allow checking initialization status
- [ ] 1.2 Update `WalletManager` to add `initialize()` method
- [ ] 1.3 Update `Supervisor` to await `walletManager.initialize()` on startup

## 2. Dynamic Gas
- [ ] 2.1 Update `MempoolDetector` to capture Gas Details from pending tx
- [ ] 2.2 Update `CopyTradingExecutionService` interface to accept Gas Overrides
- [ ] 2.3 Implement Gas Boosting logic in Supervisor's `handleSniffedTx`

## 3. Smart Slippage
- [ ] 3.1 Implement `calculateDynamicSlippage` in `CopyTradingExecutionService`
- [ ] 3.2 Integrate into `executeJobInternal`
