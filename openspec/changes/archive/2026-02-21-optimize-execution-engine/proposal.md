# Optimization: Execution Engine Upgrade

## 1. Problem
The current execution engine has three critical limitations that hinder production readiness:
1.  **Worker Initialization Bug**: `WalletManager` creates `TradingService` instances for workers but never calls `.initialize()`. Workers lack API keys and L2 clients, causing order failures.
2.  **Static Gas Strategy**: Mempool sniping uses default gas prices, preventing effective "Front-running".
3.  **Static Slippage**: Fixed % slippage is unsafe for illiquid markets or wasteful for liquid ones.

## 2. Solution
We will upgrade the execution engine to be fully autonomous and competitive.

### 2.1 Worker Lifecycle Management
- Modify `WalletManager` to implement an async `initializeFleet()` method.
- Ensure each worker's `TradingService` derives/creates its own CLOB API keys upon startup.

### 2.2 Dynamic Gas Strategy (EIP-1559)
- Update `MempoolDetector` to capture the `maxFeePerGas` and `maxPriorityFeePerGas` of the target transaction.
- Update `CopyTradingExecutionService` to accept gas overrides.
- Implement "Front-run Logic": `TargetGas * 1.1`.

### 2.3 Smart Slippage
- Implement `calculateDynamicSlippage` in `CopyTradingExecutionService`.
- Fetch Orderbook depth before placing large orders.

## 3. Impact
- **Reliability**: Workers actually function.
- **Speed**: Sniping success rate increases significantly due to competitive gas.
- **Safety**: Reduced risk of bad fills or failed large orders.
