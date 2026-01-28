# Change: Add Execution Retry Queue

## Why
Transient RPC failures or chain congestion can cause copy-trade execution to fail even when conditions are otherwise valid. A bounded retry queue improves resilience.

## What Changes
- Add a retry queue for failed executions with backoff and max attempts.
- Persist retry state to avoid duplicate execution.
- Provide logs for retry attempts and outcomes.

## Impact
- Affected specs: `copy-execution`
- Affected code: worker execution flow, database (if needed).
