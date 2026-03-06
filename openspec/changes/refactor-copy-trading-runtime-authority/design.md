## Context

The codebase currently exposes multiple execution authorities for copy trading:
- `web/scripts/workers/copy-trading-supervisor.ts`
- `web/scripts/workers/copy-trading-worker.ts`
- `web/app/api/copy-trading/execute/route.ts`

They share some execution primitives but not a single runtime contract. This makes it difficult to reason about ownership of automatic execution, settlement, market resolution, and ledger correctness.

## Goals / Non-Goals

- Goals:
  - Define one automatic authority runtime
  - Keep compatibility/manual entry points without allowing them to drift semantically
  - Reduce operator ambiguity in scripts and docs
- Non-Goals:
  - Remove every old file immediately
  - Introduce a new execution engine separate from supervisor/orchestrator

## Decisions

- Decision: Supervisor is the automatic execution authority.
  - Rationale: it already owns the most complete signal ingestion, queueing, sharding, and settlement-recovery flow.

- Decision: Compatibility routes must delegate or reject in automatic mode.
  - Rationale: a compatibility path that can autonomously mutate execution state recreates the current divergence problem.

- Decision: Old worker becomes non-authoritative before it is removed.
  - Rationale: this supports staged rollout and easier rollback.

## Risks / Trade-offs

- Risk: operators may still run the deprecated worker.
  - Mitigation: change default scripts, add loud startup warnings, and document supported runtime.

- Risk: compatibility route delegation may increase latency for manual operations.
  - Mitigation: manual route may still submit requests, but authority state transitions must remain centralized.

## Migration Plan

1. Add runtime authority guards and documentation.
2. Change compatibility route behavior.
3. Update package scripts and runbooks.
4. Disable deprecated automatic paths by default.

## Open Questions

- Whether the deprecated worker should be removed immediately after rollout or kept for one release as a recovery tool.
