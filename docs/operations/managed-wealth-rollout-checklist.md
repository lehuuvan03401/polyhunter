# Managed Wealth Rollout Checklist

托管理财闭环已经支持多 trader allocation、统一 settlement 收口和 feature-flag 回滚。本清单用于生产或 staging 按最小风险顺序上线，不建议跳步。

## 1. 部署前确认

- 确认应用代码已包含以下能力：
  - `ManagedSubscriptionAllocation`
  - `ManagedSubscriptionExecutionTarget`
  - shared settlement finalization helper
  - managed wealth E2E（dashboard withdraw flow）
- 确认 `DATABASE_URL`、`ADMIN_WALLETS`、托管理财 worker 所需环境变量已配置。
- 确认本次发版窗口允许同时重启：
  - `web` 应用
  - `web/scripts/workers/managed-wealth-worker.ts`
  - `web/scripts/workers/managed-liquidation-worker.ts`

## 2. 数据库迁移

按顺序执行 Prisma migration：

```bash
cd web
npx prisma migrate deploy
```

本次上线至少应包含：

- `20260302100000_add_managed_subscription_allocation`
- `20260302113000_add_managed_execution_targets`

上线后建议立刻执行：

```bash
cd web
npx prisma generate
```

## 3. 首次上线的安全开关

建议第一阶段先部署代码，但保持“新写入、旧读取”或“单 target 执行”，降低切换面：

```bash
MANAGED_ALLOCATION_SNAPSHOT_ENABLED=true
MANAGED_MULTI_TARGET_EXECUTION_ENABLED=false
MANAGED_EXECUTION_TARGET_SCOPE_ENABLED=false
MANAGED_POSITION_SCOPE_FALLBACK=true
```

含义：

- `MANAGED_ALLOCATION_SNAPSHOT_ENABLED=false`：worker 回退到旧的 `product.agents[0]` 映射。
- `MANAGED_MULTI_TARGET_EXECUTION_ENABLED=false`：即使已有 allocation snapshot，也只展开单 target。
- `MANAGED_EXECUTION_TARGET_SCOPE_ENABLED=false`：NAV / settlement / liquidation / withdraw 读取路径忽略 `ManagedSubscriptionExecutionTarget`，直接退回 legacy `copyConfigId`。
- `MANAGED_POSITION_SCOPE_FALLBACK=true`：订阅级持仓为空时，继续从 legacy `UserPosition` 回退。

## 4. 首次启动后的数据暖机

先让 worker 运行一轮，使老订阅补齐 execution target 映射：

```bash
cd web
MANAGED_WEALTH_RUN_ONCE=true npm run managed-wealth:worker
```

这一步的目标是：

- 已有单 `copyConfigId` 的订阅自动补出一条 primary `ManagedSubscriptionExecutionTarget`
- 不改变用户资金状态
- 不强制开启 multi-trader

## 5. 持仓对账与范围验证

在切读之前，先完成持仓回填和核对：

```bash
cd web
npm run backfill:managed-positions
npm run verify:managed-positions:scope
```

要求：

- reconciliation 无阻断差异
- 同钱包、多订阅、重叠 token 的场景能正确分账

## 6. 运营健康检查

切换前至少检查一次 managed settlement health：

```bash
curl -H "x-admin-wallet: <admin_wallet>" \
  "http://localhost:3000/api/managed-settlement/health?windowDays=7&staleMappingMinutes=30"
```

重点看：

- `allocation.staleUnmapped`
- `liquidation.backlogCount`
- `liquidation.taskStatus.blocked`
- `settlementCommissionParity.missingCount`
- `settlementCommissionParity.feeMismatchCount`

如果这些指标异常，不要进入下一步切换。

## 7. 分阶段打开新路径

### 阶段 A：切 execution-target 读路径

先只打开 relation read path，不打开 multi-trader 扩展：

```bash
MANAGED_EXECUTION_TARGET_SCOPE_ENABLED=true
MANAGED_MULTI_TARGET_EXECUTION_ENABLED=false
```

观察点：

- NAV 是否与切换前一致
- `withdraw` / admin `run` / worker settlement 是否都能正常完成
- liquidation task 是否仍能找到主执行 config

### 阶段 B：打开 multi-trader 执行

确认阶段 A 稳定后，再开放多 target 展开：

```bash
MANAGED_MULTI_TARGET_EXECUTION_ENABLED=true
MANAGED_ALLOCATION_TARGET_COUNT=3
```

建议：

- 先从小 `MANAGED_ALLOCATION_TARGET_COUNT` 开始（如 `2` 或 `3`）
- 先在 staging 或小流量环境观察一轮完整到期/提现闭环

### 阶段 C：关闭 legacy position fallback

在订阅级持仓数据稳定后，最后关闭 legacy fallback：

```bash
MANAGED_POSITION_SCOPE_FALLBACK=false
```

这是最后一步，不建议与前两步同批切换。

## 8. 发布后验证

建议至少执行以下验证：

```bash
cd web
npx tsc --noEmit
npx vitest run --config vitest.config.ts \
  lib/managed-wealth/execution-targets.test.ts \
  lib/managed-wealth/managed-settlement-entrypoint.test.ts \
  lib/managed-wealth/subscription-position-scope.test.ts \
  app/api/managed-settlement/health.integration.test.ts \
  app/api/managed-settlement/entrypoint-parity.integration.test.ts
npm run test:managed-wealth:e2e
```

如果是线上环境，至少人工验证：

- 新建一笔 managed subscription
- 在 `/managed-wealth/my` 看到 allocation summary
- 对运行中的订阅执行一次 withdraw
- 确认最终进入 `SETTLED`，且 `ManagedSettlementExecution` 佣金状态正常推进

## 9. 回滚顺序

如果上线后出现异常，按下面顺序回退，优先回读路径，再回写路径：

1. 关闭多 target 扩展：

```bash
MANAGED_MULTI_TARGET_EXECUTION_ENABLED=false
```

2. 回退 execution-target 读路径：

```bash
MANAGED_EXECUTION_TARGET_SCOPE_ENABLED=false
```

3. 恢复 legacy position fallback：

```bash
MANAGED_POSITION_SCOPE_FALLBACK=true
```

4. 如仍异常，再回退 allocation snapshot 写入：

```bash
MANAGED_ALLOCATION_SNAPSHOT_ENABLED=false
```

说明：

- 上述回滚不会删除已落库的 allocation / execution target 数据。
- `ManagedSubscription.copyConfigId` 仍保留为主 target 兼容字段，因此只要第 2 步完成，大多数读取路径就能退回旧逻辑。

## 10. 不要做的事

- 不要在同一次变更里同时关闭 `MANAGED_POSITION_SCOPE_FALLBACK` 和打开 `MANAGED_MULTI_TARGET_EXECUTION_ENABLED`。
- 不要跳过 `managed-wealth:worker` 的暖机补数，直接让读路径切到 execution target。
- 不要在 health 指标已有积压时继续推进下一阶段。
