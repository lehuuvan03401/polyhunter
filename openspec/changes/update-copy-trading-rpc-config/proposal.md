# Change: Update Copy Trading RPC Configuration

## Why
Copy-trading execution currently hardcodes a public Polygon RPC in the worker and server execution route, which limits speed and reliability for real-time trading. Operators need to configure a faster RPC or provider without changing code.

## What Changes
- Add explicit RPC configuration for copy-trading execution via env (e.g., `COPY_TRADING_RPC_URL`).
- Use the configured RPC in worker and server-side execution routes.
- Log the effective RPC selection for visibility.

## Impact
- Affected specs: `copy-execution`
- Affected code: copy-trading worker, server execution route, verification scripts.
