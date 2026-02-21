# Verification Notes: Orderbook Quote Cache

## Manual Checks
- Single token burst:
  - Trigger multiple signals for the same token+side within 5s.
  - Expect log: `Quote Cache: hits>0` and minimal orderbook fetches.

- In-flight dedupe:
  - Fire two concurrent signals for same token+side.
  - Expect second request to reuse in-flight promise (log `inflight` count > 0).

## Expected Outcome
- Cache hits increase under burst load.
- Orderbook fetches reduced without violating TTL (<= 5s).
