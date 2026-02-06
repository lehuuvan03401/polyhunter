## Context
Supervisor capacity is bounded by a fixed worker pool size (20) and config refresh performs a full-table scan every interval. With 10k users and high-frequency copying, we need explicit capacity controls and reduced DB load.

## Goals / Non-Goals
- Goals:
  - Make worker pool size configurable per instance.
  - Reduce DB load via incremental refresh based on `updatedAt`.
  - Keep cache correctness with periodic full reconciliation.
- Non-Goals:
  - Re-architecting to a separate orchestration service.
  - Introducing Kafka or a new streaming layer.

## Decisions
- Decision: Add `SUPERVISOR_WORKER_POOL_SIZE` env; default remains 20.
  - Rationale: Allows tuning throughput without code changes.
- Decision: Use incremental refresh with `updatedAt` cursor plus periodic full refresh.
  - Rationale: Handles adds/updates cheaply and avoids stale deletes by periodic reconciliation.

## Risks / Trade-offs
- Incremental refresh can miss deletes until the next full refresh; mitigate with a bounded reconciliation interval.
- Larger worker pools increase RPC/CLOB pressure; mitigation via rate limiting and sharding.

## Migration Plan
1. Deploy code with new env + incremental refresh.
2. Roll out `SUPERVISOR_WORKER_POOL_SIZE` gradually and monitor latency + error rates.
3. Enable periodic full refresh and observe config cache metrics.

## Open Questions
- What is the acceptable max staleness window for config disablement?
- Should config refresh move to a shared cache (Redis) in a future change?
