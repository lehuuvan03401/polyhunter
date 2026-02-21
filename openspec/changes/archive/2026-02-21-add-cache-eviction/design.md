## Context
Worker caches are in-memory and currently unbounded. Over long-running processes, entries may grow without limit.

## Goals / Non-Goals
- Goals:
  - Bound cache size and remove stale entries.
  - Keep cache behavior fast and safe.
- Non-Goals:
  - Introduce external caching services.

## Decisions
- Decision: Add size limits (e.g., max entries) and periodic TTL pruning.
- Alternatives considered:
  - LRU library (adds dependency).

## Risks / Trade-offs
- Eviction could reduce cache hit rate under heavy load; acceptable for memory stability.

## Migration Plan
- Implement prune/size limits in worker caches.

## Open Questions
- What should the max cache size be per cache?
