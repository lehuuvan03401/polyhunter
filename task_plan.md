# 任务计划：核心代码深度分析与中文注释

## 目标
- 深入分析项目核心执行链路，补全关键流程/关键逻辑的中文注释。
- 注释要解释“为什么这样做”和“失败时如何回滚”，不仅描述代码字面行为。

## 范围
- `src/services/trading-service.ts`
- `src/services/market-service.ts`
- `src/services/smart-money-service.ts`
- `src/services/copy-trading-execution-service.ts`
- `src/core/tx-monitor.ts`
- `src/core/tx-mutex.ts`

## 分阶段
- [complete] 阶段 1：梳理核心链路与注释策略
- [complete] 阶段 2：补充交易与市场数据主流程注释（Trading/Market）
- [complete] 阶段 3：补充智能资金与复制执行注释（SmartMoney/CopyExecution）
- [complete] 阶段 4：补充并发与交易监控注释（TxMutex/TxMonitor）
- [complete] 阶段 5：构建验证与交付说明
- [complete] 阶段 6：补充 Worker 与 API 端到端流程注释（Execution/Config/Detect/Readiness）
- [complete] 阶段 7：补充查询与风控聚合链路注释（Orders/Positions/Metrics/Guardrail/Supervisor）
- [complete] 阶段 8：补充配置控制面注释（Supervisor/Worker Env 配置 + SmartMoney 筛选评分）
- [complete] 阶段 9：补充核心服务尾段注释（Trading/Market/CopyExec/TxMutex/TxMonitor 深化）
- [complete] 阶段 10：补充核心服务前半段注释（初始化/缓存/地址路由/守卫入口）
- [complete] 阶段 11：补充阈值与降级语义注释（Readiness/Spread/Execution Fallback）

## 注释策略
1. 入口注释：说明模块职责与上下游依赖。
2. 流程注释：在关键函数内标出阶段（预检、执行、回滚、结算）。
3. 风险注释：解释并发锁、滑点、授权、资金回流等风险控制点。
4. 约束注释：写明与 Polymarket/CLOB/CTF 相关的业务约束。

## 错误记录
| 时间 | 位置 | 错误 | 处理 |
|---|---|---|---|
| - | - | 暂无 | - |

---

# 任务计划：Horus参与机制与全球合伙人计划（需求整理）

## 目标
- 将市场部门“正式对外版”规则转化为可开发、可验收、可排期的任务结构。
- 对齐现有 `managed-wealth`、`managed-membership`、`affiliate`、`fee-logic` 能力，避免重复建设。
- 形成 OpenSpec 变更草案，作为研发评审与拆期依据。

## 分阶段
- [complete] 阶段 1：需求归并（按参与机制/收费/推荐激励/等级分红/合伙人席位拆分）
- [complete] 阶段 2：现有能力盘点（代码 + Prisma + API + OpenSpec）
- [complete] 阶段 3：差距识别与边界定义（已实现 vs 待新增）
- [complete] 阶段 4：制定开发任务（数据模型、API、Worker、前端、运营）
- [complete] 阶段 5：输出 OpenSpec 变更并通过校验

## 关键交付
1. OpenSpec 变更：`add-horus-participation-partner-program`
2. 变更文件：
   - `openspec/changes/add-horus-participation-partner-program/proposal.md`
   - `openspec/changes/add-horus-participation-partner-program/tasks.md`
   - `openspec/changes/add-horus-participation-partner-program/design.md`
   - `openspec/changes/add-horus-participation-partner-program/specs/participation-program/spec.md`
   - `openspec/changes/add-horus-participation-partner-program/specs/fee-logic/spec.md`
   - `openspec/changes/add-horus-participation-partner-program/specs/affiliate-system/spec.md`
   - `openspec/changes/add-horus-participation-partner-program/specs/global-partner-program/spec.md`

## 风险与待确认
- “托管”与现有非托管执行边界需要法务与风控口径统一（授权范围、可撤销性、审计证据）。
- “1天免费体验”是否仅豁免订阅费，还是同时豁免业绩费，需要产品确认。
- 月度“末位淘汰”需要明确并列排名 tie-break 与时区结算口径。

## 错误记录
| 时间 | 位置 | 错误 | 处理 |
|---|---|---|---|
| - | - | 暂无 | - |

## 本次续推进（M1/M2/M3 排期化）
- [complete] 将 `add-horus-participation-partner-program` 任务映射为里程碑交付计划
- [complete] 输出按里程碑的人天估算与关键依赖
- [complete] 给出发布闸门（Gate A/B/C）和建议团队编制

里程碑文档：
- `openspec/changes/add-horus-participation-partner-program/roadmap.md`

## M1 实施进展（第一批）
- [complete] Participation Program 数据模型 + 迁移（账户/入金/净入金/等级快照/收益矩阵）
- [complete] 参与规则与激活基础 API（rules/account/funding）
- [complete] 固定 20% 盈利收费率改造（AffiliateEngine）
- [complete] 托管最小本金 500U 入口约束 + 可选激活闸门
- [pending] V1-V9 日考核引擎与平级奖结算
- [pending] 全球合伙人席位体系
- [complete] 托管授权留痕能力（模型 + API + 入口可选校验）
- [complete] 托管可选周期收敛（managed-products list/detail + seed 对齐）
