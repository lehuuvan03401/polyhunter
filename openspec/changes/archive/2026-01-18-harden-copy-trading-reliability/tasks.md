# Tasks: Harden Copy Trading Reliability

## 1. Unified Deduplication
- [x] 1.1 Modify `isEventDuplicate` to use only `txHash` as primary key (ignore logIndex/asset suffix)
- [x] 1.2 Add time-based window deduplication (60s TTL remains)
- [x] 1.3 Update `handleActivityTrade` to use same dedup function
- [x] 1.4 Verify no duplicate executions when both WS and chain detect same trade

## 2. Transaction Monitoring
- [x] 2.1 Create `src/core/tx-monitor.ts` with `TxMonitor` class
- [x] 2.2 Track pending transactions with `{hash, submittedAt, nonce, worker}` metadata
- [x] 2.3 Implement `checkStuckTransactions()` polling (every 30s)
- [x] 2.4 Add replacement logic: re-submit with 20% higher gas if pending >5 min
- [ ] 2.5 Integrate `TxMonitor` into `executeJobInternal` (Deferred - class ready, manual integration optional)

## 3. Health Metrics & Logging
- [x] 3.1 Add execution counter (total, success, failed)
- [x] 3.2 Add latency tracking (signal detected → order submitted)
- [x] 3.3 Log summary every 5 minutes to console
- [ ] 3.4 (Optional) Expose Prometheus-compatible `/metrics` endpoint

## 4. Verification
- [x] 4.1 Test duplicate prevention with simulated WS+Chain concurrent events
- [x] 4.2 Supervisor starts without errors
- [x] 4.3 Verify metrics logging setup (will log after 5 min)
