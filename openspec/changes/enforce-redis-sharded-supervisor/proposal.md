# Change: Enforce Redis as a hard dependency for sharded supervisors

## Why
When `SUPERVISOR_SHARD_COUNT>1`, falling back to in-memory queue/dedup/counters creates cross-instance inconsistency and duplicate execution risk.

## What Changes
- Require Redis configuration when running in sharded mode.
- Fail fast during startup if Redis URL is missing in sharded mode.
- Fail fast during startup if Redis connectivity cannot be established in sharded mode.
- Keep in-memory fallback only for single-instance mode (`SUPERVISOR_SHARD_COUNT<=1`).

## Impact
- Affected specs: `copy-trading`
- Affected code: `web/scripts/workers/copy-trading-supervisor.ts`
