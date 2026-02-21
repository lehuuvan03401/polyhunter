# Verification Notes: Scoped Tx Mutex

## Manual Checks
- Same signer serialization:
  - Trigger two concurrent executions using the same worker key.
  - Expect logs: `[CopyExec] ⏳ Waiting on signer mutex ... queue=...` and no nonce collisions.
- Different signer parallelism:
  - Run two workers with different keys in parallel.
  - Expect independent execution without blocking on a global mutex.

## Expected Outcome
- No nonce collision errors for same signer.
- Reduced latency for concurrent trades across different signers.
