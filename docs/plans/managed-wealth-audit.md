# Managed Wealth 实现完整性审计报告

> **审计日期**: 2026-03-02 · **范围**: 全部 managed-wealth 相关前端、后端、Worker 代码

---

## 🔴 Critical — 功能缺失 / 业务逻辑漏洞

### 1. 会员支付未接入真实扣款

**位置**: [membership route](file:///Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/web/app/api/managed-membership/route.ts#L127-L248)

- `POST /api/managed-membership` 创建会员时，**直接创建记录、不做任何链上扣款验证**
- 用户选择 USDC 或 MCN 支付，但代码只记录价格，不检查余额、不发起转账
- 等于**任何人都可以白嫖会员**，只需要发个 POST 请求

```diff
- // 当前：直接 INSERT，没有支付验证
- const insertedRows = await tx.$queryRaw`INSERT INTO "ManagedMembership" ...`
+ // 应该：先验证链上代币余额 → 发起转账/授权 → 确认到账 → 再创建记录
```

> [!CAUTION]
> 这是最严重的业务逻辑漏洞。上线前必须接入真实支付流程（链上 USDC/MCN 转账确认）。

### 2. 认购本金无链上资金验证

**位置**: [subscriptions route](file:///Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/web/app/api/managed-subscriptions/route.ts#L350-L697)

- 创建认购时，只检查了 `managedQualifiedBalance`（入金记录余额），但**没有验证链上实际资金是否到位**
- 依赖 `NetDepositLedger` 记录来判断"有多少钱"，但这个账本可能与链上实际余额不一致
- 结算退款同样没有链上转账逻辑

> [!WARNING]
> 如果入金记录被误操作或不同步，可能导致"超额认购"——用户实际账户余额不足但仍能认购。

### 3. 结算退款无实际资金转回

**位置**: [withdraw route](file:///Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/web/app/api/managed-subscriptions/%5Bid%5D/withdraw/route.ts) / [settlement service](file:///Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/web/lib/managed-wealth/managed-settlement-service.ts)

- 结算完成后状态标记为 `SETTLED`，计算了 `finalPayout`
- 但**没有将 USDC 实际转回给用户的链上操作**
- 目前整个结算只是"记账"，不是"真正退钱"

---

## 🟠 High — 功能不完整

### 4. CANCELLED 状态无实现

**现象**: 
- Prisma schema 和 API 过滤器都有 `CANCELLED` 状态
- 前端 membership 页面有 CANCELLED 过滤
- 但**没有任何 API 或 UI 可以取消一个认购**
- Worker 也不处理 CANCELLED 状态

**影响**: 如果管理员需要取消一个异常认购，没有标准途径操作。

### 5. 风险事件系统未完成

**现象**:
- Withdraw 端点在高回撤时会创建 `managedRiskEvent` 记录
- 但**整个项目中只有 withdraw 一处写入**
- 没有：
  - 管理员查看风险事件的 API
  - 前端风险监控仪表板
  - 基于风险事件的自动止损/通知逻辑

### 6. 产品详情 API 泄露订阅信息

**位置**: [product detail route](file:///Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/web/app/api/managed-products/%5Bid%5D/route.ts#L115-L125)

- `GET /api/managed-products/[id]` 是**公开 API**（无鉴权）
- 但返回值包含 `subscriptions` 字段：最近 5 个认购的 `id`, `status`, `principal`, `createdAt`
- 任何人可以看到某产品最近的认购金额和状态

### 7. 交易历史缺少游标分页

**位置**: [transactions route](file:///Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/web/app/api/managed-subscriptions/transactions/route.ts)

- 只有 `limit` 参数，没有 `cursor` / `offset` 游标
- 如果用户有大量认购，无法翻页查看完整历史
- 当前是：取最近 N 个认购 → 展开为事件 → 排序。如果 `limit` 不够大，会丢失早期记录

---

## 🟡 Medium — 边界情况 / 健壮性

### 8. 并发认购无频率限制

- 创建认购 API 使用了 `pg_advisory_xact_lock` 防止试用和本金预留冲突
- 但**没有任何频率限制**（Rate Limiting）
- 恶意用户可以在短时间内发送大量认购请求，虽然本金可能不够，但会浪费数据库资源

### 9. Worker 无健康监控指标

- `managed-wealth-worker` 和 `managed-liquidation-worker` 只输出 console.log
- 没有：
  - Prometheus/StatsD 指标暴露
  - 连续错误报警
  - 循环时间超限告警
  - 死信任务监控

### 10. ensureExecutionMappings 候选人不含所有 RUNNING

**位置**: [managed-wealth-worker.ts L91-L133](file:///Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/web/scripts/workers/managed-wealth-worker.ts#L91-L133)

- 只查询 `copyConfigId: null` 或 `executionTargets.none { isActive: true }` 或 `allocations.some { version > 1 }`
- 如果所有条件都不满足的 RUNNING 认购（已有 config、已有 active target、alloc version = 1），将**永远不会被重新映射**
- 如果 Agent 模板变更了（增删交易员），已有认购不会自动跟随更新

### 11. Liquidation Worker 无最大重试上限

**位置**: [managed-liquidation-worker.ts](file:///Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/web/scripts/workers/managed-liquidation-worker.ts)

- `computeRetryDelayMs` 使用指数退避，但没有最大尝试次数
- `RETRYING` 状态的任务会无限重试
- 如果某个 token 的市场已经永久关闭/无流动性，这个 task 会永远卡在那里

### 12. NAV 刷新的 unrealizedPnl 计算缺少 fallback 保护

**位置**: [managed-wealth-worker.ts L599-L623](file:///Users/baronchan/Desktop/Polymarket/poly-sdk/poly-hunter/web/scripts/workers/managed-wealth-worker.ts#L599-L623)

- 获取 orderbook 价格失败时（`catch` 分支），不设置任何价格
- 后续循环用 `currentPriceMap.get(pos.tokenId) ?? pos.avgEntryPrice` 回退到成本价
- 这意味着**网络临时故障时，所有持仓的 unrealizedPnl 会变为 0**
- 可能导致 NAV 突然"跳回"到初始值，触发虚假的回撤警告

### 13. 会员过期检查时机问题

- `expireOutdatedMemberships` 只在 GET 请求时执行
- 如果用户长时间不访问 Dashboard，过期会员不会被及时标记
- 某些依赖 ACTIVE 状态的下游逻辑可能误判

---

## 🟢 Low — 代码质量 / 可维护性

### 14. `resolveNumberEnv` 重复定义

三个文件各自定义了一模一样的函数：
- `web/app/api/managed-subscriptions/route.ts`
- `web/app/api/managed-subscriptions/[id]/withdraw/route.ts`
- Worker 文件中也有类似实现

应提取为共享 utility。

### 15. `normalizeManagedAllocationWeights` 重复定义

两个文件各自定义了略有不同的版本：
- `managed-subscriptions/route.ts`（含 `weightScore`）
- `managed-products/[id]/route.ts`（不含 `weightScore`）

应统一为一个共享函数。

### 16. 产品详情页缺少鉴权分层

- 产品基本信息（名称、策略、条款）适合公开
- 但 `allocationSnapshots`（分配权重详情）和 `subscriptions`（认购记录）不应公开
- 建议将敏感数据拆分到需鉴权的 endpoint

### 17. 试用机制过于简单

- 仅判断"首次认购 + 1天期限"
- 没有防止用户**换钱包**重复享受试用的机制
- 试用期内产生的交易如果持续到试用期后，费率切换逻辑可能有边界问题

---

## 📊 审计汇总

| 严重度 | 数量 | 核心问题 |
|--------|------|---------|
| 🔴 Critical | 3 | 会员白嫖、本金无链上验证、结算无实际退款 |
| 🟠 High | 4 | CANCELLED 未实现、风险系统半成品、信息泄露、分页缺失 |
| 🟡 Medium | 6 | 无频率限制、Worker 无监控、分配更新盲区、无限重试、NAV 跳变、会员过期延迟 |
| 🟢 Low | 4 | 代码重复、鉴权分层不足、试用防滥用 |

---

## 💡 建议优先级

1. **P0 — 上线阻断**：解决 Critical #1~#3（链上资金流闭环）
2. **P1 — 核心完善**：实现 CANCELLED 流程、补全风险监控
3. **P2 — 健壮性**：频率限制、Worker 监控、分页、最大重试
4. **P3 — 代码质量**：提取共享 utilities、鉴权分层
