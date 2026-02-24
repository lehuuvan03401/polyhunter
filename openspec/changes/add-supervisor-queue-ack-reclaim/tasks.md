## 1. Implementation
- [x] 1.1 Replace queue `dequeue` API with `claim/ack/nack` lifecycle.
- [x] 1.2 Add Redis processing lease storage and stale-claim reclaim loop.
- [x] 1.3 Requeue unacked stale claims with incremented attempt marker.
- [x] 1.4 Expose reclaimed queue counters in operational metrics.

## 2. Verification
- [x] 2.1 Run web type-check.
- [x] 2.2 Validate OpenSpec change with strict mode.
