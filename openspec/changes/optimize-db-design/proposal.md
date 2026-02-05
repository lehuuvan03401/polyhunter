# Change: Optimize Database Design and Hot-Path Performance

## Why
CopyTrade/CommissionLog remain high-volume tables. Recent work (async prewrite + archiving) improved latency and storage growth, but hot queries still lack composite indexes and recovery loops can double-process across multiple workers. Config refresh still polls the DB regularly, so read load will grow with user count. We need a prioritized, low-risk DB optimization roadmap.

## What Changes
**P0 (Immediate, low risk)**
- Add targeted composite indexes for CopyTrade time-window queries (pending expiry, retry scheduling, executed totals) and CommissionLog time-window lookups.
- Align hot queries with new indexes and verify query plans.

**P1 (Medium risk)**
- Add row-claiming/locking for recovery and retry loops via `lockedAt/lockedBy` fields to prevent multi-worker double-processing.

**P2 (Longer-term)**
- Add post-archive maintenance (VACUUM/ANALYZE) to keep planner stats fresh after bulk deletes.
- **Deferred:** External cache adapter (Redis) for active configs (not in this proposal).

## Impact
- **Affected specs:** storage, copy-trading
- **Affected code:** `frontend/prisma/schema.prisma`, migrations, `scripts/copy-trading-worker.ts`, `scripts/archive-data.ts`, cache adapter configuration
- **Risk:** Schema migration (new indexes/columns), recovery logic changes, optional dependency on Redis
