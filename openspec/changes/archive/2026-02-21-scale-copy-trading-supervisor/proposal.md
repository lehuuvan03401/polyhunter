# Change: Scale Copy Trading Supervisor

## Why
Current supervisor execution is optimized for small/medium workloads but will bottleneck under large subscriber fan-out, high event volume, and multi-instance deployments. We need explicit scalability guarantees (bounded concurrency, durable queues, shared dedup, and efficient guardrail accounting) to support large numbers of users and copy trades.

## What Changes
- Add bounded parallel dispatch for subscriber fan-out (avoid sequential execution).
- Introduce durable execution queue + backpressure with metrics for overload scenarios.
- Replace in-memory txHash-only dedup with shared dedup keys (txHash + logIndex).
- Add address-filtered WS subscriptions and metadata caching/prefetch.
- Move guardrail counters to cached/aggregated storage for O(1) checks.
- Add sharding/ownership strategy for multi-instance supervisors to prevent double-processing.

## Impact
- Affected specs: `copy-trading`, `storage`
- Affected code: `frontend/scripts/copy-trading-supervisor.ts`, queue/dedup utilities, guardrail accounting, metrics/logging, runbooks
