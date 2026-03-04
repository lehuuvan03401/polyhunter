# PR 描述：全球合伙人制度治理加固（公平性 + 安全性 + 不可变策略）

## 背景
本 PR 收口全球合伙人制度剩余高优先级风险，目标是让“展示规则、执行结果、治理安全”三者一致，避免运营争议与可利用面。

## 本次改动
### 1) 排名与淘汰规则统一
- 在 `partner-program` 抽出统一比较器：
  - `comparePartnerSeatRankingOrder`
  - `comparePartnerSeatEliminationOrder`
  - `pickEliminationCandidates`
- `rankings` 与 `cycle/eliminate` 路由统一复用，不再出现“榜单顺序和淘汰顺序不一致”。

### 2) 月度评分口径绑定 `monthKey`
- `buildPartnerSeatRanking` / `getSeatScoreMap` 新增 `monthKey` 选项。
- 评分快照按月窗口过滤（`[monthStart, monthEnd)`），防止跨月数据污染当月淘汰。

### 3) 席位费强约束
- `POST /api/partners/seats` 不再允许请求侧随意覆盖席位费。
- 新增 `resolvePartnerSeatFeeUsd`：
  - 未传 `seatFeeUsd`：使用配置价。
  - 传入但与配置价不一致：拒绝（`SEAT_FEE_MISMATCH`）。

### 4) 管理员接口签名鉴权
- `isAdminRequest` 从“仅 x-admin-wallet 白名单”升级为“白名单 + 签名”。
- 支持头：
  - `x-admin-wallet`
  - `x-admin-signature` / `x-admin-timestamp`
  - 或兼容 `x-wallet-signature` / `x-wallet-timestamp`
- 默认策略：非 `development` 环境要求签名（可用 `PARTNER_ADMIN_REQUIRE_SIGNATURE=false` 显式降级）。
- 管理后台与运维脚本均改为发送签名请求。

### 5) 月淘汰人数不可变
- 月淘汰数量固定为策略常量（当前 10）。
- `POST /api/partners/cycle/eliminate` 若传入非固定值，返回：
  - `409`
  - `code=IMMUTABLE_ELIMINATION_COUNT`

### 6) 退款执行接口去模拟化
- `POST /api/partners/refunds/execute` 移除 mock tx 生成逻辑。
- 改为必须传入合法链上交易哈希（`0x` + 64 hex）。
- 完成退款时在同一事务内更新：
  - `PartnerRefund -> COMPLETED`
  - `PartnerSeat -> REFUNDED` 且 `backendAccess=false`

### 7) 文档与运维更新
- 更新合伙人 runbook：补充签名鉴权要求与脚本环境变量（`PARTNER_OPS_ADMIN_PRIVATE_KEY`）。
- 同步更新任务/进度/发现记录，便于审计追踪。

## 影响范围
- 主要 API：
  - `POST /api/partners/seats`
  - `GET/POST /api/partners/cycle/eliminate`
  - `GET /api/partners/rankings`
  - `POST /api/partners/refunds/execute`
- 管理端页面：
  - `/dashboard/admin/partners`
- 运维脚本：
  - `partner:eliminate:monthly`
  - `verify:partner:refund-sla`

## 兼容性与发布注意
- 兼容性：
  - 对正常管理流程兼容。
  - 对“自定义淘汰人数”与“模拟退款 tx”行为不再兼容（有意收口）。
- 发布前必须配置：
  - `PARTNER_OPS_ADMIN_PRIVATE_KEY`（供脚本签名）。
  - `ADMIN_WALLETS` 与私钥地址一致。

## 测试与验证
已执行：

```bash
cd web
npx vitest run \
  app/api/partners/refunds/execute/route.test.ts \
  app/api/partners/partner-workflow.integration.test.ts \
  lib/participation-program/partner-program.test.ts \
  lib/participation-program/partner-ops-automation.test.ts \
  app/api/partners/config.integration.test.ts \
  app/api/partners/queue/route.test.ts
# 结果：6 files / 34 tests 全通过

npx tsc --noEmit
# 结果：通过
```

---

## 验收清单
### A. 规则一致性
- [x] 排名与淘汰候选由同一排序规则产出。
- [x] 月度评分按 `monthKey` 窗口过滤，避免跨月污染。
- [x] 席位费与配置价强一致，不可由请求覆盖。

### B. 治理与安全
- [x] 管理员接口默认要求签名鉴权（非开发环境）。
- [x] 管理后台请求已切换为签名模式。
- [x] 运维脚本已支持签名请求。

### C. 策略不可变约束
- [x] 月淘汰人数固定，拒绝自定义覆盖。
- [x] 退款执行接口不再允许 mock tx，必须提供真实 `txHash`。

### D. 回归验证
- [x] partner 相关单测/集成测试通过（34/34）。
- [x] TypeScript 编译通过。

### E. 上线前检查（发布闸门）
- [ ] staging 环境验证管理员签名请求（页面 + 脚本）。
- [ ] staging 验证 `IMMUTABLE_ELIMINATION_COUNT` 拦截行为。
- [ ] staging 验证 `SEAT_FEE_MISMATCH` 拦截行为。
- [ ] staging 验证退款执行必须真实 `txHash`。
- [ ] 生产环境完成 `PARTNER_OPS_ADMIN_PRIVATE_KEY` 安全注入与轮换策略确认。
