# Task Plan: Scale Copy Trading Supervisor Implementation
<!--
  WHAT: Implement scaling improvements for copy-trading supervisor.
  WHY: Support large user volume and high fan-out with multi-instance safety.
-->

## Goal
Ship scaling improvements in `frontend/scripts/copy-trading-supervisor.ts` plus runbook updates.

## Current Phase
Complete

## Phases

### Phase 1: Implementation
- [x] Add address-filtered WS subscription (fallback to all-activity when needed)
- [x] Add bounded fan-out concurrency for subscriber dispatch
- [x] Add durable queue + backpressure with drop metrics
- [x] Add shared dedup store (txHash + logIndex)
- [x] Add market metadata cache + prefetch
- [x] Add guardrail counters cache + post-exec increments
- [x] Add sharded ownership to avoid duplicate processing
- [x] Add queue/dedup metrics and queue drain loop
- [x] Add Redis optional shared stores + shutdown cleanup
- [x] Update runbook with scaling knobs
- **Status:** complete

### Phase 2: Verification
- [x] Dry-run sanity check (single instance + mock/local)
- [x] Multi-instance smoke (shared Redis + shard split)
- [x] Queue backpressure test (force saturation)
- [x] Real-event dual supervisor dedup test
- **Status:** complete

### Phase 3: Load Modeling
- [x] Model capacity for 10k users / 10 follows / 5k trades per user per day
- [x] Run synthetic load simulation and record throughput/latency
- [x] Update verification + tasks to reflect load test results
- **Status:** complete

## Key Questions
1. Do we need strict limits on WS address filter size?
2. Should Redis be mandated in prod, or optional with warnings?

## Decisions Made
| Decision | Rationale |
|---|---|
| Use Redis when available; fallback to memory | Keeps local/dev simple while enabling shared stores for prod |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| session-catchup failed (/scripts/session-catchup.py not found) | 5 | Proceeded without catchup; updated plan manually |
| PrismaClientInitializationError in queue-backpressure script | 1 | Switched to `frontend/lib/prisma` adapter-backed client |
