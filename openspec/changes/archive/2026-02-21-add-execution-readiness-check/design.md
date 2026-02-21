## Context
There is an interactive setup script, but operators need a quick, repeatable, non-interactive readiness check to validate execution prerequisites before starting the worker.

## Goals / Non-Goals
- Goals:
  - Provide a CLI script that validates readiness for real copy-trading execution.
  - Check RPC health/failover selection, proxy existence, balances, allowances, and guardrail status.
- Non-Goals:
  - Automatically fix issues or perform approvals/deposits.

## Decisions
- Decision: Implement `scripts/verify/copy-trading-readiness.ts` with clear output and exit codes.
- Decision: Reuse existing services where possible for checks.

## Risks / Trade-offs
- Additional RPC calls; acceptable for preflight only.

## Migration Plan
No schema changes required.
