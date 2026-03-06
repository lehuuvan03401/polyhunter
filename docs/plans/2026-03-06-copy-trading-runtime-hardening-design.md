# Copy Trading Runtime Hardening Design

## Context

当前跟单交易已经形成三条并行链路：`web/scripts/workers/copy-trading-worker.ts`、`web/scripts/workers/copy-trading-supervisor.ts`、`web/app/api/copy-trading/execute/route.ts`。三条链路共享部分底层执行能力，但对 `CopyTrade`、`UserPosition`、结算恢复、市场结算与报销账本的推进语义并不一致。

已确认的核心问题包括：
- SELL 后剩余仓位的 `totalCost` 不递减，导致成本基础和后续 PnL 漂移。
- API 执行链路只更新 `CopyTrade` 状态，不更新持仓账本与收益语义。
- `ReimbursementLedger`、stale `PENDING` expiration、market resolution 等恢复逻辑在不同运行时中分散实现。
- Supervisor 的 guardrail 在高并发场景下缺少额度预留，存在被 burst fanout 冲穿的可能。

## Goals

- 将 Supervisor + Orchestrator + ExecutionService 定义为唯一自动执行主链。
- 修复跟单持仓和 PnL 的账本正确性，统一所有执行入口的账务语义。
- 将恢复闭环收敛到 authority runtime，包括 stale `PENDING`、`SETTLEMENT_PENDING`、延迟报销与市场结算。
- 提升 guardrail 在并发执行下的正确性和可观测性。

## Non-Goals

- 不在本轮重写 UI 或配置页面。
- 不修改合约接口或引入新的链上执行模式。
- 不重做 signal ingestion 架构；现有 hybrid ingestion 继续沿用。

## Recommended Architecture

### 1. Runtime Authority

自动执行统一由 Supervisor 驱动。`copy-trading-worker.ts` 从“可直接上线的自动执行 worker”降级为兼容/实验脚本；`execute/route.ts` 只保留人工确认或运维入口，但执行结果必须委托到同一套账本写入与恢复逻辑，不能继续维护独立状态机。

### 2. Accounting Model

`TradeOrchestrator` 不再直接手写 `UserPosition` SQL 语义，而是通过统一的 position accounting 模块处理：
- BUY：增加 `balance`，增加 `totalCost`，重算 `avgEntryPrice`
- SELL：减少 `balance`，按卖出份额比例减少 `totalCost`，保留剩余仓位均价
- 所有入口共用一套 realized PnL/position mutation 逻辑

### 3. Recovery Ownership

Supervisor 成为恢复闭环的唯一所有者：
- 过期 `PENDING` 回收
- `SETTLEMENT_PENDING` 重试
- deferred reimbursement ledger flush/retry
- market resolution / redeem / worthless settlement

旧 worker 中已有的过期回收和 ledger 批量报销逻辑只作为迁移素材，不继续保留为独立生产路径。

### 4. Guardrail Reservation

额度和频率 guardrail 由“检查已执行结果”升级为“先预留，再执行，再结算”模型：
- dispatch 前占用 reservation
- 成功执行后转为 committed usage
- skipped/failed/released queue item 释放 reservation

这样可以避免多个并发 trade 在读到相同用量后同时通过检查。

## Workstreams

### Workstream A: Accounting Integrity

修复 SELL 成本基础和 API 执行漏记账问题，确保 `CopyTrade`、`UserPosition`、`realizedPnL` 的语义在所有入口一致。

### Workstream B: Runtime Authority

明确 supervisor 为自动执行 source of truth，兼容入口只做代理或人工触发，不再维护独立执行状态。

### Workstream C: Recovery and Guardrails

将 stale pending、reimbursement ledger、market resolution 和 reservation-safe guardrails 收敛到 supervisor runtime。

## Risks and Mitigations

- 风险：迁移 authority runtime 时，新旧进程并行可能导致重复执行。
  - 缓解：先加 feature flag 和 “compatibility route delegates only” 保护，再下线旧自动执行入口。

- 风险：账本修正会暴露历史脏数据。
  - 缓解：先提供 backfill / reconciliation 脚本，再切换新的 accounting writer。

- 风险：guardrail reservation 增加状态复杂度。
  - 缓解：优先以 Redis/DB 中的短 TTL reservation 实现，失败路径显式释放并补充 metrics。

## Validation Strategy

- 单测：SELL 部分卖出后的 `balance/totalCost/avgEntryPrice`；API 与 supervisor 入口共用 accounting writer。
- 集成测试：`PENDING -> EXECUTED/FAILED/SETTLEMENT_PENDING/EXPIRED` 状态转换。
- 恢复测试：ledger flush、settlement recovery、market resolution/redeem。
- 并发测试：guardrail reservation 在 burst fanout 下不突破限额。

## Rollout

1. 先修账本正确性并加回填/校验脚本。
2. 将 execute API 改为委托 authority runtime。
3. 在 supervisor 中补齐 recovery 闭环。
4. 灰度运行 supervisor-only 自动执行，观测 metrics 与账本对齐。
5. 下线旧 worker 自动执行职责并更新文档/启动脚本。
