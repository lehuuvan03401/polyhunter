# Change: Enforce minLiquidity and minVolume filters with TTL market metrics cache

## Why
Supervisor currently only enforces `maxOdds`, leaving `minLiquidity` and `minVolume` ineffective. This increases slippage risk and avoidable failed executions.

## What Changes
- Implement market metrics fetch for filters (side-aware orderbook depth + Gamma volume/liquidity).
- Add TTL cache and in-flight deduplication for filter metrics.
- Enforce `minLiquidity` and `minVolume` in `passesFilters`.
- Reject filtered trades when required metrics are unavailable.

## Impact
- Affected specs: `copy-trading`
- Affected code: `web/scripts/workers/copy-trading-supervisor.ts`
