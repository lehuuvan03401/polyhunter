# Change: Fix supervisor guardrail enforcement in execution pipeline

## Why
The supervisor defines execution guardrails (`EMERGENCY_PAUSE`, allowlist, per-wallet and global limits, dry-run) but does not enforce them on the main `processJob -> executeJobInternal` path. This can allow jobs to be queued or executed when they should be blocked.

## What Changes
- Enforce guardrails before queue admission in `processJob`.
- Re-validate guardrails immediately before execution in `executeJobInternal` to cover queue lag and changing limits.
- Increment guardrail counters after successful executions to keep rolling limits accurate.

## Impact
- Affected specs: `copy-trading`
- Affected code: `web/scripts/workers/copy-trading-supervisor.ts`
