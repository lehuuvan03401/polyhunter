# Change: Supervisor capacity controls (worker pool + config refresh)

## Why
Current supervisor throughput is capped by a fixed worker pool size and repeated full-table config refreshes, which will not meet the 10k-user / 50M copy-trades-per-day target. We need explicit capacity controls and a more efficient config refresh strategy.

## What Changes
- Add configurable worker pool size for supervisor instances.
- Replace full-table config refresh with incremental refresh + periodic full reconciliation.
- Record cache refresh metrics to validate staleness bounds.

## Impact
- Affected specs: `copy-trading`
- Affected code: `frontend/scripts/copy-trading-supervisor.ts`, DB indexes for `CopyTradingConfig` (optional), runbook updates
