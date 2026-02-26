# 托管理财闭环收口实施计划（2026-02-26）

## 1. 目标闭环定义
目标不是“页面可下单”，而是完整闭环可审计：

1. 用户完成注册、入金、模式激活与托管授权。
2. 用户选择策略与周期后一键订阅，系统完成本金占用与执行映射。
3. 平台按策略自动分配目标交易员并执行跟单，且持仓、收益、风控按订阅维度隔离。
4. 到期后先真实清仓，再结算，再分润，再营销分账，全部走统一幂等链路。
5. 全链路可追溯（谁、何时、按什么规则、产生什么结果），并可通过监控发现偏差。

## 2. 当前差距（基于代码审计）

### P0 级差距（必须先补）

1. 交易员分配仍是静态主模板，不是“算法+随机匹配”
- 证据：
  - `web/scripts/workers/managed-wealth-worker.ts:80` 只取 `product.agents[0]`。
  - `web/scripts/workers/managed-wealth-worker.ts:105` / `web/scripts/workers/managed-wealth-worker.ts:106` 固定 10%/20% 交易参数。
  - `web/prisma/seed-managed-wealth.ts:174` / `web/prisma/seed-managed-wealth.ts:193` 只按创建时间取 3 个模板并固定权重。
- 风险：不同用户配置趋同，无法体现“策略随机匹配顶尖交易员”承诺。

2. 订阅级隔离未闭环，持仓与净值有串仓风险
- 证据：
  - `web/prisma/schema.prisma:1052` `UserPosition` 唯一键仅 `walletAddress + tokenId`。
  - `web/scripts/workers/managed-wealth-worker.ts:192` / `web/scripts/workers/managed-wealth-worker.ts:517` 以钱包维度查持仓。
  - `web/app/api/managed-subscriptions/[id]/withdraw/route.ts:146` 赎回时也按钱包维度查仓位。
- 风险：同钱包多订阅、自由仓与托管仓、不同策略会互相污染收益与风控判断。

3. 结算分润链路不统一，营销分账只覆盖手动提现
- 证据：
  - 手动提现路径调用分润：`web/app/api/managed-subscriptions/[id]/withdraw/route.ts:320`。
  - 批量结算路径无分润调用：`web/app/api/managed-settlement/run/route.ts`（无 `affiliateEngine`）。
  - Worker 自动结算同样无分润调用：`web/scripts/workers/managed-wealth-worker.ts:363` 起的结算事务。
- 风险：同样盈利，因结算入口不同导致营销收益不一致。

4. 到期清仓仍有模拟成交，不是可审计的真实执行
- 证据：
  - `web/scripts/workers/managed-wealth-worker.ts:557` 写入 `SYSTEM_LIQUIDATOR`。
  - `web/scripts/workers/managed-wealth-worker.ts:565` 使用 `sim-liquidation-*` 虚拟 txHash。
- 风险：结算价格与可执行价格偏离，影响收益公平性与审计可信度。

### P1 级差距（稳定后补）

5. “资金授权 -> 本金占用 -> 执行额度”缺少硬关联账本
- 现状：
  - 已有授权记录与入金账本：
    - `web/app/api/participation/custody-auth/route.ts`
    - `web/app/api/participation/funding/route.ts`
  - 订阅创建时未建立“本金占用/释放”专项账本，也未校验可用托管余额。
- 风险：规则层“托管资金”与执行层“可下单资金”缺少一一对齐。

6. 收益矩阵主要用于展示，缺少策略偏离监控
- 现状：矩阵查询与 UI 估算已接入，但结算依旧只按实际权益计算。
- 风险：对外收益区间与实际结果长期偏离时，缺少自动告警与治理机制。

### P2 级差距（运营化）

7. 缺少端到端可观测与对账告警
- 缺少统一追踪：订阅 -> 分配 -> 执行 -> 净值 -> 结算 -> 营销分账。
- 缺少关键告警：到期未清仓、已结算未分润、收益偏离矩阵、分配过度集中。

8. 种子与脚本体验不一致，容易误操作
- 证据：
  - 历史提交 `007182175ef4aaabd612a32d3ff32ed824802a23` 仍使用 `frontend/*` 路径。
  - 当前有效工程在 `web/*`，且 `web/package.json` 无 `seed:agents`。
  - `ManagedReturnMatrix` 表来自迁移：`web/prisma/migrations/20260225162000_add_participation_program_m1/migration.sql:115`。
- 风险：未执行迁移直接 seed 会报表不存在，脚本入口也容易输错路径。

