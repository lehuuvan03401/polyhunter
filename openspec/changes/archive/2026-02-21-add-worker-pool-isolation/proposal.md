# Change: Add Worker Pool and Fund Isolation

## Why
Running multiple workers against real money needs clearer isolation to avoid nonce contention, double execution, and shared fund risk. A pool model with explicit worker assignment improves stability and safety.

## What Changes
- Add support for a pool of worker keys with per-worker assignment.
- Allow isolating execution to a specific worker per config or per process.
- Add visibility into which worker executed each trade.

## Impact
- Affected specs: `copy-execution`
- Affected code: worker/supervisor execution flow, execution service, copy-trade records.
