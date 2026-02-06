## 1. Implementation
- [ ] Add address-filtered WS subscriptions for monitored traders (fallback to all-activity only when filter unsupported).
- [ ] Introduce bounded concurrency for subscriber fan-out (configurable worker pool or p-limit).
- [ ] Implement durable execution queue with backpressure + drop metrics.
- [ ] Replace in-memory dedup with shared store (txHash + logIndex key, TTL).
- [ ] Add market metadata cache + prefetch for active configs.
- [ ] Implement guardrail counters using cached/aggregated store (global/wallet/market/window).
- [ ] Add sharding/ownership strategy for multi-instance supervisors (avoid duplicate processing).
- [ ] Add metrics for queue depth, lag, drops, and dedup hit rate.

## 2. Verification
- [ ] Load test with large subscriber sets and high event rate; record throughput/latency.
- [ ] Validate no duplicate executions across two supervisor instances.
- [ ] Validate backpressure behavior when queue is saturated.

## 3. Docs
- [ ] Update runbook with scaling topology, shared store requirements, and tuning knobs.
