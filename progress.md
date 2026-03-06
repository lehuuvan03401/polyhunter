# 进度日志

## 2026-02-18
- 完成 OpenSpec 与技能流程检查。
- 完成核心模块定位与首轮代码阅读。
- 已创建计划与发现文件，进入注释实施阶段。
- 已完成以下核心文件中文注释增强：
  - `src/services/trading-service.ts`
  - `src/services/market-service.ts`
  - `src/services/smart-money-service.ts`
  - `src/services/copy-trading-execution-service.ts`
  - `src/core/tx-mutex.ts`
  - `src/core/tx-monitor.ts`
- 已执行 `pnpm run build`，TypeScript 编译通过。
- 第二批已完成以下文件中文注释增强：
  - `scripts/copy-trading-worker.ts`
  - `web/app/api/copy-trading/execute/route.ts`
  - `web/app/api/copy-trading/config/route.ts`
  - `web/app/api/copy-trading/detect/route.ts`
  - `web/app/api/copy-trading/readiness/route.ts`
- 已执行 `web` lint：失败（仓库已有大量历史 lint 问题，非本次注释改动引入）。
- 第三批已完成以下文件中文注释增强：
  - `web/app/api/copy-trading/orders/route.ts`
  - `web/app/api/copy-trading/positions/route.ts`
  - `web/app/api/copy-trading/metrics/route.ts`
  - `web/lib/services/guardrail-service.ts`
  - `web/scripts/copy-trading-supervisor.ts`
- 已再次执行 `pnpm run build`，TypeScript 编译通过。
- 第四批已完成以下文件中文注释增强：
  - `web/scripts/copy-trading-supervisor.ts`（配置区分组注释增强）
  - `scripts/copy-trading-worker.ts`（配置区分组注释增强）
  - `src/services/smart-money-service.ts`（候选筛选与评分口径注释增强）
- 已再次执行 `pnpm run build`，TypeScript 编译通过。
- 第五批已完成以下文件中文注释增强：
  - `src/services/trading-service.ts`（订单管理/奖励/授权细节注释增强）
  - `src/services/market-service.ts`（信号检测与归一化流程注释增强）
  - `src/services/copy-trading-execution-service.ts`（动态滑点模型注释增强）
  - `src/core/tx-mutex.ts`（队列与观测语义注释增强）
  - `src/core/tx-monitor.ts`（跟踪与替换链路注释增强）
- 已再次执行 `pnpm run build`，TypeScript 编译通过。
- 第六批已完成以下文件中文注释增强：
  - `src/services/trading-service.ts`（初始化/缓存/本地模式注释增强）
  - `src/services/market-service.ts`（初始化/重试/历史解析入口注释增强）
  - `src/services/copy-trading-execution-service.ts`（地址路由/守卫入口注释增强）
  - `src/core/tx-mutex.ts`（isLocked 使用语义注释增强）
  - `src/core/tx-monitor.ts`（confirm 语义注释增强）
- 已再次执行 `pnpm run build`，TypeScript 编译通过。

## 2026-02-19
- 第七批已完成以下文件中文注释增强：
  - `web/app/api/copy-trading/readiness/route.ts`（RPC 选择、降级容错、动作阈值口径注释增强）
  - `src/services/market-service.ts`（历史/实时 spread 语义边界与信号阈值注释增强）
  - `src/services/copy-trading-execution-service.ts`（Executor 代理执行、锁分层、AUTO 滑点与结算 fallback 注释增强）
- 已执行 `pnpm run build`，TypeScript 编译通过。

