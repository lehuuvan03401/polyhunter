## Context
Copy trading uses a single hot key (TRADING_PRIVATE_KEY). As throughput grows, we need multiple workers and per-worker isolation to reduce nonce collisions and limit blast radius.

## Goals / Non-Goals
- Goals:
  - Support multiple worker keys for real execution.
  - Provide deterministic worker selection (by config or shard).
  - Track which worker executed a trade.
- Non-Goals:
  - UI for worker management.

## Decisions
- Decision: Use env `COPY_TRADING_WORKER_KEYS` (comma-separated) and optional `COPY_TRADING_WORKER_INDEX` override.
- Decision: Persist `executedBy` (worker address) on CopyTrade.

## Risks / Trade-offs
- Requires schema change for executedBy.

## Migration Plan
1) Add `executedBy` column.
2) Update worker to select worker key and persist.
