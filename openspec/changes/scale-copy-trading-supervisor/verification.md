# Verification: scale-copy-trading-supervisor

Date: 2026-02-06

## 1) Dry-run sanity (local, selftest)
Command:
```
TRADING_PRIVATE_KEY=0x59c6995e998f97a5a004497e5f2a2e8e3b6c4b8f8c6f4d9a9b0e0e0a0a0a0a0a \
DATABASE_URL="postgresql://baronchan@localhost:5432/poly_hunter_dev?schema=public" \
NEXT_PUBLIC_CHAIN_ID=31337 \
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545 \
ENABLE_REAL_TRADING=true \
DRY_RUN=true \
SUPERVISOR_SELFTEST=true \
SUPERVISOR_SELFTEST_EXIT=true \
npx tsx --tsconfig frontend/tsconfig.json frontend/scripts/copy-trading-supervisor.ts
```
Result:
- PASS: supervisor booted, fleet initialized, configs refreshed, positions preloaded.
- PASS: activity subscription switched to filtered once configs loaded.
- PASS: selftest trade executed in DRY_RUN and exited.
- INFO: REDIS_URL not set (in-memory stores).

## 2) Multi-instance + shared dedup/queue (Redis)
Status: PARTIAL (Redis connectivity verified; shared dedup/queue not explicitly exercised).
Commands:
```
SUPERVISOR_SHARD_COUNT=2 SUPERVISOR_SHARD_INDEX=0 ... npx tsx --tsconfig frontend/tsconfig.json frontend/scripts/copy-trading-supervisor.ts
SUPERVISOR_SHARD_COUNT=2 SUPERVISOR_SHARD_INDEX=1 ... npx tsx --tsconfig frontend/tsconfig.json frontend/scripts/copy-trading-supervisor.ts
```
Result:
- PASS: shard ownership logged as `Shard 1/2` and `Shard 2/2`.
- PASS: only the owning shard subscribed to filtered activity; the other paused.
- PASS: Redis connected on both shards (`Shared stores enabled`).
- INFO: Local Redis warned about password being supplied while `default` user has no password.

## 3) Queue backpressure saturation
Status: PENDING (needs synthetic load generator or forced worker saturation).
