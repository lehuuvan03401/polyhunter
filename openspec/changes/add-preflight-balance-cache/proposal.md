# Change: Add Preflight Balance/Allowance Cache

## Why
The worker performs multiple on-chain reads per trade (proxy USDC balance, bot USDC balance, allowance, CTF balance). During bursts this causes redundant RPC calls and adds latency before execution. A short-lived cache with in-flight deduplication reduces RPC load while keeping safety intact.

## What Changes
- Add a short TTL cache (<= 2s) for preflight balance/allowance reads per proxy and token.
- Deduplicate in-flight reads so concurrent signals reuse the same promise.
- Limit cache use to preflight checks only; execution-time transfers still read live state.

## Impact
- Affected specs: `copy-trading`
- Affected code: `scripts/copy-trading-worker.ts`
