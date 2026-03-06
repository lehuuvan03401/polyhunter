## Context

The current authority runtime already handles `SETTLEMENT_PENDING` recovery, but several resilience features are still split across older workers or documents:
- stale `PENDING` expiration exists in older runtime code, not the current authority flow
- `ReimbursementLedger` exists in schema but is not owned by the `web` supervisor path
- market resolution / redemption is still tied to the legacy worker
- guardrails use executed usage snapshots without reservation-safe concurrency

## Goals / Non-Goals

- Goals:
  - close recovery gaps in the authority runtime
  - make deferred reimbursement durable and retryable
  - prevent cap overruns under burst fanout
- Non-Goals:
  - redesigning signal ingestion
  - replacing existing debt recovery semantics

## Decisions

- Decision: Supervisor owns all retry/recovery loops for automated copy-trading.
  - Rationale: it already owns queueing, metrics, and settlement recovery coordination.

- Decision: Deferred reimbursement must be persisted before worker release.
  - Rationale: otherwise a restart loses the reimbursement obligation.

- Decision: Guardrails need reservations, not just post-success counters.
  - Rationale: concurrent reads of the same used-cap state can oversubscribe limits.

## Risks / Trade-offs

- Risk: reservations can leak on crashes.
  - Mitigation: use TTL-based reservations plus periodic cleanup/reconciliation.

- Risk: moving market resolution into supervisor increases runtime surface area.
  - Mitigation: isolate into dedicated loops and metrics, with feature flags during rollout.

## Migration Plan

1. Add stale pending expiration and ledger persistence.
2. Add supervisor ledger flush loop.
3. Add market-resolution ownership.
4. Add reservation model and metrics.

## Open Questions

- Whether reservation state should live purely in Redis, or in DB for stronger crash recovery.
