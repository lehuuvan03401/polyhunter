# Change: Fix Copy Trading Accounting Integrity

## Why

当前跟单执行在不同入口上对 `UserPosition`、`CopyTrade` 和 realized PnL 的更新不一致。尤其是 SELL 后剩余仓位的 `totalCost` 未按比例递减，会导致成本基础和收益统计持续漂移。

## What Changes

- 为 copy trading 建立统一的 position accounting 语义
- 修复 SELL 后剩余仓位成本基础错误
- 让 API/server-side execution 与 supervisor/orchestrator 共享同一套账本更新逻辑
- 增加历史仓位成本修复与校验方案

## Impact

- Affected specs: `copy-trading`
- Affected code:
  - `sdk/src/core/trade-orchestrator.ts`
  - `web/lib/services/position-service.ts`
  - `web/app/api/copy-trading/execute/route.ts`
  - copy-trading related tests and reconciliation scripts