## 2026-02-24
- 新增 Supervisor 分片模式 Redis 强依赖：当 `SUPERVISOR_SHARD_COUNT>1` 时，缺少 `REDIS_URL` 将启动失败（fail fast）。
- 新增 Supervisor 分片模式 Redis 连通性强校验：Redis 初始化/PING 失败将启动失败（fail fast），不再回退内存队列/去重/计数。
- 保持单实例模式（`SUPERVISOR_SHARD_COUNT<=1`）兼容：Redis 不可用时仍允许内存回退。
- 新增 OpenSpec 变更：`enforce-redis-sharded-supervisor`（proposal/tasks/spec delta）。
- 已执行 `cd web && npx tsc --noEmit`，通过。
- 已执行 `openspec validate enforce-redis-sharded-supervisor --strict --no-interactive`，通过。
- 新增 EOA 执行服务缓存生命周期加固：`UserExecutionManager` 支持 `SUPERVISOR_EOA_SERVICE_TTL_MS` 与周期 sweep（`SUPERVISOR_EOA_SERVICE_SWEEP_INTERVAL_MS`），超时自动驱逐。
- 新增 EOA 缓存命中续期机制：每次复用服务都会刷新 `lastAccessAt`。
- 新增优雅退出清理：`SIGINT/SIGTERM` 走 `shutdown()`，退出前清空 EOA 缓存。
- 新增 OpenSpec 变更：`harden-eoa-service-cache-lifecycle`（proposal/tasks/spec delta）。
- 已执行 `cd web && npx tsc --noEmit`，通过。
- 已执行 `openspec validate harden-eoa-service-cache-lifecycle --strict --no-interactive`，通过。
- 新增 Supervisor 运维级 SLO 观测：队列 `p95` lag、reject reason 分布、per-wallet success/fail/skip、reconcile 差额汇总。
- 新增执行结果统一记账：`success/failed/skipped` 在执行主路径统一打点，避免仅统计失败导致的成功率失真。
- 新增 OpenSpec 变更：`add-supervisor-operational-slo-metrics`（proposal/tasks/spec delta）。
- 已执行 `cd web && npx tsc --noEmit`，通过。
- 已执行 `openspec validate add-supervisor-operational-slo-metrics --strict --no-interactive`，通过。
- 新增 Supervisor 自动降载（load shedding）状态机：`NORMAL/DEGRADED/CRITICAL`，基于队列深度与队列 p95 lag 阈值自动切换。
- 新增动态 fanout 并发上限：高负载自动降低订阅分发并发，恢复后自动回升（带恢复窗口 hysteresis）。
- 新增 mempool 自动暂停闸门：降载模式下暂停 mempool dispatch，避免拥塞扩大。
- 修复/接通 mempool 回调：`MempoolDetector` 回调已接入 `handleSniffedTx` 执行链路。
- 新增 OpenSpec 变更：`add-supervisor-auto-load-shedding`（proposal/tasks/spec delta）。
- 已执行 `cd web && npx tsc --noEmit`，通过。
- 已执行 `openspec validate add-supervisor-auto-load-shedding --strict --no-interactive`，通过。
- 新增 Supervisor 内置指标服务：支持 `/metrics`（Prometheus 文本格式）与 `/health`/`/healthz`。
- 新增累计型观测计数器：执行结果、队列动作、拒单原因、reconcile 差额、告警次数等，避免仅窗口统计导致趋势不可见。
- 新增运行时阈值告警：队列深度、队列 p95 lag、reject rate、`CRITICAL` 降载模式触发告警，并有冷却时间防止刷屏。
- 指标服务已接入启动与优雅退出生命周期（start/shutdown）。
- 新增 OpenSpec 变更：`add-supervisor-metrics-endpoint-alerts`（proposal/tasks/spec delta）。
- 已执行 `cd web && npx tsc --noEmit`，通过。
- 已执行 `openspec validate add-supervisor-metrics-endpoint-alerts --strict --no-interactive`，通过。
- 新增 Stage1 监控落地模板：`deploy/stage1/monitoring/prometheus/prometheus.supervisor.yml`（Prometheus scrape）与 `deploy/stage1/monitoring/grafana/dashboards/copy-trading-supervisor.json`（Grafana dashboard）。
- 新增监控落地文档：`deploy/stage1/monitoring/README.md` 与 `docs/operations/deploy-supervisor-monitoring.md`，并更新 `deploy/stage1/README.md`、`docs/operations/README.md` 索引入口。
- 新增 OpenSpec 变更：`add-supervisor-monitoring-templates`（proposal/tasks/spec delta）。
- 已执行 `jq empty deploy/stage1/monitoring/grafana/dashboards/copy-trading-supervisor.json`，通过。
- 已执行 `openspec validate add-supervisor-monitoring-templates --strict --no-interactive`，通过。
- 已执行 `cd web && npx tsc --noEmit`，通过。
- 新增 `SETTLEMENT_PENDING` 自动恢复闭环：Supervisor 增加抢锁扫描 + `recoverSettlement` 执行 + 指数退避重试 + 超限失败落库（避免无限 pending）。
- 新增 Settlement Recovery 指标：Prometheus 暴露 `copy_supervisor_settlement_recovery_*`（runs/recovered/failed/exhausted/window）。
- 新增恢复循环配置：`SUPERVISOR_SETTLEMENT_RECOVERY_*`、`COPY_TRADING_SETTLEMENT_*`、`COPY_TRADING_LOCK_TTL_MS`。
- 新增 OpenSpec 变更：`add-supervisor-settlement-recovery-loop`（proposal/tasks/spec delta）。
- 已执行 `cd web && npx tsc --noEmit`，通过。
- 已执行 `openspec validate add-supervisor-settlement-recovery-loop --strict --no-interactive`，通过。
- 新增 Supervisor 队列 ack/reclaim 语义：`claim/ack/nack` + processing lease + stale reclaim，避免“出队后进程崩溃”导致任务丢失。
- Redis 队列新增 processing/inflight 结构；内存队列补齐 in-flight 回收语义，行为对齐。
- 新增队列恢复指标：`copy_supervisor_queue_total{action="reclaimed"}` 与摘要日志 `reclaimed` 统计。
- 新增 OpenSpec 变更：`add-supervisor-queue-ack-reclaim`（proposal/tasks/spec delta）。
- 已执行 `cd web && npx tsc --noEmit`，通过。
- 已执行 `openspec validate add-supervisor-queue-ack-reclaim --strict --no-interactive`，通过。
- 新增 Supervisor 队列投递上限与 DLQ：`SUPERVISOR_QUEUE_MAX_ATTEMPTS`、`SUPERVISOR_QUEUE_DLQ_MAX_SIZE`，超限任务进入 dead-letter，不再无限回队。
- 新增 Queue DLQ 观测：`copy_supervisor_queue_total{action="dead_lettered"}`、`copy_supervisor_queue_dlq_size`，并接入 `SUPERVISOR_ALERT_QUEUE_DLQ_SIZE` 告警阈值。
- 新增 OpenSpec 变更：`add-supervisor-queue-dlq-attempt-limits`（proposal/tasks/spec delta）。
- 已执行 `cd web && npx tsc --noEmit`，通过。
- 已执行 `openspec validate add-supervisor-queue-dlq-attempt-limits --strict --no-interactive`，通过。
- 新增 DLQ 运维工具脚本：`web/scripts/verify/supervisor-dlq-ops.ts`，支持 `stats/peek/replay/purge`、过滤参数与 `--dry-run`。
- 新增 DLQ 运维 SOP：`docs/operations/sop-supervisor-dlq.md`，并在 `docs/operations/README.md` 增加入口。
- 新增 OpenSpec 变更：`add-supervisor-dlq-ops-tool`（proposal/tasks/spec delta）。
- 已执行 `cd web && npx tsc --noEmit`，通过。
- 已执行 `openspec validate add-supervisor-dlq-ops-tool --strict --no-interactive`，通过。
## Session: 2026-03-06 Implementation

