# Copy-Trading Go-Live Checklist

Final pre-launch checklist for the hardened copy-trading stack. Use this after code deploy and before enabling real-money execution.

## 1) Release Gate

- [ ] Target release includes commits `3504368`, `377096e`, and `71adfc8`.
- [ ] `COPY_TRADING_DRY_RUN=false` is set intentionally for production.
- [ ] `ENABLE_REAL_TRADING=true` is set intentionally for production.
- [ ] `COPY_TRADING_EMERGENCY_PAUSE` is confirmed `false` before opening traffic.

## 2) Secrets and Runtime Config

- [ ] `docs/operations/production-env-alignment-checklist.md` has been reviewed and signed off.
- [ ] `CRON_SECRET` is set to a non-placeholder value.
- [ ] `ENCRYPTION_KEY` is set to a non-zero 64-hex value.
- [ ] `CHAIN_ID` is set explicitly and matches the target network.
- [ ] `TRADING_PRIVATE_KEY` or `TRADING_MNEMONIC` is present on the runtime that executes trades.
- [ ] `POLY_API_KEY`, `POLY_API_SECRET`, and `POLY_API_PASSPHRASE` are present for live CLOB execution.
- [ ] `SUPERVISOR_REDIS_URL` is reachable from supervisor instances.

## 3) Database and Migrations

- [ ] Run schema rollout:

```bash
cd web
npx prisma migrate deploy
```

- [ ] Confirm `CopyTrade` has the lock/idempotency columns expected by current code (`lockedAt`, `lockedBy`, `originalTxHash`).
- [ ] Confirm the unique key on `(configId, originalTxHash)` exists in production.

## 4) Runtime Processes

- [ ] Web app is running from `web/`.
- [ ] Standalone worker entrypoint is valid:

```bash
cd web
npx tsx scripts/workers/copy-trading-worker.ts
```

- [ ] Supervisor entrypoint is valid:

```bash
cd web
npx tsx scripts/workers/copy-trading-supervisor.ts
```

- [ ] PM2/systemd uses the canonical supervisor command above, not the removed legacy path.
- [ ] If using Stage-1 manifests, `deploy/stage1/k8s/09-copy-supervisor.yaml` is applied.

## 5) Monitoring and Alerts

- [ ] Supervisor metrics endpoint is enabled:
  - `SUPERVISOR_METRICS_SERVER_ENABLED=true`
  - `SUPERVISOR_METRICS_HOST=0.0.0.0`
  - `SUPERVISOR_METRICS_PORT=9464`
- [ ] Health endpoint responds:

```bash
curl -s http://<supervisor-host>:9464/healthz
```

- [ ] Metrics endpoint exposes:
  - `copy_supervisor_execution_total`
  - `copy_supervisor_queue_depth`
  - `copy_supervisor_queue_lag_p95_ms`
  - `copy_supervisor_alerts_total`
  - `copy_supervisor_settlement_recovery_runs_total`
- [ ] Prometheus scrape config is deployed from `deploy/stage1/monitoring/prometheus/prometheus.supervisor.yml` or equivalent.
- [ ] Grafana dashboard `deploy/stage1/monitoring/grafana/dashboards/copy-trading-supervisor.json` is imported.
- [ ] Alert routing (PagerDuty/Slack/On-call) is tested end-to-end.

## 6) Preflight Verification

- [ ] Readiness check passes:

```bash
cd sdk
npx tsx scripts/verify/copy-trading-readiness.ts
```

- [ ] Execution path verification passes in the target environment:

```bash
cd sdk
npx tsx scripts/verify/copy-trading-execution-paths.ts
```

- [ ] If async settlement is enabled, run:

```bash
cd sdk
npx tsx scripts/verify/async-settlement-flow.ts
```

- [ ] If reimbursement ledger is enabled, run:

```bash
cd sdk
npx tsx scripts/verify/reimbursement-ledger-flow.ts
```

## 7) Functional Smoke Tests

- [ ] `/api/copy-trading/readiness` returns expected balances and required actions.
- [ ] `/api/copy-trading/detect` rejects unauthorized requests (`401`).
- [ ] `/api/copy-trading/execute` processes a single pending trade exactly once under concurrency.
- [ ] `GET /api/copy-trading/trades`, `orders`, and `history` respect pagination caps in production-like traffic.
- [ ] A canary wallet completes one full detect -> execute -> settle loop before opening general traffic.

## 8) Rollback Readiness

- [ ] `COPY_TRADING_EMERGENCY_PAUSE=true` rollback procedure is documented for the on-call operator.
- [ ] PM2/systemd restart commands are tested.
- [ ] Previous release artifact is retained for fast rollback.
- [ ] DB rollback strategy is known if migrations are incompatible.
