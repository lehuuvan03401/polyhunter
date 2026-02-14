## Context
Current runtime paths are WebSocket-first and tuned for low detection latency. Upstream SDK moved to polling-based Smart Money ingestion due reliability concerns. A direct one-shot migration to polling-only may degrade latency characteristics for our highest priority users, while staying WS-only risks upstream divergence and production instability.

## Goals / Non-Goals
- Goals:
  - Preserve low-latency capability where WS is healthy.
  - Ensure reliable capture via polling fallback/reconciliation.
  - Keep runtime behavior configurable and reversible by env.
  - Reduce upstream merge friction by aligning with polling model.
- Non-Goals:
  - Full rewrite of execution engine.
  - Immediate removal of all WS ingestion code.

## Decisions
- Decision: Introduce a source abstraction (`SignalSource`) and orchestrator that supports WS, polling, and hybrid.
  - Why: isolate ingestion concerns from execution path.
- Decision: Default to `HYBRID` mode for production rollout.
  - Why: balances latency and reliability.
- Decision: Persist polling cursor in DB.
  - Why: restart-safe continuity and deterministic replay boundaries.
- Decision: Dedup keys are channel-agnostic and shared.
  - Why: prevent double execution in hybrid mode.

## Risks / Trade-offs
- Risk: Polling introduces higher baseline detection latency.
  - Mitigation: adaptive polling interval and WS fast path in hybrid mode.
- Risk: Hybrid mode can increase complexity.
  - Mitigation: explicit source metrics and strict dedup invariants.
- Risk: Cursor bugs can cause replay/missed events.
  - Mitigation: bounded replay window + startup reconciliation checks.

## Migration Plan
1. Ship source abstraction behind feature flag.
2. Enable `POLLING_ONLY` in staging and verify end-to-end consistency.
3. Enable `HYBRID` in production with mismatch metrics alerting.
4. Keep `WS_ONLY` as temporary rollback mode during migration window.

## Rollback Plan
- Set `COPY_TRADING_SIGNAL_MODE=WS_ONLY` and restart supervisor/worker.
- Keep cursor table intact for forward retry; do not drop migration until rollout is complete.

## Open Questions
- Which Data API endpoint and filter granularity gives best cost/latency tradeoff?
- Should polling cursor be global per process, or per monitored trader shard?
