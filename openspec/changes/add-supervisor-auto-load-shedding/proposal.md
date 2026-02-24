# Change: Add supervisor auto load-shedding controls

## Why
Supervisor now has richer SLO metrics but still lacks active protection behavior under sustained queue pressure. Without automated controls, overload can amplify latency and failure cascades.

## What Changes
- Add runtime load-shedding state machine (`NORMAL` / `DEGRADED` / `CRITICAL`) driven by queue depth and queue lag p95 thresholds.
- Dynamically cap fanout concurrency based on load-shedding mode.
- Pause mempool dispatch automatically when load-shedding mode is elevated.
- Add periodic load-shedding evaluation loop and mode transition logs.
- Wire mempool detector callback to the existing mempool execution handler.

## Impact
- Affected specs: `copy-trading`
- Affected code: `web/scripts/workers/copy-trading-supervisor.ts`
