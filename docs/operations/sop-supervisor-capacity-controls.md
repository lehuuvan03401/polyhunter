# SOP: Supervisor Capacity Controls Rollout

This SOP covers staged rollout, monitoring, and rollback for supervisor capacity controls.

## 1) Preflight checklist
- Confirm migration applied (`frontend/prisma/migrations/20260206111203_add_config_refresh_index`).
- Confirm Redis is reachable for shared dedup/queue.
- Confirm `SUPERVISOR_WORKER_POOL_SIZE`, `SUPERVISOR_CONFIG_REFRESH_MS`, and `SUPERVISOR_CONFIG_FULL_REFRESH_MS` are set.
- Confirm shard settings are correct (`SUPERVISOR_SHARD_COUNT`, `SUPERVISOR_SHARD_INDEX`).
- Confirm target latency baseline (250ms) and error budgets.

## 2) Staged rollout plan
1. Deploy to staging; run smoke checks.
2. Deploy to 10% of supervisor instances.
3. Observe for 30–60 minutes.
4. Roll to 50%, then 100% if stable.

## 3) Monitoring signals
Watch these logs/metrics:
- `Worker pool size: <N>` matches expected.
- `Refreshed (incremental)` appears on refresh cadence.
- `Refreshed (full)` appears on full refresh interval.
- Queue metrics: depth, dropped, avg lag.
- Dedup hits/misses (ensure misses increase on real activity).
- Error rate from copy-trading execution services.

Suggested alerts:
- Queue depth > 80% of `SUPERVISOR_QUEUE_MAX_SIZE` for 5 minutes.
- Avg queue lag > 5s for 5 minutes.
- Error rate > 2% over 10 minutes.
- Missing full refresh log over 2× full refresh interval.

## 4) Verification steps
- Create a new config and confirm incremental refresh picks it up within `SUPERVISOR_CONFIG_REFRESH_MS`.
- Disable/delete a config and confirm it disappears after full refresh interval.
- If possible, trigger a real event and ensure only one shard processes it (dedup working).

## 5) Rollback plan
If errors or latency regressions occur:
1. Reduce `SUPERVISOR_WORKER_POOL_SIZE` (lower concurrency load).
2. Increase `SUPERVISOR_CONFIG_REFRESH_MS` / `SUPERVISOR_CONFIG_FULL_REFRESH_MS` to reduce DB load.
3. Roll back the supervisor build to the previous release.
4. If needed, drop the new index (last resort):
```
DROP INDEX IF EXISTS "CopyTradingConfig_updatedAt_isActive_autoExecute_channel_idx";
```

## 6) Post-deploy review
- Record throughput and latency vs baseline (24h).
- Update capacity plan with real metrics.
- Confirm no unexpected growth in DB load or Redis memory.
