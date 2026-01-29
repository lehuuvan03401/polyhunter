# Change: Optimize portfolio copy-trading API performance

## Why
Local development shows multi‑minute response times and high CPU usage due to repeated heavy API calls, external price lookups, and unindexed database queries. We need predictable, responsive endpoints under polling without sacrificing correctness.

## What Changes
- Add short‑lived server‑side caches for expensive copy‑trading portfolio endpoints.
- Reduce external price/resolution lookups via batching and reuse within TTL.
- Optimize database access patterns and add indexes for common filters.
- Adjust portfolio UI polling to be adaptive and less aggressive while keeping data fresh.

## Impact
- Affected specs: portfolio-api, portfolio-ui
- Affected code: copy-trading portfolio API routes, polling hooks/components, Prisma schema/migrations
- No breaking API payload changes (behavioral performance improvements only).
