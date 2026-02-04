# Verification Scripts

## Copy Trading Readiness
Runs a non-interactive readiness check for real-money copy trading execution.

```bash
npx tsx scripts/verify/copy-trading-readiness.ts
```

Environment prerequisites:
- `TRADING_PRIVATE_KEY`
- `CHAIN_ID` (optional, default 137)
- `COPY_TRADING_RPC_URLS` or `COPY_TRADING_RPC_URL` / `NEXT_PUBLIC_RPC_URL`
- `ENABLE_REAL_TRADING`
- `COPY_TRADING_EXECUTION_ALLOWLIST` (optional)
- `COPY_TRADING_MAX_TRADE_USD` (optional)

The script verifies:
- RPC health + failover selection
- Wallet availability
- Proxy existence
- Proxy USDC balance
- USDC allowance + CTF approval to executor
- Guardrail flags (enable + allowlist + max trade cap)

Exit code:
- 0 if ready
- 1 if any prerequisite fails

## Copy Trade Prewrite Verification
Validates prewrite-before-execute idempotency and stale PENDING expiry handling.

Read-only mode (default):
```bash
npx tsx scripts/verify/copy-trade-prewrite.ts
```

Write verification (creates + cleans up test rows):
```bash
VERIFY_CONFIG_ID=<copy_trading_config_id> \
VERIFY_PREWRITE_WRITE=true \
DATABASE_URL=<db_url> \
npx tsx scripts/verify/copy-trade-prewrite.ts
```
