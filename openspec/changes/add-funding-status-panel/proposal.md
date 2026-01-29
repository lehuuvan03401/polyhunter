# Change: Add funding/allowance auto-checks and status panel

## Why
Users running real copy trading need immediate visibility into wallet funds and approvals. Today these checks are manual and script-driven, which slows setup and causes failed executions.

## What Changes
- Add a server-side readiness check endpoint that reports balances, allowances, and required actions for a wallet/proxy.
- Add a portfolio UI panel that auto-refreshes readiness and prompts deposits/approvals when insufficient.
- Log and surface actionable guardrail reasons (low funds/allowance) for real-trading readiness.

## Impact
- Affected specs: portfolio-api, portfolio-ui, copy-execution
- Affected code: copy trading API routes, frontend portfolio dashboard, worker guardrail logging
