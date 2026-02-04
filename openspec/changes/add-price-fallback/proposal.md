# Change: Add Quote Fallback for Price Fetching

## Why
Orderbook reads can fail or return empty on thin markets, causing executions to skip even when a recent price is available. A controlled fallback improves resilience while preserving safety with strict TTL and slippage guards.

## What Changes
- Add a fallback price source when orderbook quotes are unavailable (e.g., Gamma price or recent trade price).
- Require fallback quotes to respect the same max TTL (<= 5s) and slippage validation.
- Log the chosen price source for observability.

## Impact
- Affected specs: `copy-trading`
- Affected code: `scripts/copy-trading-worker.ts`
