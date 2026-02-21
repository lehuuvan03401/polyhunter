## Context
Copy trading currently uses a single RPC URL (configurable). Any RPC outage or rate limit impacts execution. We need multi-RPC selection with health checks.

## Goals / Non-Goals
- Goals:
  - Support a primary RPC and one or more fallback RPC URLs.
  - Detect unhealthy RPCs and automatically switch.
  - Log the active RPC and failover events.
- Non-Goals:
  - Provider-specific optimizations beyond URL failover.

## Decisions
- Decision: Introduce `COPY_TRADING_RPC_URLS` (comma-separated) as the primary list. First entry is primary.
- Decision: Health check via lightweight `eth_blockNumber` with timeout.
- Decision: Cache active RPC for a short TTL and re-check on failures.

## Risks / Trade-offs
- Additional latency during failover; mitigated by pre-checks at startup and short timeouts.

## Migration Plan
No schema changes required.
