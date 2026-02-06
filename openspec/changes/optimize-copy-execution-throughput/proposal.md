# Change: Optimize copy execution throughput (mutex scope + async settlement)

## Why
The current execution engine prioritizes safety but holds broad signer mutexes and waits on settlement transfers, which limits throughput at 10k-user scale. We need to reduce critical section scope and allow asynchronous settlement to keep workers available.

## What Changes
- Narrow signer-level mutex to only on-chain tx submission steps.
- Move settlement transfers (push/reimburse) to an async settlement queue with retry + monitoring.
- Emit metrics for settlement queue depth, lag, and retry outcomes.

## Impact
- Affected specs: `copy-trading`
- Affected code: `src/services/copy-trading-execution-service.ts`, settlement/worker background loops, runbook updates