## 3. 分阶段实施计划

### Phase A（1-1.5 周）: 先把资金与结算链路做成“强一致”
1. 统一结算服务 `managed-settlement-service`
- 所有入口统一走一套函数：手动提现、worker 自动结算、admin 批量结算。
- 同步触发利润费分发，且加幂等键避免重复结算重复分账。

2. 清仓链路从“模拟成交”改为“真实执行”
- 清仓失败时状态保持 `LIQUIDATING`，记录失败原因与重试计划。
- 结算只对“清仓完成”的订阅执行。

3. 补充关键告警
- `MATURED` 超时未结算、`LIQUIDATING` 超时未完成、分润失败重试。

### Phase B（1.5-2.5 周）: 做“订阅级隔离”和“算法分配”
1. 订阅级执行隔离
- 新增执行作用域键（建议 `executionScopeId = subscriptionId`）。
- 持仓、净值、风控、清仓全部按 `subscriptionId` 聚合，不再按钱包裸聚合。

2. 交易员分配引擎
- 候选池来源：`leaderboard-cache + trader-scoring + smart-money-discovery`。
- 规则：按策略画像筛选 -> 风险阈值过滤 -> 加权随机分配（可复现实验 seed）。
- 产物：落库分配快照（候选列表、分值、随机种子、最终权重、版本号）。

3. 多交易员组合执行
- 支持单订阅映射多 `CopyTradingConfig`。
- 周期内支持最小扰动再平衡（只替换失效或风控不达标交易员）。

### Phase C（1-1.5 周）: 做托管资金硬账本与SLA
1. 托管本金占用账本
- 订阅创建时冻结本金，结算/取消时释放。
- 订阅金额不得超过“托管可用余额”。

2. 策略偏离与SLA
- 定义按策略/周期/档位的偏离阈值。
- 偏离超阈值进入运营工单与产品风控面板。

3. 运营与审计报表
- 按日输出订阅级：收益、回撤、清仓滑点、分润状态、推荐奖励状态。

## 4. 关键数据模型改造建议
建议新增或扩展以下模型：

1. `ManagedSubscriptionAllocation`
- `subscriptionId`, `agentId`, `traderAddress`, `weight`, `scoreSnapshot`, `seed`, `version`, `status`

2. `ManagedPrincipalReservation`
- `subscriptionId`, `walletAddress`, `reservedAmount`, `releasedAmount`, `status`

3. `UserPosition` 扩展作用域
- 增加 `executionScopeId`（或新增 `ManagedPosition`），唯一键改为 `walletAddress + executionScopeId + tokenId`

4. `ManagedSettlementExecution`
- 记录每次结算执行与分润状态，提供幂等保证与重试依据

## 5. 前端改造建议（与后端并行）
1. 市场页继续保留“档位 + 周期 + 三策略”主交互，弱化冗余说明区块。
2. 订阅弹窗明确展示：
- 当前档位范围
- 最低申购金额
- 真实执行提示（清仓后结算）
3. 详情页展示“分配快照”摘要：
- 当前分配交易员
- 权重
- 最近调仓时间

## 6. 验收与测试

### 核心验收
1. 同钱包两个托管订阅互不串仓、互不串收益。
2. 手动提现/自动结算/admin结算三条路径分润结果一致。
3. 结算前必须完成真实清仓，不再出现模拟 txHash。
4. 分配引擎同输入可复现、不同用户可差异化。

### 测试清单
1. 单测：分配算法、分润幂等、作用域持仓聚合。
2. 集成：订阅创建 -> 执行 -> 到期清仓 -> 结算 -> 分润。
3. E2E：用户一键订阅与到期结算全链路。
4. 压测：多订阅并发下 NAV 与结算正确性。

## 7. 发布与回滚
1. 分三次灰度：Phase A -> Phase B -> Phase C。
2. 每阶段上线前必须通过：
- `tsc --noEmit`
- 关键集成测试
- 结算对账脚本
3. 回滚策略：
- 保留旧 worker 分支入口（feature flag）
- 结算服务保持可重放与幂等

## 8. 立即可执行的运维动作
1. 先执行迁移再 seed（避免 `ManagedReturnMatrix` 缺表）：
```bash
cd web
npx prisma migrate deploy
npx prisma generate
npm run seed:participation-program
npm run seed:managed-wealth
```
2. 若需种子 AGENT 模板，当前正确路径是：
```bash
cd web
npx tsx prisma/seed-agents.ts
```
3. 后续建议补充脚本别名：`npm run seed:agents`。

