# Change: Add Scoped Transaction Mutex for Execution

## Why
The current global transaction mutex serializes all on-chain execution within a process, even when trades target different worker signers. This limits throughput and increases latency during bursts, despite there being no nonce collision risk across distinct signers.

## What Changes
- Replace the global singleton mutex with a scoped mutex map keyed by signer address.
- Keep serialized execution per signer to avoid nonce collisions while allowing parallel execution across distinct workers.
- Add metrics/logs for queue depth per signer to monitor contention.

## Impact
- Affected specs: `copy-execution`
- Affected code: `src/core/tx-mutex.ts`, `src/services/copy-trading-execution-service.ts`
