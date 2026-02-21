# Verification Notes: Proxy-Scoped Execution Queue

## Manual Checks
- Same proxy serialization:
  - Trigger two concurrent executions targeting the same proxy.
  - Expect logs: `[CopyExec] ⏳ Waiting on proxy mutex ...` and no overlapping fund/settlement operations.

- Different proxies parallelism:
  - Trigger two concurrent executions targeting different proxies.
  - Expect both to proceed without waiting on the same proxy mutex.

## Expected Outcome
- No interleaving of fund pulls/returns for the same proxy.
- Parallel execution across different proxies remains possible.
