# Deploy: Supervisor Capacity Controls

This runbook covers deploying the supervisor capacity controls (worker pool sizing + incremental refresh) and the associated DB index.

## 1) Preconditions
- Confirm code is built and deployed to the target environment.
- Ensure `DATABASE_URL` points to the target DB.
- Back up the database if required by your change policy.

## 2) Apply Prisma migration
From the app host (or CI deploy step):
```
cd frontend
npx prisma migrate deploy
```

## 3) Configure environment variables
Set or update the following:
- `SUPERVISOR_WORKER_POOL_SIZE` (default 20)
- `SUPERVISOR_CONFIG_REFRESH_MS` (default 10000)
- `SUPERVISOR_CONFIG_FULL_REFRESH_MS` (default 300000)

Recommended baseline for 10k users (250ms target latency):
- `SUPERVISOR_WORKER_POOL_SIZE=20`
- `SUPERVISOR_CONFIG_REFRESH_MS=10000`
- `SUPERVISOR_CONFIG_FULL_REFRESH_MS=300000`

## 4) Deploy and restart
- Deploy the new supervisor build.
- Restart all supervisor instances with the updated env.

## 5) Verification checklist
- Logs show: `Worker pool size: <N>`
- Config refresh logs show `Refreshed (incremental)` during steady state.
- At full refresh interval, logs show `Refreshed (full)`.
- No unexpected error spikes in copy-trading execution metrics.

## 6) Rollback plan
If issues occur:
1) Reduce `SUPERVISOR_WORKER_POOL_SIZE` or revert to previous defaults.
2) Increase refresh intervals to reduce DB load.
3) Roll back the application binary if needed.

### Optional: Drop index (last resort)
Only if you must revert the schema change:
```
DROP INDEX IF EXISTS "CopyTradingConfig_updatedAt_isActive_autoExecute_channel_idx";
```
