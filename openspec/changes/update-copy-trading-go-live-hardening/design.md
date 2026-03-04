## Context
Copy-trading currently spans API routes, supervisor workers, SDK orchestrator logic, and database/Redis coordination. The audited issues are cross-cutting: authentication defaults, concurrent execution races, idempotency drift between signal channels, and runtime resource bounds.

Because these issues interact (for example, duplicate detection + execute race + non-atomic counters), this change uses a unified hardening design instead of isolated patches.

## Goals / Non-Goals
- Goals:
  - Eliminate fail-open security behavior in production.
  - Guarantee at-most-one executor claim per pending trade.
  - Guarantee no orphan `PENDING` trades after execution attempts.
  - Guarantee deterministic idempotency identity for detected leader trades.
  - Bound memory/query growth to predictable ceilings.
  - Preserve existing functional behavior for successful copy execution.
- Non-Goals:
  - No strategy logic redesign.
  - No new product features or UI changes.
  - No rewrite of queue architecture beyond correctness hardening.

## Decisions
- Decision: Security defaults must be fail-closed.
  - `CRON_SECRET` and `ENCRYPTION_KEY` must be explicitly configured and validated at startup.
  - Production wallet-scoped copy-trading APIs require signature verification by default.
  - `redeem-sim` becomes gated by authenticated ownership + explicit simulation-enable flag.
  - Alternatives considered: keep dev fallback secrets.
  - Rationale: fallback secrets and header-only auth are unacceptable for commercial deployment.

- Decision: Execute flow moves to atomic claim-then-run lifecycle.
  - Add compare-and-set claim (`where status='PENDING'`) that transitions to processing lock metadata before execution.
  - Requests that fail claim return conflict/no-op instead of re-running execution.
  - Alternatives considered: optimistic read-then-update only.
  - Rationale: current read-check-update permits double execution under concurrent requests.

- Decision: Detection idempotency anchored to source identity.
  - Persist `originalTxHash` from source event/activity whenever available.
  - Use deterministic fallback fingerprint only when source hash is truly absent.
  - Insert path must rely on `(configId, originalTxHash)` uniqueness semantics.
  - Alternatives considered: timestamp + size heuristic.
  - Rationale: heuristic matching is collision-prone and not stable across channels.

- Decision: Orchestrator state machine must return consistent execution classification.
  - EOA success (with `orderId` but no `transactionHashes`) must be treated as executed.
  - Any exception after trade creation must transition the trade to explicit failure/retry state.
  - Alternatives considered: keep status in DB but allow caller-level misclassification.
  - Rationale: caller metrics/guardrail accounting currently diverge from persisted truth.

- Decision: Concurrency primitives must be atomic in shared mode.
  - Guardrail counters require atomic increment semantics across workers/shards.
  - Multi-shard mode cannot silently degrade to non-shared/non-atomic paths.
  - Alternatives considered: short-TTL in-memory counters.
  - Rationale: non-atomic counters violate cap enforcement under burst traffic.

- Decision: Runtime caches and high-cardinality queries must be bounded.
  - TTL cache utility and supervisor maps gain max-entry caps + sweep behavior.
  - Copy-trading list endpoints enforce hard max limits and cursor pagination.
  - Alternatives considered: rely on TTL alone.
  - Rationale: TTL-only maps still grow unbounded under high key cardinality.

- Decision: Environment contract normalization across API/supervisor.
  - Canonical keys for `CHAIN_ID`, `DRY_RUN`, signature requirement.
  - Conflicting values fail fast during startup with explicit error.
  - Alternatives considered: permissive precedence with warnings.
  - Rationale: hidden config drift causes behavior divergence between components.

## Risks / Trade-offs
- Stricter auth/config validation may break existing ad-hoc scripts.
  - Mitigation: provide migration notes and explicit local-dev override flags.
- Atomic claim adds one DB write before execution.
  - Mitigation: indexed claim predicates and short transaction scope.
- Pagination caps may change client assumptions.
  - Mitigation: document defaults and expose cursors in API responses.
- Enforcing Redis/atomic store behavior in sharded mode raises infra dependency.
  - Mitigation: explicit startup diagnostics and preflight readiness checks.

## Migration Plan
1. Ship config/auth fail-closed checks behind deployment checklist and environment readiness verification.
2. Deploy execute atomic-claim path and orchestrator classification fixes.
3. Deploy detection idempotency and storage constraints.
4. Deploy bounded cache + pagination caps with telemetry.
5. Run staged load tests and replay duplicate-signal scenarios before full cutover.

## Open Questions
- For post-claim execution failures, should default terminalization be immediate `FAILED` or bounded retry with `nextRetryAt` for API-triggered runs? (Proposal supports either, but implementation should choose one policy consistently.)
