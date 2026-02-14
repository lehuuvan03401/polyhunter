# Task Plan: Hybrid Signal Ingestion (add-hybrid-signal-ingestion)

## Goal
Add a production-safe hybrid ingestion pipeline (`WS + polling`) for copy-trading so the system can align with upstream polling changes without losing low-latency capability.

## Current Phase
Phase 2: Verification (in_progress)

## Phases

### Phase 1: Implementation
- [x] 1.1 Add `COPY_TRADING_SIGNAL_MODE` (`WS_ONLY|POLLING_ONLY|HYBRID`, default `HYBRID`)
- [x] 1.2 Implement polling signal source with incremental cursor fetching
- [x] 1.3 Persist polling cursor and load on startup
- [x] 1.4 Apply channel-agnostic dedup across WS + polling
- [x] 1.5 Add signal health metrics (`poll_lag_ms`, `ws_last_event_age_ms`, `source_mismatch_rate`)
- [x] 1.6 Add WS unhealthy degrade behavior in `HYBRID` mode

### Phase 2: Verification
- [ ] 2.1 Verify `POLLING_ONLY` captures and executes signals end-to-end
- [ ] 2.2 Verify `HYBRID` does not duplicate execution
- [ ] 2.3 Simulate WS outage and confirm polling continuity
- [ ] 2.4 Restart supervisor and confirm cursor resume behavior

### Phase 3: Docs & Wrap-up
- [x] 3.1 Update runbook with mode selection and troubleshooting
- [x] 3.2 Document upstream sync migration/rollback steps
- [x] 3.3 Update OpenSpec tasks checklist and progress logs

## Decisions
| Decision | Rationale |
|---|---|
| Default mode is `HYBRID` | Preserves low latency while ensuring reliability via polling |
| Cursor is persisted per trader scope | Safer restart behavior and avoids full replay |
| Dedup key remains tx-centric (`txHash + logIndex` preferred) | Keeps cross-channel idempotency deterministic |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| None yet for this phase | - | - |
