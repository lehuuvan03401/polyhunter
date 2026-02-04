# Verification Notes: Cache Eviction

## Manual Checks
- TTL prune:
  - Wait longer than TTL and observe cache prune logs in metrics interval.

- Size eviction:
  - Generate > max entries for quote/preflight caches.
  - Expect logs showing eviction and cache size capped.

## Expected Outcome
- Cache sizes stay within configured bounds.
- Expired entries are removed during metrics interval.
