## Context
The previous delivery implemented most policy capabilities but left several critical controls as optional or operationally manual. External-facing policy now requires these controls to be hard guarantees rather than soft conventions.

## Goals
- Convert policy-critical “partial implementations” into enforceable system invariants.
- Minimize behavioral ambiguity between product messaging and runtime behavior.
- Keep rollout safe with feature-flag migration windows and deterministic observability.

## Non-Goals
- Rewriting copy-trading architecture.
- Introducing new affiliate compensation models outside current policy.
- Broad UI redesign.

## Decisions

### 1) Immutable 100-seat cap
- Decision: Treat 100 as invariant constant at runtime and config API.
- Rationale: “Global 100 seats, never increased” is externally promised and should not be admin-overridable.
- Migration: Existing config rows with `maxSeats != 100` are normalized to 100 via migration script.

### 2) Operational automation for elimination/refund
- Decision: Add scheduler-safe elimination trigger and SLA watchdog process.
- Rationale: Manual execution is error-prone for monthly critical flows.
- Idempotency key: `monthKey` + run lock.

### 3) Managed authorization boundaries as hard gates in production
- Decision: Production defaults require both managed activation and active custody authorization.
- Rationale: Aligns security boundary with declared policy.
- Dev/Test: Allow explicit opt-out only outside production.

### 4) Same-level bonus as default-on policy
- Decision: Keep feature switch for emergency break-glass only; production default = enabled.
- Rationale: Policy includes same-level bonus; optional disabled state causes payout mismatch.

### 5) Fee-scope clarity
- Decision: Keep fixed 20% realized-profit policy as participation profit-fee scope and isolate unrelated fee systems via explicit route-level scope guards.
- Rationale: Prevent policy ambiguity and accidental double charging.

### 6) FREE-mode enforceable boundary
- Decision: APIs requiring managed/custodial scope must verify account mode = MANAGED.
- Rationale: Ensure FREE mode remains non-custodial in practice, not only in documentation.

## Risks / Trade-offs
- Tightening hard gates may reject previously accepted requests in production.
- Partner cap normalization may conflict with temporary internal experiments.
- Automation introduces scheduler reliability requirements.

## Mitigations
- Stage rollout by environment and add pre-release dry-run checks.
- Add explicit logs/metrics and alerting for rejected requests.
- Keep emergency override path documented for incidents.

## Rollout Plan
1. Ship schema/config guard changes.
2. Deploy scheduler/watchdog with dry-run mode.
3. Enable hard-gate defaults in production.
4. Monitor error rates, refund SLA queue, and elimination cadence.

## Open Questions
- Whether same-level bonus should remain break-glass configurable in production or be fully immutable.
- Whether fee-scope unification should also remove legacy proxy-tier fee routes or explicitly mark them out-of-policy for this product line.
