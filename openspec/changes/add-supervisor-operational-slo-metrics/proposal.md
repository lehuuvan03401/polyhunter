# Change: Add operational SLO metrics for copy-trading supervisor

## Why
Current supervisor metrics focus on aggregate execution counts and average latency, but lack operational visibility for queue-tail behavior, reject reason distribution, wallet-level success, and reconciliation drift.

## What Changes
- Add queue lag percentile reporting (`p95`) in metrics summary.
- Add reject reason distribution summary (top reasons in window).
- Add per-wallet success summary (success/fail/skip with success rate).
- Add reconciliation drift summary (`totalAbsDiff`, `maxAbsDiff`, run/error counters).
- Record execution outcomes consistently (success/fail/skip) across execute path.

## Impact
- Affected specs: `copy-trading`
- Affected code: `web/scripts/workers/copy-trading-supervisor.ts`
