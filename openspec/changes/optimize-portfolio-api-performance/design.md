## Context
The portfolio UI polls multiple copy‑trading endpoints. Each request performs external price/resolution lookups (CLOB + Gamma) and multiple database scans, causing slow responses and high CPU usage in dev and production.

## Goals / Non-Goals
- Goals:
  - Keep portfolio endpoints responsive under polling by caching and batching.
  - Avoid repeated external requests within a short TTL window.
  - Reduce database scan cost with targeted indexes and query shaping.
- Non-Goals:
  - Changing response schemas or introducing new dependencies.
  - Full async background job architecture (out of scope).

## Decisions
- Use lightweight in‑memory TTL caches for:
  - Endpoint responses keyed by wallet + query params (TTL 15–30s).
  - External price/resolution lookups keyed by tokenId/slug (TTL 10–30s).
- Batch external requests with bounded concurrency to avoid burst overload.
- Add Prisma indexes for hot query paths (CopyTrade configId + status + detectedAt, tokenId, originalSide/originalTrader/originalPrice).
- Adjust UI polling intervals to reduce concurrent load (slow endpoints no more frequent than 15s) and allow manual refresh.

## Risks / Trade-offs
- In‑memory caches are per server instance and reset on restart (acceptable for dev/local).
- Short‑lived cache means data may be up to 30s stale; mitigated by manual refresh and TTL tuning.

## Migration Plan
1. Add indexes via Prisma migration.
2. Add cache helpers and apply to portfolio endpoints.
3. Update UI polling intervals/adaptive refresh.
4. Verify with local load test (repeat polling and observe response time improvements).

## Open Questions
- Should we later persist cache in Redis for multi‑instance production?
