# Change: Execution stage metrics for copy trading

## Why
We need granular latency visibility to pinpoint bottlenecks and prioritize performance work in the real copy-trading pipeline.

## What Changes
- Add per-stage timing instrumentation for the execution pipeline (prewrite, guardrails, pricing, preflight, execution, persistence).
- Extend the periodic metrics summary to include per-stage counts and average latency.

## Impact
- Affected specs: copy-trading
- Affected code: scripts/copy-trading-worker.ts
