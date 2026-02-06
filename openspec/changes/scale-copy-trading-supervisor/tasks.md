## 1. Implementation
- [x] Add address-filtered WS subscriptions for monitored traders (fallback to all-activity only when filter unsupported).
- [x] Introduce bounded concurrency for subscriber fan-out (configurable worker pool or p-limit).
- [x] Implement durable execution queue with backpressure + drop metrics.
- [x] Replace in-memory dedup with shared store (txHash + logIndex key, TTL).
- [x] Add market metadata cache + prefetch for active configs.
- [x] Implement guardrail counters using cached/aggregated store (global/wallet/market/window).
- [x] Add sharding/ownership strategy for multi-instance supervisors (avoid duplicate processing).
- [x] Add metrics for queue depth, lag, drops, and dedup hit rate.

## 2. Verification
- [x] Load test with large subscriber sets and high event rate; record throughput/latency.
- [x] Validate no duplicate executions across two supervisor instances.
- [x] Validate backpressure behavior when queue is saturated.

## 3. Docs
- [x] Update runbook with scaling topology, shared store requirements, and tuning knobs.
