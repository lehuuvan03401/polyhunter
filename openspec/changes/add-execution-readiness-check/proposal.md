# Change: Add Execution Readiness Check Script

## Why
Running real copy-trading via scripts requires a fast, deterministic way to verify prerequisites (RPC health, proxy, balances, allowances, guardrails). Today this is manual and error-prone.

## What Changes
- Add a non-interactive readiness check script for real copy-trading execution.
- Validate RPC health/failover, proxy existence, balances, allowances, and guardrails.
- Provide clear pass/fail output and actionable warnings.

## Impact
- Affected specs: `copy-execution`
- Affected code: scripts (verification utilities).
