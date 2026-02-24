# Change: Align orchestrator execution status with settlement state

## Why
`TradeOrchestrator` currently marks successful proxy executions as `EXECUTED` even when settlement is deferred or incomplete. This makes supervisor/orchestrator status semantics inconsistent with API execution flow and can hide pending settlement risk from operators.

## What Changes
- Update orchestrator success-status logic to write `SETTLEMENT_PENDING` when settlement is deferred or not yet confirmed.
- Keep `EXECUTED` only for fully settled successful trades.
- Preserve `FAILED` behavior for execution failures.

## Impact
- Affected specs: `copy-trading`
- Affected code: `sdk/src/core/trade-orchestrator.ts`
