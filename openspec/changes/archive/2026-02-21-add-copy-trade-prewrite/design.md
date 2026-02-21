## Context
The worker uses fast-track execution to reduce latency, which can start execution before the CopyTrade record is persisted. This can produce orphan orders and complicate recovery, idempotency, and auditability.

## Goals / Non-Goals
- Goals:
  - Guarantee a durable CopyTrade record exists before any execution.
  - Preserve low-latency behavior while eliminating orphan executions.
  - Keep schema changes minimal or avoid them entirely.
- Non-Goals:
  - Redesign the entire retry/settlement system.
  - Introduce new external dependencies or queues.

## Decisions
- Decision: Prewrite CopyTrade (PENDING) before execution and use DB unique constraints to enforce idempotency.
- Alternatives considered:
  - Distributed locks/queues (adds complexity and operational burden).
  - Client-side in-memory dedup only (not durable across restarts).

## Risks / Trade-offs
- Slight latency increase from prewrite DB call before execution.
- PENDING records may accumulate if execution crashes; mitigated with stale-PENDING recovery.

## Migration Plan
- No schema change required.
- Rollout: deploy worker changes, monitor PENDING backlog, and adjust TTLs as needed.

## Open Questions
- What TTL should mark PENDING as stale for recovery?
- Should stale PENDING be retried or marked FAILED with a specific reason?
