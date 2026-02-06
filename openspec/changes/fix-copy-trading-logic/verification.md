# Verification: Fix Copy Trading Logic (EOA/Proxy)

## 2026-02-06 — Local execution path check (mocked CLOB)

**Command**
```bash
TRADING_PRIVATE_KEY=<from env> \
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
CHAIN_ID=1337 \
VERIFY_TOKEN_ID=mock-token-exec-path-1234567890 \
VERIFY_PROXY_ADDRESS=0x0000000000000000000000000000000000000001 \
npx tsx scripts/verify/copy-trading-execution-paths.ts
```

**Notes**
- `CHAIN_ID=1337` triggers `TradingService` localhost mocks (no live CLOB orders).
- `VERIFY_TOKEN_ID` uses the mock-token bypass in `CopyTradingExecutionService` for Proxy mode (skips on-chain transfers).

**EOA Path Result**
- `TradingService` address matched decrypted EOA wallet address.
- `createMarketOrder` returned mock success.

**Proxy Path Result**
- `executeOrderWithProxy` ran via fleet wallet and returned mock success via localhost bypass.

**Observed Output (abridged)**
```
[EOA] Wallet address: 0x90F79bf6EB2c4f870365E785982E1f101E93b906
[EOA] TradingService address: 0x90F79bf6EB2c4f870365E785982E1f101E93b906
[EOA] Address match: true
[EOA] createMarketOrder result: { success: true, ... }
[Proxy] Fleet wallet address: 0x90F79bf6EB2c4f870365E785982E1f101E93b906
[CopyExec] ⚠️ Mock Token Detected. Skipping.
[Proxy] executeOrderWithProxy result: { success: true, ... }
```
