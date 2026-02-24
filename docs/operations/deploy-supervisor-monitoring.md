# Deploy: Supervisor Prometheus + Grafana Monitoring

This guide provides production-ready templates and rollout steps for supervisor observability.

## Template Files

- Prometheus scrape config template:
  - `deploy/stage1/monitoring/prometheus/prometheus.supervisor.yml`
- Grafana dashboard template:
  - `deploy/stage1/monitoring/grafana/dashboards/copy-trading-supervisor.json`

## 1) Enable metrics endpoint on supervisor

Set these env vars for each supervisor instance:

- `SUPERVISOR_METRICS_SERVER_ENABLED=true`
- `SUPERVISOR_METRICS_HOST=0.0.0.0` (required for external scrape)
- `SUPERVISOR_METRICS_PORT=9464` (or `9464 + shard index`)

Optional alert-related vars:

- `SUPERVISOR_ALERTS_ENABLED=true`
- `SUPERVISOR_ALERT_QUEUE_DEPTH`
- `SUPERVISOR_ALERT_QUEUE_P95_MS`
- `SUPERVISOR_ALERT_REJECT_RATE`
- `SUPERVISOR_ALERT_COOLDOWN_MS`

## 2) Configure Prometheus scrape

1. Copy template job definitions from:
   - `deploy/stage1/monitoring/prometheus/prometheus.supervisor.yml`
2. Keep one mode:
   - Static targets (VM/PM2/Docker host), or
   - Kubernetes pod discovery
3. Update target list/namespace/labels to match your environment.
4. Reload Prometheus.

Validation:

```bash
curl -s http://<supervisor-host>:9464/healthz
curl -s http://<supervisor-host>:9464/metrics | head
```

Prometheus target status should be `UP`.

## 3) Import Grafana dashboard

1. Open Grafana: Dashboards -> Import.
2. Upload JSON file:
   - `deploy/stage1/monitoring/grafana/dashboards/copy-trading-supervisor.json`
3. Bind `DS_PROMETHEUS` to your Prometheus datasource.

Dashboard panels cover:

- Execution throughput and window success/reject rate
- Queue depth and queue lag (p95/avg)
- Load-shedding mode, fanout, mempool pause state
- Reject reason distributions (window + cumulative)
- Reconciliation drift and error/runs trends
- Wallet-level window success rate (top-k)

## 4) Recommended alert baselines

Prometheus/Grafana alert rules can start with:

- Queue depth >= `SUPERVISOR_ALERT_QUEUE_DEPTH` for 5m
- Queue lag p95 >= `SUPERVISOR_ALERT_QUEUE_P95_MS` for 5m
- Reject rate >= 35% with >= 20 attempts in window
- Load-shedding `CRITICAL` mode active for 2-5m

## 5) Rollback

If monitoring changes cause operational issues:

1. Disable metrics endpoint by setting `SUPERVISOR_METRICS_SERVER_ENABLED=false`.
2. Revert Prometheus scrape changes.
3. Keep supervisor trading logic unchanged (metrics path is side-channel only).
