## Context
Managed wealth reuses the copy-trading stack and already covers product catalog, subscription APIs, NAV snapshots, and settlement records. However, several runtime paths are still divergent:
- static primary agent binding,
- wallet-level position aggregation,
- synthetic liquidation paths,
- settlement entrypoint inconsistency for commission distribution.

These divergences break strict closure for strategy execution, accounting isolation, and marketing payout consistency.

## Goals
- Guarantee subscription-scoped accounting and execution isolation.
- Guarantee deterministic and auditable trader allocation decisions.
- Guarantee settlement and profit-fee parity across all settlement entrypoints.
- Guarantee managed principal linkage from participation funding/authorization to subscription lifecycle.

## Non-Goals
- Replacing the full copy-trading execution stack.
- Introducing new compensation programs beyond current policy.
- Redesigning the full managed wealth UI.

## Decisions

### 1) Allocation as persisted snapshot, not ephemeral runtime choice
- Decision: persist allocation version per subscription with candidate score snapshot and seed.
- Rationale: required for auditability and deterministic replay.

### 2) Subscription-scoped position accounting
- Decision: use execution scope key (`subscriptionId`) in position accounting layer.
- Rationale: wallet-only aggregation causes cross-subscription contamination.
- Migration strategy: dual-write + read-switch + backfill verification.

### 3) Unified settlement service
- Decision: worker, manual withdraw, and admin run call one shared settlement domain service.
- Rationale: removes branching logic and payout parity drift.

### 4) Real liquidation requirement
- Decision: settlement cannot complete if required liquidation remains synthetic/unexecuted.
- Rationale: synthetic trades cannot satisfy accounting integrity for payout and commission.

### 5) Principal reservation linkage
- Decision: managed subscription consumes reserved principal balance and writes reversible reservation ledger events.
- Rationale: closes funding/authorization/subscription linkage for custody-grade traceability.

## Risks / Trade-offs
- Migration complexity for scoped position accounting.
- Temporary throughput impact while dual-writing and backfilling.
- Reconciliation burden during transition between old and new settlement paths.

## Mitigations
- Feature flags for read/write switching.
- Reconciliation scripts for NAV and settlement parity checks.
- Idempotent settlement event model to prevent duplicate payout/commission.

## Rollout Plan
1. Ship schema changes and dual-write instrumentation.
2. Enable unified settlement service in shadow mode (compare-only).
3. Turn on scoped reads for managed subscriptions.
4. Enforce real liquidation gate.
5. Remove legacy synthetic path and complete cleanup.

## Open Questions
- Should managed allocation rebalance be event-driven (trader risk breach) or periodic-only?
- Should principal reservation enforce hard real-time balance checks against on-chain holdings in MVP, or ledger-first with async reconciliation?

