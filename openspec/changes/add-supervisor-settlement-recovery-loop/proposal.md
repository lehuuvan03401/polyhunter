# Change: Add supervisor settlement pending recovery loop

## Why
`SETTLEMENT_PENDING` trades can remain unresolved when deferred settlement is enabled or settlement push/return fails transiently. Without autonomous recovery, these trades may stay pending indefinitely and create accounting drift risk.

## What Changes
- Add a supervisor background recovery loop for `SETTLEMENT_PENDING` copy trades.
- Use lock-claim semantics (`lockedAt`/`lockedBy`) to prevent multi-instance duplicate recovery.
- Execute `recoverSettlement` and update trade status to `EXECUTED` on success.
- Apply exponential backoff retries and mark trade `FAILED` when retry cap is reached.
- Expose recovery counters through supervisor metrics for operations visibility.

## Impact
- Affected specs: `copy-trading`
- Affected code:
  - `web/scripts/workers/copy-trading-supervisor.ts`