### Task 2: Position Accounting Integrity
- **Status:** complete
- Actions taken:
  - 新增 `sdk/src/core/position-accounting.ts` 与测试，固定 BUY/SELL 成本核算规则。
  - 修复 `web/lib/services/position-service.ts` 的 SELL 成本递减逻辑，并补齐单测。
  - 新增 `sdk/src/core/user-position-ledger.ts`，统一 API / orchestrator 的 `UserPosition` 写账语义。
  - 将 `sdk/src/core/trade-orchestrator.ts` 切换到共享 ledger helper，并在成功 SELL 时回写 `realizedPnL`。
  - 新增 `web/scripts/db/backfill-copy-trading-position-cost-basis.ts` 与 `web/package.json` 脚本，用于历史 `UserPosition.totalCost` 漂移回填。
- Files created/modified:
  - `sdk/src/core/position-accounting.ts` (created)
  - `sdk/src/core/position-accounting.test.ts` (created)
  - `sdk/src/core/user-position-ledger.ts` (created)
  - `sdk/src/core/trade-orchestrator.ts` (updated)
  - `web/lib/services/position-service.ts` (updated)
  - `web/lib/services/position-service.test.ts` (created)
  - `web/scripts/db/backfill-copy-trading-position-cost-basis.ts` (created)
  - `web/package.json` (updated)

### Task 3: Execution Entry Point Ledger Semantics
- **Status:** complete
- Actions taken:
  - 重构 `web/app/api/copy-trading/execute/route.ts`，让 manual/server execution 成功路径统一在事务中更新 `CopyTrade`、`UserPosition` 和 `realizedPnL`。
  - 扩展 API 兼容字段：`executedAmount`、`executedPrice`、`filledShares`、`actualSellProceedsUsdc`。
  - 扩展 `sdk/src/services/copy-trading-execution-service.ts` 返回 `executionPrice`，为 API 记账提供更准确的成交价。
  - 为 execute route 增加 manual BUY、manual SELL、server-side BUY 回归测试，验证执行成功后仓位与 PnL 同步更新。
- Files created/modified:
  - `web/app/api/copy-trading/execute/route.ts` (updated)
  - `web/app/api/copy-trading/execute/route.test.ts` (updated)
  - `sdk/src/services/copy-trading-execution-service.ts` (updated)
  - `sdk/src/services/copy-trading-execution-service.test.ts` (updated)

