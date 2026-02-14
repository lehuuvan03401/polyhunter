## 1. Implementation
- [x] 1.1 Add `COPY_TRADING_SIGNAL_MODE` env with values `WS_ONLY|POLLING_ONLY|HYBRID` (default `HYBRID`).
- [x] 1.2 Implement polling signal source with cursor-based incremental fetching.
- [x] 1.3 Add persistent cursor storage and recovery path on startup.
- [x] 1.4 Integrate channel-agnostic dedup keying across WS and polling signals.
- [x] 1.5 Add channel health metrics (`poll_lag_ms`, `ws_last_event_age_ms`, `source_mismatch_rate`).
- [x] 1.6 Add safety degrade logic: when WS unhealthy, automatically rely on polling source.

## 2. Verification
- [ ] 2.1 Validate `POLLING_ONLY` mode captures and executes copy signals end-to-end.
- [ ] 2.2 Validate `HYBRID` mode does not duplicate execution under dual signal arrival.
- [ ] 2.3 Simulate WS outage and verify fallback to polling without manual restart.
- [ ] 2.4 Restart supervisor and verify cursor resumes without replay storm or missed window.

## 3. Documentation
- [x] 3.1 Update runbook with mode selection, failover behavior, and troubleshooting.
- [x] 3.2 Add migration note for upstream sync compatibility and rollback procedure.
