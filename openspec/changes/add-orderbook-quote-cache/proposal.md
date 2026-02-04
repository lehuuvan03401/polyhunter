# Change: Add Orderbook Quote Cache and In-Flight Deduplication

## Why
During bursts of copy-trade signals on the same token, the worker performs redundant orderbook fetches. This adds latency and RPC/API load, which can delay execution. We need a short-lived cache and in-flight deduplication to reuse the same quote within a small window and avoid duplicate concurrent fetches.

## What Changes
- Add a short TTL cache for orderbook-derived executable prices per token+side.
- Deduplicate in-flight quote requests so multiple signals share the same promise.
- Preserve existing price TTL semantics (max 5s) and slippage guard behavior.

## Impact
- Affected specs: `copy-trading`
- Affected code: `scripts/copy-trading-worker.ts` (price fetching path), potential shared cache utility.
