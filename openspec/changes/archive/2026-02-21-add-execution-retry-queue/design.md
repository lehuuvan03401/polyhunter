## Context
Execution failures can be transient. Today failures are final unless manual intervention occurs.

## Goals / Non-Goals
- Goals:
  - Retry transient failures with backoff.
  - Avoid duplicate executions with idempotency key.
- Non-Goals:
  - Complex job scheduling system.

## Decisions
- Decision: Use a lightweight in-DB retry state on CopyTrade (attempt count, nextAttemptAt).
- Decision: Retry only for a defined error allowlist.

## Risks / Trade-offs
- Requires schema change for retry state.

## Migration Plan
1) Add retry fields to CopyTrade.
2) Update worker recovery loop to process retries.
