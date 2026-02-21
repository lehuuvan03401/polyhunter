## Context
We currently log execution events but lack periodic aggregated metrics or threshold alerts.

## Goals / Non-Goals
- Goals:
  - Emit periodic metrics summaries (success rate, latency, failures).
  - Warn when balances drop below thresholds.
- Non-Goals:
  - Full monitoring stack integration.

## Decisions
- Decision: Reuse worker stats timer and extend with metrics output.
- Decision: Add env thresholds for worker/proxy balances.

## Risks / Trade-offs
- Extra logs; acceptable for observability.

## Migration Plan
No schema changes required.
