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
- [complete] V1-V9 日考核快照引擎（规则映射 + API + 快照落库）
- [pending] 平级奖结算链路（1代4% / 2代1%）
- [pending] 双区晋升指标与进度 API
- [complete] 平级奖结算链路（1代4% / 2代1%，含幂等账本）
- [pending] 双区晋升指标与进度 API
- [pending] 全球合伙人席位体系
- [complete] 双区晋升指标与进度 API（实时查询 + 管理员快照）
- [pending] 全球合伙人席位体系

## M3 实施进展（全球合伙人席位）
- [complete] 全球合伙人数据模型与迁移（席位、月榜、淘汰、退款、配置）
- [complete] 席位上限控制与补位价格配置（`/api/partners/config` + `/api/partners/seats`）
- [complete] 月度排名与末位淘汰（`/api/partners/cycle/eliminate`，含 dry-run）
- [complete] 同月重复淘汰保护（防止误操作导致超额淘汰）
- [complete] 退款进度与状态流转（`/api/partners/refunds`，含状态保护）
- [complete] 权益映射与后台权限开关（`/api/partners/privileges`）
- [complete] 月榜查询接口（`/api/partners/rankings`）

## M1/M2 补强进展（计费与推荐奖励）
- [complete] 推荐奖励共享引擎抽象（参与激活与托管订阅复用，单次幂等）
- [complete] 参与激活流程接入一代直推 +1 天延展逻辑
- [complete] 托管提现结算接入盈利费分发触发（仅盈利触发，不阻断提现主流程）
- [complete] 会员价格与折扣单测补齐（88/228 + MCN 5 折）
- [complete] 净入金聚合单测补齐（充值-提现、团队聚合、负净入金场景）
- [complete] 会员单活跃约束加固（钱包级事务锁，防并发双开）
- [complete] 1天新人试用逻辑抽离与单测化（可复用、可回归）

## 运维交付进展
- [complete] 全球合伙人月度淘汰与退款 SLA runbook
- [complete] operations 索引接入 runbook 入口

## 策略一致性进展（3.1）
- [complete] 参与策略解析统一（API 改为复用 participation strategy parser）
- [complete] managed-wealth 卡片/订阅弹窗策略视觉语义统一（共享主题常量）
- [complete] managed-wealth 页面过滤项改为复用策略常量，移除硬编码
- [complete] proxy 策略选择与 copy-trader 模板映射复用统一策略标签

## 管理后台进展（7.4）
- [complete] 新增合伙人治理后台页（席位配置、月度淘汰 dry-run/执行、退款处理）
- [complete] 现有 admin dashboard 增加 Partners Ops 入口跳转

## 前端规则展示进展（7.3）
- [complete] 新增 managed 正式外宣规则展示组件（通道/门槛/周期/费率/安全边界/收益矩阵）
- [complete] 新增 affiliate 正式外宣规则展示组件（直推奖励/净入金/V1-V9/平级奖/全球席位）
- [complete] managed-wealth 与 affiliate/rules 页面完成规则组件接入

## 集成验证进展（8.2）
- [complete] 新增参与激活集成测试（注册-激活顺序、托管门槛、直推奖励一次性保护）
- [complete] 新增合伙人淘汰/退款集成测试（月度淘汰、重复执行拦截、退款状态机护栏）

## E2E 验证进展（8.3）
- [complete] 新增参与机制 E2E（FREE/MANAGED 规则展示 + 托管门槛申购流）
- [complete] 新增合伙人操作 E2E（淘汰 dry-run/execute + 退款完成流）
- [complete] 处理 E2E 暴露的构建阻断（affiliate-engine prisma 导入路径）

## OpenSpec 收口进展
- [complete] 归档 `add-horus-participation-partner-program` 到 `openspec/changes/archive/2026-02-26-add-horus-participation-partner-program`
- [complete] 将 participation/global-partner 规范沉淀到 `openspec/specs/*`
- [complete] 执行 `openspec validate --all --strict --no-interactive` 全量校验

---

# 任务计划：Horus参与机制与全球合伙人计划（缺口收口）

## 目标
- 推进上一轮“部分实现”条款收口，形成对外规则与系统行为一致的可发布版本。

## 分阶段
- [complete] 阶段 1：收口计划固化（OpenSpec change + 执行计划文档）
- [complete] 阶段 2：P0 硬约束实现（席位上限、托管硬门槛、平级奖默认、费路隔离）
- [complete] 阶段 3：P1 自动化与边界校验（淘汰调度、退款 SLA 看门狗、FREE 边界）
- [in_progress] 阶段 4：验证与发布闸门（单测/集成/E2E + runbook）

