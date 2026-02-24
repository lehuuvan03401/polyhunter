# Change: Add daily SELL accounting reconciliation

## Why
Even with fill-based settlement, external API gaps or legacy records can still leave SELL accounting drift in persisted copy-trade records. Operations need an automated reconciliation loop to detect and correct discrepancies.

## What Changes
- Add a supervisor scheduled reconciliation task for recent SELL trades.
- Recompute fill notional from CLOB order fill data when available.
- Correct persisted SELL `copySize` / `copyPrice` when discrepancy exceeds threshold.
- Emit audit events for reconciled trades.

## Impact
- Affected specs: `copy-trading`
- Affected code:
  - `web/scripts/workers/copy-trading-supervisor.ts`
  - `sdk/src/services/trading-service.ts`
  - `sdk/src/core/trade-orchestrator.ts`
