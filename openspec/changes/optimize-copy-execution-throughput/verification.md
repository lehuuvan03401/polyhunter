# Verification: optimize-copy-execution-throughput

## 2.1 Mutex Scope vs CLOB Parallelism
- [x] Run parallel proxy executions with shared signer; confirm CLOB orders place without signer mutex blocking.
- **Evidence:** `npx tsx scripts/verify/parallel-order-placement.ts`
  - Output: `Parallel order placement observed (maxConcurrent=2).`

## 2.2 Async Settlement Queue
- [x] Enable `COPY_TRADING_ASYNC_SETTLEMENT=true` and execute a BUY/SELL.
- [x] Confirm `SETTLEMENT_PENDING` records are created.
- [x] Confirm recovery loop settles and flips to `EXECUTED`.
- **Evidence:** `npx tsx scripts/verify/async-settlement-flow.ts`
  - Output includes: `Deferring settlement`, `Created SETTLEMENT_PENDING trade ...`, `Settlement recovered ... marked EXECUTED`.

## 2.3 Settlement Retry + Logging
- [ ] Force a settlement failure (e.g., insufficient proxy funds) and verify retryCount/nextRetryAt increments.
- [x] Confirm metrics log queue depth/lag/retry counts.
- **Evidence:** `COPY_TRADING_ASYNC_SETTLEMENT=true COPY_TRADING_METRICS_INTERVAL_MS=2000 COPY_TRADING_DRY_RUN=true npx tsx scripts/copy-trading-worker.ts`
  - Metrics output included `Settlement Queue: depth=0`.

## Notes
- Pending execution; needs dry-run or fork environment with funded proxy/worker.
