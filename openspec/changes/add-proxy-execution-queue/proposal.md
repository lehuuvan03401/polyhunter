# Change: Add Proxy-Scoped Execution Queue

## Why
Even with per-signer mutexes, concurrent executions targeting the same proxy can cause race conditions in fund pulls/returns and settlement flows. Serializing execution per proxy reduces the risk of overlapping balance changes and inconsistent state during bursts.

## What Changes
- Introduce a proxy-scoped execution queue to serialize critical execution paths per proxy address.
- Ensure fund transfers and settlement for a given proxy do not overlap across concurrent trades.
- Preserve parallelism across different proxies.

## Impact
- Affected specs: `copy-execution`
- Affected code: `src/services/copy-trading-execution-service.ts`, mutex utilities
