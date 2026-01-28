## Context
Multiple copy-trading entry points (worker, detect API, supervisor/simulators) compute copy size from trade.size. The system assumes size is shares, but upstream feeds may emit notional sizing. We need an explicit, configurable interpretation to avoid mis-sized orders.

## Goals / Non-Goals
- Goals:
  - Explicitly interpret incoming trade size as SHARES or NOTIONAL.
  - Normalize trade size into (shares, notional) before copy size calculation.
  - Default to SHARES to preserve current behavior.
- Non-Goals:
  - Redesign of strategy profiles or copy sizing logic.
  - New UI workflows beyond optional config exposure.

## Decisions
- Decision: Add `tradeSizeMode` to `CopyTradingConfig` with default `SHARES`.
- Decision: Introduce a helper to compute `tradeShares` and `tradeNotional` and reuse it across worker/detect paths.
- Decision: Copy size calculations use `tradeNotional` as the base value; share calculations use `tradeShares` when needed.

## Risks / Trade-offs
- Adds configuration complexity; defaults mitigate behavior changes.
- Requires updating multiple code paths to avoid inconsistent sizing.

## Migration Plan
1) Add `tradeSizeMode` to Prisma schema with default `SHARES`.
2) Update copy-trading execution paths to normalize size before sizing.
3) Backfill existing configs implicitly via default.

## Open Questions
- Should UI expose `tradeSizeMode` or keep as hidden/advanced setting?
