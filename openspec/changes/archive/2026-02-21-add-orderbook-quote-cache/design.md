## Context
Worker price fetches hit the orderbook for each signal. Under bursts, multiple signals target the same token and side, causing redundant fetches and extra latency.

## Goals / Non-Goals
- Goals:
  - Reduce redundant orderbook fetches within a short window.
  - Maintain strict price TTL (<= 5s) and slippage checks.
- Non-Goals:
  - Change execution pricing logic or slippage strategy.

## Decisions
- Decision: Add a small in-memory cache keyed by tokenId+side and a map of in-flight promises.
- Alternatives considered:
  - Shared LRU across processes (requires external store; heavier ops).

## Risks / Trade-offs
- Slight risk of using a quote close to TTL boundary; guard with timestamp.
- Increased memory usage is minimal.

## Migration Plan
- Implement cache + dedupe in worker, confirm TTL compliance.

## Open Questions
- Should cache be shared across worker processes? (likely no)
