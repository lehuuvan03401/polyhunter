# Change: Add execution safety controls for proxy-mode trading

## Why
Running real copy-trading on Polygon with Proxy execution requires stronger operational guardrails to reduce risk from misconfiguration, runaway volume, or unauthorized execution.

## What Changes
- Add an emergency pause switch that blocks all real executions and records guardrail events.
- Add execution limits (max trade size, per-wallet daily cap, global daily cap, max trades per window, optional per-market cap).
- Enforce execution worker allowlist checks before submitting on-chain actions.
- Persist guardrail trigger events for audit/monitoring.
- Add a dry-run execution toggle for validating live signals without submitting transactions.

## Impact
- Affected specs: copy-execution, storage
- Affected code: guardrail service, copy-trading worker/execution service, Prisma schema, env config/docs
