# Change: Settle SELL proceeds using actual fill notional

## Why
The execution flow currently returns SELL proceeds to proxy using an approximate notional (`attemptAmount`) instead of the order's actual filled notional. Over time this can create proxy/bot accounting drift.

## What Changes
- Extend market-order result enrichment to fetch fill details from CLOB order/trade records.
- Use actual SELL filled notional for proxy settlement transfers.
- Propagate actual SELL proceeds and filled shares into orchestrator write-path so persisted trade accounting reflects execution reality.

## Impact
- Affected specs: `copy-trading`
- Affected code:
  - `sdk/src/services/trading-service.ts`
  - `sdk/src/services/copy-trading-execution-service.ts`
  - `sdk/src/core/trade-orchestrator.ts`
