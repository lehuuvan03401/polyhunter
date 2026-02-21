## Context
Preflight checks read balances and allowances for each signal. Under high-frequency signals, these reads are duplicated and add latency.

## Goals / Non-Goals
- Goals:
  - Reduce redundant RPC calls for preflight checks.
  - Keep cache TTL very short to minimize stale risk.
- Non-Goals:
  - Replace execution-time checks or fund transfers.

## Decisions
- Decision: Cache preflight reads with TTL <= 2s and deduplicate in-flight requests.
- Alternatives considered:
  - Multicall for every trade (still expensive under burst).

## Risks / Trade-offs
- Slight chance of stale preflight decisions; mitigated by short TTL and live execution checks.

## Migration Plan
- Add cache logic in worker preflight path.

## Open Questions
- Should TTL be configurable via env? (default 2s)
