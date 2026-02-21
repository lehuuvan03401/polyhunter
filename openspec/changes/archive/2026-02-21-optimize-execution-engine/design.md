# Design: Execution Engine Upgrade

## 1. WalletManager Async Init
Cannot authorize 20 wallets in the constructor (sync).
We introduce a robust initialization pattern:

```typescript
// WalletManager
public async initialize() {
    await Promise.all(this.workers.map(w => w.tradingService.initialize()));
}
```

Caller (`Supervisor`) must await this before starting operations.

## 2. Dynamic Gas (Front-Running)
Mempool Detector callback signature update:
`callback(txHash, ..., gasInfo: { maxFee: string, priority: string })`

Execution Service `executeOrderWithProxy` update:
Accept `overrides: ethers.Overrides` for the on-chain transaction (Proxy Transfer / Execute).

Logic:
If `isPreflight` (Mempool):
   `myGas = targetGas * 1.15` (15% bump to jump queue)

## 3. Smart Slippage
Formula:
1. Get Orderbook (Asks for Buy, Bids for Sell).
2. Walk the book until `cumulativeSize >= mySize`.
3. `effectivePrice` = Weighted Average Price of consumed levels.
4. `impact` = `|effectivePrice - bestPrice| / bestPrice`.
5. `slippage` = `impact + safetyBuffer (0.5%)`.

Limit `slippage` to `maxSlippage` config.
