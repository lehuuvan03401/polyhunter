# Verification: optimize-copy-execution-throughput

## 2.1 Mutex Scope vs CLOB Parallelism
- [ ] Run parallel proxy executions with shared signer; confirm CLOB orders place without signer mutex blocking.

## 2.2 Async Settlement Queue
- [ ] Enable `COPY_TRADING_ASYNC_SETTLEMENT=true` and execute a BUY/SELL.
- [ ] Confirm `SETTLEMENT_PENDING` records are created.
- [ ] Confirm recovery loop settles and flips to `EXECUTED`.

## 2.3 Settlement Retry + Logging
- [ ] Force a settlement failure (e.g., insufficient proxy funds) and verify retryCount/nextRetryAt increments.
- [ ] Confirm metrics log queue depth/lag/retry counts.

## Notes
- Pending execution; needs dry-run or fork environment with funded proxy/worker.
