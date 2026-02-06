## 1. Implementation
- [x] 1.1 Add supervisor env `SUPERVISOR_WORKER_POOL_SIZE` (override default 20).
- [x] 1.2 Add incremental config refresh using `updatedAt` cursor and per-config cache.
- [x] 1.3 Add periodic full refresh (e.g., every N minutes) to reconcile deletions/disablements.
- [x] 1.4 Add metrics for config cache size, last refresh time, and refresh duration.
- [x] 1.5 Update runbook with new capacity controls and sizing guidance.
- [x] 1.6 Add indexes on `CopyTradingConfig(updatedAt, isActive, autoExecute, channel)` if needed.

## 2. Verification
- [x] 2.1 Verify worker pool size change affects available workers (log shows pool size).
- [x] 2.2 Verify incremental refresh applies new configs without full-table scan.
- [x] 2.3 Verify periodic full refresh removes disabled configs.

## 3. Docs
- [x] 3.1 Document sizing guidelines for 10k user baseline and latency targets.
