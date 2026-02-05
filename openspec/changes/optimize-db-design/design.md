# Design Notes: Optimize Database Design

## P0: Hot-Path Indexing
**Primary query patterns (worker):**
- Expire stale PENDING: `status = 'PENDING' AND expiresAt < now`
- Retry failed: `status = 'FAILED' AND nextRetryAt <= now AND retryCount < N`
- Guardrail totals: `status IN ('EXECUTED','SETTLEMENT_PENDING') AND executedAt >= since` (optionally filtered by marketSlug)

**Index candidates (CopyTrade):**
- `(status, expiresAt)`
- `(status, nextRetryAt)`
- `(status, executedAt)`
- `(marketSlug, executedAt)` if market-level guardrail scans are common

**Index candidates (CommissionLog):**
- `(createdAt)` already indexed; confirm `referrerId + createdAt` if per-referrer time windows are common.

**Notes:**
- Consider partial indexes for status-specific scans to reduce bloat; this requires raw SQL migration.
- Verify with `EXPLAIN ANALYZE` before/after and keep index count minimal to avoid write amplification.

## P1: Recovery Claiming / Locking
**Goal:** avoid double-processing when multiple workers scan the same rows.

**Selected Approach (schema-based):**
- Add `lockedAt`, `lockedBy` columns on CopyTrade.
- Claim rows via `updateMany` with `(lockedAt IS NULL OR lockedAt < now - ttl)` and `status` filters, then fetch by `lockedBy`.
- Requires careful TTL handling and cleanup on crash.

## P2: Cache + Maintenance
**Config cache:**
- Use `UnifiedCache` with an external `CacheAdapter` (Redis) when available.
- TTL should be >= refresh interval or invalidation-based (on config updates).

**Post-archive maintenance:**
- Run `VACUUM (ANALYZE)` on CopyTrade/CommissionLog after batch deletes, or schedule via ops runbook.
- Keep batches small to avoid long locks.
