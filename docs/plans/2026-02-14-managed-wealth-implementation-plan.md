# Managed Wealth MVP 实施计划（模拟盘）

- 日期：2026-02-14
- 关联设计：`docs/plans/2026-02-14-managed-wealth-design.md`
- 关联 OpenSpec：`openspec/changes/add-managed-wealth-mvp`

## 里程碑

## M1：数据与基础接口（3-4 天）

### 交付
1. Prisma 模型与 migration（ManagedProduct/Term/Subscription/Nav/Settlement/ReserveLedger/RiskEvent）。
2. 基础列表与详情 API：
- `GET /api/managed-products`
- `GET /api/managed-products/:id`
3. 种子脚本：默认策略和期限档位。

### 验收
1. 本地 migration 可执行。
2. 产品列表和详情 API 返回字段齐全。
3. 支持按策略与期限筛选。

## M2：申购与运行态（4-5 天）

### 交付
1. 申购 API：`POST /api/managed-subscriptions`。
2. 订阅列表 API：`GET /api/managed-subscriptions`。
3. 执行映射：申购单绑定独立 copy-trading config。
4. NAV 快照任务与查询 API：`GET /api/managed-subscriptions/:id/nav`。

### 验收
1. 同一产品多用户申购互不影响。
2. NAV 可连续更新并可视化。
3. 风控事件可记录到库。

## M3：到期结算与准备金（4-5 天）

### 交付
1. 到期扫描和结算任务：`POST /api/managed-settlement/run`。
2. 结算查询：`GET /api/managed-settlements/:subscriptionId`。
3. 高水位分成计算。
4. 保守型保底补差与 `ReserveFundLedger` 记账。
5. 准备金覆盖率阈值与保底申购自动暂停。

### 验收
1. 保守型低于保底线时正确补差。
2. 稳健/激进不触发补差。
3. 结算任务幂等（重复触发不重复扣款/补差）。

## M4：前端完整体验（4-6 天）

### 交付
1. 托管理财入口与产品市场页。
2. 产品详情页（条款、风险、保底说明、分成规则）。
3. 申购流程（风险确认与条款确认）。
4. 我的托管页（净值、回撤、剩余期限、结算历史）。
5. 披露策略呈现（默认透明 + 延迟披露）。

### 验收
1. 新手 3 步内完成申购。
2. 运行中可查看净值/回撤/明细。
3. 到期后结算明细可追溯。

## M5：测试与灰度发布（2-3 天）

### 交付
1. 单元测试：分成、保底补差、HWM。
2. 集成测试：申购->运行->到期全链路。
3. E2E：页面主流程。
4. feature flag 与白名单灰度。
5. 运维 runbook（准备金与应急开关）。

### 验收
1. 测试通过率达标。
2. 灰度环境完成一个完整期限循环（建议先 7 天配置用于验证）。

## 角色分工建议

1. 后端/数据：模型、API、任务流、结算引擎。
2. 前端：产品页、详情页、我的托管、结算展示。
3. 平台/运维：定时任务、监控告警、feature flag。
4. 产品/运营：期限收益参数、分成比例、准备金阈值。

## 风险前置清单

1. 准备金覆盖率告警阈值未定。
2. 保底条款文案需法律/合规复核。
3. 价格源异常时 NAV 延迟展示策略需明确。

## 启动顺序（建议）

1. 先合并 OpenSpec 提案并评审通过。
2. 先做 M1+M2 打通运行态。
3. 再做 M3 核心结算。
4. 最后做 M4 UI 完整化与 M5 发布。
