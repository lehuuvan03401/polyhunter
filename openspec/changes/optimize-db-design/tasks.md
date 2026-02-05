# Tasks: Optimize Database Design

## P0: Hot-Path Indexes & Query Alignment
- [x] Audit CopyTrade/CommissionLog query patterns (worker + API) and map to indexes. <!-- id: 1 -->
- [x] Add composite indexes in `frontend/prisma/schema.prisma` for status/time-window scans. <!-- id: 2 -->
- [x] Generate migration + ensure index names are stable. <!-- id: 3 -->
- [x] Update hot queries (if needed) to align with index ordering. <!-- id: 4 -->
- [x] Capture before/after EXPLAIN notes (optional if env available). <!-- id: 5 -->

## P1: Recovery Claiming / Locking
- [x] Choose locking strategy: `lockedAt/lockedBy` fields. <!-- id: 6 -->
- [x] Add `lockedAt`/`lockedBy` columns to CopyTrade and migrate. <!-- id: 7 -->
- [x] Implement row-claiming for `recoverPendingTrades`, `retryFailedTrades`, and expiry scans. <!-- id: 8 -->
- [x] Add safety TTL handling for claimed rows. <!-- id: 9 -->
- [x] Add verification notes for multi-worker behavior. <!-- id: 10 -->

## P2: Cache + Maintenance
- [ ] Add post-archive maintenance step (VACUUM/ANALYZE) or ops runbook update. <!-- id: 11 -->
- [ ] Document deferred Redis cache adapter for future proposal. <!-- id: 12 -->
