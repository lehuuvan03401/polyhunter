# Supervisor Monitoring Templates (Stage 1)

This folder contains ready-to-customize templates for monitoring `copy-trading-supervisor`:

- Prometheus scrape template: `prometheus/prometheus.supervisor.yml`
- Grafana dashboard JSON: `grafana/dashboards/copy-trading-supervisor.json`

## Quick usage

1. Enable supervisor metrics endpoint:

```bash
SUPERVISOR_METRICS_SERVER_ENABLED=true
SUPERVISOR_METRICS_HOST=0.0.0.0
SUPERVISOR_METRICS_PORT=9464
```

2. Copy scrape template into your Prometheus config and update targets.
3. Import dashboard JSON in Grafana.

See `docs/operations/deploy-supervisor-monitoring.md` for full rollout steps.