## 本轮交付
- OpenSpec 变更：`harden-horus-participation-partner-policy`
- 计划文档：`docs/plans/2026-02-26-horus-participation-partner-gap-closure-plan.md`
- 阶段 2 进展（P0-1）：已实现全球席位上限 100 不可增发约束（后端归一化 + 配置接口拒绝 >100 + 管理台只读展示 + 集成测试）。
- 阶段 2 进展（P0-2/P0-3/P0-4 部分）：已实现托管门槛生产默认强制、平级奖生产默认开启策略（含生产关闭审计日志）、利润费重复结算防重。
- 阶段 2 进展（P1 边界前置）：已实现 FREE 模式托管订阅边界拦截与 custody-auth MANAGED-only 约束，并补齐集成测试。
- 阶段 3 进展（P1 自动化）：已新增月末淘汰触发脚本与退款 SLA 看门狗脚本，并接入运行文档与 npm scripts。
- 阶段 2 收口补强：新增参与利润费 scope 解析与显式作用域参数，非参与费路事件将被审计跳过，避免冲突费路重复计费。
- 阶段 3 收口补强：抽象合伙人自动化纯函数库并新增单测，覆盖“同月淘汰幂等跳过”与“退款 SLA 逾期告警阈值”。
- 阶段 3 边界补强：`/api/participation/custody-auth` 要求账户已处于 `MANAGED` 模式，拒绝 FREE/未激活账户进入托管授权链路。

---

# 任务计划：托管理财闭环差距分析与实施规划（2026-02-26）

## 目标
- 深度审计“托管理财”从订阅到结算分润的全链路闭环，识别当前未闭环功能点。
- 输出可直接执行的阶段化实施计划，并沉淀到 OpenSpec 变更草案。

## 分阶段
- [complete] 阶段 1：审计现状代码与规范（worker/API/schema/spec）
- [complete] 阶段 2：提炼 P0/P1/P2 缺口并形成证据链
- [complete] 阶段 3：输出实现路线文档（研发/测试/上线策略）
- [complete] 阶段 4：创建 OpenSpec 变更草案并完成严格校验

## 本次交付
- 计划文档：`docs/plans/2026-02-26-managed-wealth-closed-loop-plan.md`
- OpenSpec 变更：`openspec/changes/close-managed-wealth-loop`
  - `proposal.md`
  - `tasks.md`
  - `design.md`
  - `specs/managed-wealth/spec.md`
  - `specs/fee-logic/spec.md`
  - `specs/participation-program/spec.md`
- OpenSpec 校验：`openspec validate close-managed-wealth-loop --strict --no-interactive` 已通过。
- 实施进展（Phase A，已完成）：
  - 新增统一结算服务：`web/lib/managed-wealth/managed-settlement-service.ts`
  - `withdraw` / `managed-settlement/run` / `managed-wealth-worker` 三入口统一复用结算写路径
  - `managed-settlement/run` 新增“有持仓则转 `LIQUIDATING` 并跳过结算”防护
  - `managed-settlement/run` 与 worker 补齐盈利分润触发，语义与 `withdraw` 对齐

## 实施状态（闭环落地）
- [complete] Phase A：统一结算与分润语义（提交：`3d9dc1b`）
- [in_progress] Phase B：持仓/NAV/清仓从钱包维度切换到订阅维度（执行隔离）
- [in_progress] Phase C：托管闭环运维可见性（健康检查接口 + 管理后台面板）

### Phase B 当前进度
- [complete] 新增订阅维度持仓模型 `ManagedSubscriptionPosition`（schema + migration）
- [complete] managed 关键入口改为按 `subscriptionId` 判定未平仓（withdraw / settlement-run / managed-worker）
- [complete] 交易执行链路新增 managed 持仓写入（`TradeOrchestrator` 侧按 `copyConfigId` 解析订阅作用域并写入 scoped position）
- [complete] 新增历史持仓回填脚本（`backfill:managed-positions`）
- [complete] 迁移期 fallback（scoped 为空时按 copyTrade token 集合回退 legacy position）接入 withdraw/run/worker
- [complete] 新增订阅持仓对账脚本（`verify:managed-positions:scope`）用于读切换前校验
- [pending] 生产读切换前回填验证与对账

### Phase C 当前进度
- [complete] 新增托管闭环健康检查接口：`GET /api/managed-settlement/health`（allocation status / liquidation backlog / settlement commission parity）
- [complete] 新增管理后台 `Managed Ops` 页面：`/dashboard/admin/managed-wealth`，并接入 admin dashboard 快捷入口
- [complete] 新增路由集成测试：`web/app/api/managed-settlement/health.integration.test.ts`
- [pending] 接入告警通知与定时巡检脚本（将 health 指标接入现有运维看门狗）

## 错误记录
| 时间 | 位置 | 错误 | 处理 |
|---|---|---|---|
| 2026-02-26 | `rg` 查询 | 复杂正则导致 `repetition quantifier expects a valid decimal` | 拆分为多条精确 `rg -n` 查询 |
