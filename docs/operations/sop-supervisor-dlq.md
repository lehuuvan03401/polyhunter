# SOP: Supervisor DLQ Operations

This runbook covers day-2 operations for supervisor dead-letter queue (DLQ).

## Scope

- Queue namespace prefix: `copytrading:supervisor:`
- Active queue key: `copytrading:supervisor:queue`
- DLQ key: `copytrading:supervisor:queue:dlq`
- Tool script: `web/scripts/verify/supervisor-dlq-ops.ts`

## Prerequisites

- `REDIS_URL` (or `SUPERVISOR_REDIS_URL`) must be set.
- Run commands from `web/` directory.

## 1) Check Queue/DLQ Health

```bash
cd web
REDIS_URL=redis://127.0.0.1:6379 \
npx tsx scripts/verify/supervisor-dlq-ops.ts --action stats
```

Watch for:

- `dlq > 0` sustained over time
- `active` close to `SUPERVISOR_QUEUE_MAX_SIZE`

## 2) Inspect DLQ Entries

```bash
cd web
REDIS_URL=redis://127.0.0.1:6379 \
npx tsx scripts/verify/supervisor-dlq-ops.ts --action peek --limit 50
```

Focus on dominant:

- `reason` (e.g. `EXECUTION_ERROR`, `LEASE_EXPIRED_MAX_ATTEMPTS`)
- `source` (`nack` or `reclaim`)

## 3) Replay DLQ Entries

Dry-run first:

```bash
cd web
REDIS_URL=redis://127.0.0.1:6379 \
npx tsx scripts/verify/supervisor-dlq-ops.ts --action replay --limit 20 --dry-run
```

Actual replay:

```bash
cd web
REDIS_URL=redis://127.0.0.1:6379 \
npx tsx scripts/verify/supervisor-dlq-ops.ts --action replay --limit 20
```

Optional filtering:

```bash
cd web
REDIS_URL=redis://127.0.0.1:6379 \
npx tsx scripts/verify/supervisor-dlq-ops.ts --action replay --limit 50 --reason EXECUTION_ERROR
```

Notes:

- Replay resets `queueAttempt` to `0` by default.
- Use `--keep-attempt` only for special debugging.

## 4) Purge DLQ Entries

Purge oldest N entries:

```bash
cd web
REDIS_URL=redis://127.0.0.1:6379 \
npx tsx scripts/verify/supervisor-dlq-ops.ts --action purge --limit 100
```

Dry-run purge:

```bash
cd web
REDIS_URL=redis://127.0.0.1:6379 \
npx tsx scripts/verify/supervisor-dlq-ops.ts --action purge --limit 100 --dry-run
```

## 5) Recommended Alert Baselines

- `copy_supervisor_queue_dlq_size >= 1` for 5m
- `rate(copy_supervisor_queue_total{action="dead_lettered"}[5m]) > 0` for 10m
- Queue depth alert with existing thresholds

## 6) Escalation Checklist

If DLQ keeps growing after replay:

1. Check supervisor logs for recurring reason patterns.
2. Verify RPC/provider stability and wallet balances/allowances.
3. Validate upstream signal quality (WS/POLLING mismatch spikes).
4. Temporarily lower fanout or enable stricter load shedding.
5. Pause affected wallets/traders if poison jobs are isolated to a subset.
