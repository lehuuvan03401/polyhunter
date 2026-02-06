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
- PASS: shared dedup store rejects duplicate key within TTL (see Dedup Test).
- INFO: Local Redis warned about password being supplied while `default` user has no password.

### Dedup Test (Redis shared store)
Command:
```
DOTENV_CONFIG_PATH=frontend/.env.local SUPERVISOR_DEDUP_TEST_TTL_MS=2000 SUPERVISOR_DEDUP_TEST_WAIT_MS=2500 \\
  npx tsx --tsconfig frontend/tsconfig.json frontend/scripts/verify/dedup-shared.ts
```
Result:
- PASS: first set OK, second set DUPLICATE, after TTL OK.

### Real-event dual supervisor dedup (same shard)
Setup:
- Seeded config for trader `0x7099...` and wallet `0xf39f...`.
- Ran two supervisors with same shard (`SUPERVISOR_SHARD_COUNT=1`) and shared Redis.
- Triggered a real on-chain `TransferSingle` (mint + sell) using `impersonate-mainnet-trade.ts`.

Commands (abridged):
```
DOTENV_CONFIG_PATH=frontend/.env.local npx tsx --tsconfig frontend/tsconfig.json frontend/scripts/verify/seed-supervisor-config.ts
DOTENV_CONFIG_PATH=frontend/.env.local ENABLE_REAL_TRADING=true DRY_RUN=true SUPERVISOR_SHARD_COUNT=1 \\
  npx tsx --tsconfig frontend/tsconfig.json frontend/scripts/copy-trading-supervisor.ts > logs/supervisor-dedup/supervisor-a.log 2>&1 &
DOTENV_CONFIG_PATH=frontend/.env.local ENABLE_REAL_TRADING=true DRY_RUN=true SUPERVISOR_SHARD_COUNT=1 \\
  npx tsx --tsconfig frontend/tsconfig.json frontend/scripts/copy-trading-supervisor.ts > logs/supervisor-dedup/supervisor-b.log 2>&1 &
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545 npx tsx --tsconfig frontend/tsconfig.json frontend/scripts/impersonate-mainnet-trade.ts
```

Result:
- PASS: both supervisors showed active config + `Listening for TransferSingle` on CTF address.
- PASS: only one supervisor logged `SIGNAL DETECTED` for the same events (mint BUY + sell), confirming shared dedup.
- Logs: `logs/supervisor-dedup/supervisor-a.log`, `logs/supervisor-dedup/supervisor-b.log`.

## 3) Queue backpressure saturation
Status: PASS (synthetic load generator).
Command:
```
DOTENV_CONFIG_PATH=frontend/.env.local SUPERVISOR_QUEUE_STRESS_COUNT=5200 \\
  npx tsx --tsconfig frontend/tsconfig.json frontend/scripts/verify/queue-backpressure.ts
```
Result:
- PASS: queue capped at 5000 entries.
- PASS: drops observed when exceeding max size (200 dropped).
- PASS: queue cleaned up after test (cleanup enabled by default).
- INFO: Redis warning about password supplied for `default` user with no password.
