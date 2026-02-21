# Design: Scale Copy Trading Supervisor

## Goals
- Sustain high subscriber fan-out without blocking the event loop.
- Avoid duplicate processing across multiple supervisor instances.
- Reduce per-trade DB work in guardrail checks and metadata lookups.
- Preserve safety guarantees (guardrails, dedup, backpressure).

## Proposed Architecture

### 1) Event Ingestion
- Prefer address-filtered WS subscriptions (monitored trader set).
- Keep chain event listener as fallback/verification.
- Mempool remains optional and gated.

### 2) Dispatch & Concurrency
- Replace sequential per-subscriber processing with bounded concurrency.
- Use a configurable concurrency limit per trader and global cap.
- Emit queue depth and dispatch lag metrics.

### 3) Durable Execution Queue
- Introduce a persistent queue (Redis or DB) for jobs when workers are saturated.
- Apply backpressure: reject or defer jobs when queue is full.
- Track drop counts and latency from enqueue → execute.

### 4) Shared Dedup Store
- Use key `(txHash + logIndex)` when available; fallback to `(txHash + tokenId + side)`.
- Store dedup keys in shared store with TTL (>= 60s) to prevent cross-instance duplicates.

### 5) Guardrail Counters
- Move global/wallet/market/window counters to a cached store.
- Periodically reconcile counts to DB for accuracy.

### 6) Sharding / Ownership
- Use a deterministic shard key (traderAddress hash) so only one instance processes a trader’s events.
- If shard ownership changes (deployment), allow brief overlap but dedup store prevents double execution.

## Implementation Notes
- Redis is recommended for shared dedup + counters + queue. If unavailable, fall back to DB with reduced performance.
- Metrics should include queue depth, enqueue latency, drop rate, dedup hit rate, and p95 execution latency.
