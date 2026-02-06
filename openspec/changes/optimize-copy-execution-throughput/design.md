## Context
`CopyTradingExecutionService` currently blocks worker availability by holding signer-level mutexes across the full execution and waiting for settlement transfers. At high concurrency this reduces throughput and increases queue lag.

## Goals / Non-Goals
- Goals:
  - Shorten critical sections to on-chain tx submission only.
  - Defer settlement transfers (push/reimburse) to a queue with retries.
  - Provide clear observability for deferred settlement.
- Non-Goals:
  - Changing trading strategy logic or slippage algorithms.
  - Replacing the execution engine with a new service.

## Decisions
- Decision: split execution into "order placement" and "settlement" phases.
  - Rationale: Order placement is latency-sensitive; settlement can tolerate async completion.
- Decision: add a durable settlement queue (DB-backed or Redis).
  - Rationale: Prevents loss of deferred settlement tasks on process restart.

## Risks / Trade-offs
- Deferred settlement introduces temporary discrepancies between bot and proxy balances.
- Settlement queue failure could strand assets; mitigate via retries + alerting.

## Migration Plan
1. Ship queue + metrics behind feature flag.
2. Gradually enable async settlement for BUYs only.
3. Extend to SELLs after monitoring stability.

## Open Questions
- Should settlement queue be Redis-backed or DB-backed by default?
- What is the max acceptable settlement delay before alerting?
