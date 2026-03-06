# Findings & Decisions

## Requirements
- 结合 [copy-trading-logic.md](/Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/docs/operations/copy-trading-logic.md) 与实际代码分析项目中的跟单交易逻辑。
- 说明主业务链路、关键状态、执行与补偿设计。
- 判断还有哪些环节需要完善，最好能指出代码位置。

## Research Findings
- 已确认本次任务属于研究/审查型任务，需要跨文档与实现核对。
- 已加载 `using-superpowers` 与 `planning-with-files` 两个流程性 skill，并建立持久化计划文件。
- `docs/operations/copy-trading-logic.md` 将当前跟单架构描述为基于 Supervisor/Worker 的执行管道，包含预写 `PENDING`、并行预检、Smart Buffer、Debt Recovery、Stale Pending Expiration 和 `TxMonitor`。
- 代码入口初步集中在 `web/scripts/workers/copy-trading-supervisor.ts`、`web/scripts/workers/copy-trading-worker.ts`、`web/app/api/copy-trading/*`、`web/lib/services/guardrail-service.ts` 以及 Prisma 相关模型/迁移。
- `copy-trading-supervisor.ts` 是当前主实现，包含队列、去重、guardrail 计数器、仓位缓存、分片、polling/WS hybrid 摄取、结算恢复、卖出对账等大量运行时逻辑；`copy-trading-worker.ts` 更像旧版单体 worker，仍保留独立监听与结算实现。
- Supervisor 已暴露出关键分析点：`handleTransfer`/`handleSniffedTx`/`handleActivityTrade` 负责信号摄取，`checkQueue`/`processJob`/`executeJobInternal` 负责执行，`recoverPendingSettlements` 和 `runSellAccountingReconciliation` 负责补偿。
- Prisma 模型显示当前跟单状态主要围绕 `CopyTrade` 展开：`status`、`retryCount`、`nextRetryAt`、`lockedAt`、`lockedBy`、`expiresAt` 被用于执行状态机和恢复流程。
- 账务上存在两层“欠款/报销”模型：`DebtRecord` 记录 bot 对 proxy 的欠款追偿；`ReimbursementLedger` 与单笔 `CopyTrade` 一对一，用于延迟报销、重试与结算状态跟踪。
- `GuardrailService` 与 supervisor 文件内的 guardrail 逻辑都存在，后续需要确认是否出现规则重复、统计口径漂移或运行时分叉。
- `TradeOrchestrator` 是 supervisor 与 `CopyTradingExecutionService` 之间的核心桥梁：它负责过滤、盘口保护、`PENDING` 预写、执行调用，以及把结果落到 `CopyTrade` 和 `UserPosition`。
- Orchestrator 里 `PENDING -> EXECUTED/FAILED/SETTLEMENT_PENDING` 的状态流基本成立；其中 proxy 模式下只要 settlement 延迟或确认缺失，就会写成 `SETTLEMENT_PENDING`，再由 supervisor 的恢复任务补做。
- `CopyTradingExecutionService` 的真实执行模型是“预检并行 + signer/proxy 双层 mutex + CLOB FOK 下单 + 资金归集/回滚”，BUY 支持 bot float，SELL 支持 proxy signature 优化与未卖出份额退回。
- `copy-trading-worker.ts` 仍保留一套独立的监听/结算/持仓删除逻辑，而 supervisor + orchestrator 已经形成另一套更完整的状态机；这提示存在双实现长期漂移的风险。
- `web/package.json` 仍暴露 `copy-worker:speed -> web/scripts/workers/copy-trading-worker.ts`，而没有 supervisor 启动脚本；从仓库入口看，旧 worker 仍是默认可执行路径，当前主实现到底是哪套并不清晰。
- `web/app/api/copy-trading/execute/route.ts` 还保留了第三条手动执行链路，能够直接 claim `CopyTrade` 并调用 `executeOrderWithProxy`，这意味着系统中至少有“API 手动执行 / web worker / supervisor”三套状态推进方式。
- `web/scripts/workers/copy-trading-worker.ts` 的结算逻辑在市场结算时直接新建 `CopyTrade` 并删除 `UserPosition`，没有沿用 supervisor 的 `SETTLEMENT_PENDING + recovery` 流程，因此如果两套进程并存，账务语义会分叉。
- `ReimbursementLedger` 在 schema 中已落库，但当前 `web` supervisor 路径未见写入或 flush；完整批量报销逻辑仅出现在 `sdk/scripts/copy-trading-worker.ts`，与 `web` 运行路径脱节。
- `TradeOrchestrator` 在卖出成功后直接用原始 SQL upsert `UserPosition`，只减少 `balance`，不减少 `totalCost`；这会把剩余仓位均价抬高，进而污染后续收益计算。
- `web/app/api/copy-trading/execute/route.ts` 的 server-side/manual 执行分支只更新 `CopyTrade` 状态，不更新 `UserPosition`、`realizedPnL` 或其他仓位账本；如果这条链路被使用，SELL 跟单和收益统计会与 worker/supervisor 路径脱节。
- Supervisor 的额度/频率 guardrail 是“先检查已执行总量，成功后再 increment counter”，没有做额度预留或原子 claim；在 burst fanout 下，多笔交易可能同时通过 guardrail，随后一起把实际用量冲过上限。
- 旧 worker 已实现市场结算监听与 `redeemPositions`，但 supervisor 里只看到了 `SETTLEMENT_PENDING` 恢复，没有看到市场 resolution 监听；如果运行时迁到 supervisor，需要补齐赢家赎回/归零结算链路。
- 文档里提到的 stale `PENDING` expiration 只在 `sdk/scripts/copy-trading-worker.ts` 旧链路里明确出现（带 `expiresAt` 和过期扫描）；当前 orchestrator/supervisor 自动执行链写 `PENDING` 时没有同等过期回收逻辑，崩溃窗口下仍可能留下悬空记录。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 以 `copy-trading-logic.md` 作为业务视角入口，再向代码反查 | 文档能提供术语和流程，代码决定真实行为 |
| 最终按“发现问题 -> 开放问题/假设 -> 链路总结”输出 | 符合 review 型请求，用户更容易直接使用 |
| 优化方案采用“3 change + 1 design + 1 implementation plan”结构 | 既符合 OpenSpec，又能把问题拆成可审批、可落地的执行单元 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
- `/Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/docs/operations/copy-trading-logic.md`
- `/Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/docs/plans/2026-03-06-copy-trading-runtime-hardening-design.md`
- `/Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/docs/plans/2026-03-06-copy-trading-runtime-hardening.md`
- `/Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/openspec/changes/fix-copy-trading-accounting-integrity/proposal.md`
- `/Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/openspec/changes/refactor-copy-trading-runtime-authority/proposal.md`
- `/Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/openspec/changes/harden-copy-trading-recovery-guardrails/proposal.md`
- `/Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/web/scripts/workers/copy-trading-supervisor.ts`
- `/Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/web/scripts/workers/copy-trading-worker.ts`
- `/Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/web/lib/services/guardrail-service.ts`
- `/Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/task_plan.md`
- `/Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/findings.md`
- `/Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/progress.md`

## Visual/Browser Findings
- 本轮未使用浏览器或图像工具。
