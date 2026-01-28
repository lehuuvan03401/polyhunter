# Change: Add Copy Trade Allowance Precheck

## Why
Copy-trading executions can fail when proxy allowances for USDC or CTF tokens are not set, causing avoidable order failures and retries. A preflight allowance check improves reliability and reduces failed transactions.

## What Changes
- Add allowance checks for proxy USDC (BUY) and CTF approval (SELL) before execution.
- Provide clear skip/error reasons when allowance is missing.
- Reuse allowance checks across worker/detect execution paths where applicable.

## Impact
- Affected specs: `copy-execution`
- Affected code: copy-trading worker, execution service, and server execution route.
