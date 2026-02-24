# Change: Add Prometheus/Grafana rollout templates for supervisor monitoring

## Why
Supervisor now exposes rich metrics and runtime alerts, but operators still need concrete deployment templates to adopt monitoring quickly and consistently.

## What Changes
- Add Prometheus scrape configuration template for supervisor metrics endpoint.
- Add Grafana dashboard JSON template for supervisor SLO/operational metrics.
- Add deployment/runbook documentation for enabling metrics endpoint, Prometheus scrape, and Grafana import.
- Link monitoring deployment guide from operations index and stage1 deployment README.

## Impact
- Affected specs: `copy-trading`
- Affected code/docs:
  - `deploy/stage1/monitoring/prometheus/prometheus.supervisor.yml`
  - `deploy/stage1/monitoring/grafana/dashboards/copy-trading-supervisor.json`
  - `deploy/stage1/monitoring/README.md`
  - `docs/operations/deploy-supervisor-monitoring.md`