### Task 4: Supervisor Runtime Authority
- **Status:** complete
- Actions taken:
  - 将 `web/package.json` 的默认高速脚本切到 supervisor，并保留显式 `copy-worker:legacy` 入口。
  - 为 `web/scripts/workers/copy-trading-worker.ts` 增加 `COPY_TRADING_LEGACY_WORKER_ALLOWED=true` 启动门禁，明确其为兼容脚本。
  - 将 `deploy/stage1/Dockerfile.worker` 默认命令切到 supervisor。
  - 在 `deploy/stage1/docker-compose.yml` 中把 legacy `copy-worker` 放入 `legacy-copy-worker` profile，避免默认启动集合里同时跑两套自动执行器。
  - 更新 `docs/operations/copy-trading-logic.md`，把 authority runtime 改写为 `supervisor -> orchestrator -> execution service`，并明确旧 worker 只保留兼容用途。
- Files created/modified:
  - `web/package.json` (updated)
  - `web/scripts/workers/copy-trading-worker.ts` (updated)
  - `deploy/stage1/Dockerfile.worker` (updated)
  - `deploy/stage1/docker-compose.yml` (updated)
  - `docs/operations/copy-trading-logic.md` (updated)

### Task 5: Recovery Closure into Supervisor
- **Status:** complete
- Actions taken:
  - 新增 `sdk/src/core/copy-trade-lifecycle.ts` 与测试，统一 `PENDING` 过期时间计算；orchestrator 预写 `CopyTrade` 时开始写入 `expiresAt`。
  - 扩展 `sdk/src/services/copy-trading-execution-service.ts` 返回 `proxyAddress` 与 `executorAddress`，让 authority runtime 能在成功交易后稳定写入 `ReimbursementLedger`。
  - 将 `trade-orchestrator` 的 deferred reimbursement 路径接回 ledger ownership，避免当前 authority runtime 下只存在旧 sdk worker 的批量报销闭环。
  - 在 `web/scripts/workers/copy-trading-supervisor.ts` 中补上 stale `PENDING` 过期回收、ledger claim/flush/retry、market resolution queue、Gamma 校验后的 winner redeem / loss settlement，以及定时 reconciliation fallback。
  - 新增 `sdk/src/core/copy-trade-settlement.ts` 与测试，把 outcome -> token 映射和 `WIN/LOSS` 判定抽成可验证模块，供 supervisor 的 settlement loop 复用。
- Files created/modified:
  - `sdk/src/core/copy-trade-lifecycle.ts` (created)
  - `sdk/src/core/copy-trade-lifecycle.test.ts` (created)
  - `sdk/src/core/copy-trade-settlement.ts` (created)
  - `sdk/src/core/copy-trade-settlement.test.ts` (created)
  - `sdk/src/core/trade-orchestrator.ts` (updated)
  - `sdk/src/services/copy-trading-execution-service.ts` (updated)
  - `sdk/src/services/copy-trading-execution-service.test.ts` (updated)
  - `web/scripts/workers/copy-trading-supervisor.ts` (updated)

## Verification Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| `npx vitest run app/api/copy-trading/execute/route.test.ts lib/services/position-service.test.ts` | `web` targeted tests | Route and position accounting regressions pass | 6 tests passed | passed |
| `npx vitest run src/core/position-accounting.test.ts src/services/copy-trading-execution-service.test.ts` | `sdk` targeted tests | Accounting + execution service pass | 16 tests passed | passed |
| `npx vitest run src/core/copy-trade-lifecycle.test.ts src/core/copy-trade-settlement.test.ts src/services/copy-trading-execution-service.test.ts` | `sdk` targeted tests | Lifecycle + settlement helpers + execution service pass | 18 tests passed | passed |
| `npx tsc --noEmit -p tsconfig.json` | `sdk` typecheck | No TypeScript errors | Exit code 0 | passed |
| `node -e "const pkg=require('./package.json'); ..."` | `web/package.json` scripts | Default runtime points to supervisor, legacy path explicit | `copy-worker:speed -> copy-supervisor:speed` | passed |
| `npx tsc --noEmit -p tsconfig.json` | `web` typecheck | Project typecheck status | Fails on pre-existing `@privy-io/react-auth` missing types / implicit any outside this task | blocked |
| `npx tsc --noEmit -p tsconfig.json --pretty false` + grep touched files | `web` typecheck triage | No new TypeScript errors in touched copy-trading runtime files | No matches for `copy-trading-supervisor`, `copy-trade-settlement`, `copy-trade-lifecycle`, `copy-trading-execution-service`, `trade-orchestrator` | passed |
