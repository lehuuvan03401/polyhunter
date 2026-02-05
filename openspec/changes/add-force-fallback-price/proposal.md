# Change: Force fallback pricing in copy-trading worker

## Why
Fallback pricing exists but is difficult to validate when orderbook access succeeds. A controlled flag is needed to verify fallback behavior in local and staging environments.

## What Changes
- Add an environment flag to force the worker to skip orderbook quotes and use fallback pricing for verification.
- Log when forced fallback mode is enabled.

## Impact
- Affected specs: copy-trading
- Affected code: scripts/copy-trading-worker.ts
