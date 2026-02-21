# Change: Add Hybrid Signal Ingestion (WebSocket + Polling)

## Why
Upstream `poly-sdk` has shifted Smart Money ingestion from Activity WebSocket to Data API polling because the WS activity stream is not consistently reliable in production. Our project currently depends on WebSocket-first ingestion in critical copy-trading paths, creating upgrade risk and potential signal loss during upstream sync.

## What Changes
- Introduce configurable signal ingestion modes for copy-trading supervisor/runtime:
  - `WS_ONLY`
  - `POLLING_ONLY`
  - `HYBRID` (WS fast path + polling reconciliation)
- Add polling-based signal source using Data API with adaptive interval and cursor-based incremental fetch.
- Keep WebSocket path as optional low-latency source in hybrid mode (non-blocking fallback behavior).
- Unify dedup across channels with stable event key strategy (`txHash + logIndex` preferred).
- Persist polling cursor/watermark to storage for restart-safe recovery.
- Add lag/health metrics for both channels and mismatch detection metrics.

## Impact
- Affected specs: `copy-trading`, `storage`
- Affected code:
  - `web/scripts/copy-trading-supervisor.ts`
  - `scripts/copy-trading-worker.ts`
  - polling/dedup utilities
  - Prisma schema + migration for cursor persistence
  - runbooks and verification scripts
