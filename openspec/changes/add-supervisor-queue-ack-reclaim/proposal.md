# Change: Add acked supervisor queue consumption with lease reclaim

## Why
Supervisor queue currently uses pop-and-fire semantics, which can lose jobs if a process crashes after dequeue but before execution completes. Multi-instance production needs at-least-once delivery behavior with explicit acknowledgment and stale-claim recovery.

## What Changes
- Upgrade queue abstraction from dequeue-only to `claim/ack/nack` semantics.
- Add Redis processing lease tracking and periodic reclaim of stale claims.
- Add memory-store parity for claim/ack/nack behavior in non-Redis mode.
- Include reclaimed-lease counters in supervisor queue metrics.

## Impact
- Affected specs: `copy-trading`
- Affected code:
  - `web/scripts/workers/copy-trading-supervisor.ts`
