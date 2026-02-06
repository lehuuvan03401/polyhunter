# Verification: add-supervisor-capacity-controls

Date: 2026-02-06

## 1) Worker pool size override
Command:
```
DOTENV_CONFIG_PATH=frontend/.env.local ENABLE_REAL_TRADING=true DRY_RUN=true \
SUPERVISOR_WORKER_POOL_SIZE=5 SUPERVISOR_CONFIG_REFRESH_MS=2000 SUPERVISOR_CONFIG_FULL_REFRESH_MS=60000 \
npx tsx --tsconfig frontend/tsconfig.json frontend/scripts/copy-trading-supervisor.ts > logs/supervisor-capacity/supervisor-fullrefresh.log 2>&1 &
```
Result:
- PASS: log shows `Worker pool size: 5` and fleet `5/5 ready`.

## 2) Incremental refresh applies new config
Commands (abridged):
```
DOTENV_CONFIG_PATH=frontend/.env.local npx tsx --tsconfig frontend/tsconfig.json frontend/scripts/verify/seed-supervisor-config.ts
```
Result:
- PASS: log shows `Refreshed (incremental): 1 strategies` after config creation.

## 3) Periodic full refresh reconciles removals
Commands (abridged):
```
SUPERVISOR_TEST_CONFIG_ACTION=cleanup npx tsx --tsconfig frontend/tsconfig.json frontend/scripts/verify/seed-supervisor-config.ts
```
Result:
- PASS: log shows `Refreshed (full): 0 strategies` after full refresh interval.

Logs:
- `logs/supervisor-capacity/supervisor-fullrefresh.log`
