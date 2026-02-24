# Change: Enforce strict price sourcing for mempool copy sizing

## Why
Mempool path currently uses a hardcoded placeholder price (`0.5`) for sizing. This can materially distort notional sizing and bypass intended risk controls.

## What Changes
- Use strict side-aware orderbook price for mempool signals.
- Allow short-lived cache fallback only when available.
- Reject mempool execution when no valid price is available.
- Record audit events for rejected mempool signals due to missing price.

## Impact
- Affected specs: `copy-trading`
- Affected code: `web/scripts/workers/copy-trading-supervisor.ts`
