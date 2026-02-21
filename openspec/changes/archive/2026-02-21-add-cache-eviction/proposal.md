# Change: Add Bounded Cache Eviction for Worker In-Memory Caches

## Why
The worker now maintains multiple in-memory caches (quote cache, preflight cache, proxy cache). Without bounds, these can grow over long runtimes and lead to memory pressure. Adding bounded eviction keeps memory stable while preserving performance benefits.

## What Changes
- Add size limits and TTL-based eviction for quote and preflight caches.
- Periodically prune expired entries on the metrics interval.
- Keep cache behavior safe (never used for execution-time funds).

## Impact
- Affected specs: `copy-trading`
- Affected code: `scripts/copy-trading-worker.ts`
