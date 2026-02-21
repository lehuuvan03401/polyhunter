# Change: Add Execution Whitelist Guardrails

## Why
Real-money copy trading needs stricter operational control to prevent unintended execution against non-approved wallets or oversized trades. A whitelist and per-trade cap reduce blast radius.

## What Changes
- Add an allowlist for wallet addresses permitted to execute real trades.
- Add a per-trade maximum notional cap (USD).
- Return explicit skip reasons when blocked.

## Impact
- Affected specs: `copy-execution`
- Affected code: copy-trading worker, server execution route, guardrail utilities.
