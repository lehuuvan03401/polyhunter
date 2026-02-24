# Change: Add supervisor metrics endpoint and operational alerts

## Why
Supervisor currently logs SLO summaries to stdout but does not expose a scrape-friendly metrics endpoint or threshold-based operational alerts. This limits production observability and timely incident response.

## What Changes
- Add built-in HTTP metrics server for supervisor (`/metrics` and `/healthz`).
- Export queue/execution/reject/reconciliation/load-shedding metrics in Prometheus text format.
- Add cumulative counters for key events (execution outcomes, queue actions, rejects, reconciliations, alerts).
- Add configurable operational alerting with cooldown based on queue depth, queue lag p95, reject rate, and critical load-shedding mode.
- Ensure metrics server lifecycle is managed on startup and graceful shutdown.

## Impact
- Affected specs: `copy-trading`
- Affected code: `web/scripts/workers/copy-trading-supervisor.ts`
