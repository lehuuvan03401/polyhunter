# Change: Harden EOA execution service cache lifecycle

## Why
`UserExecutionManager` keeps decrypted EOA-backed `TradingService` instances in memory without expiration. Long-lived resident credentials increase blast radius during memory leak or host compromise scenarios.

## What Changes
- Add TTL-based expiration for cached EOA `TradingService` instances.
- Add periodic sweep to evict stale cache entries.
- Refresh last-access timestamp on cache hits.
- Clear cached EOA services on graceful shutdown.

## Impact
- Affected specs: `copy-trading`
- Affected code: `web/scripts/workers/copy-trading-supervisor.ts`
