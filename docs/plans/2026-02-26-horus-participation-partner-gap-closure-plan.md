# Horus 参与机制与全球合伙人计划
## 缺口收口执行计划（2026-02-26）

## 1. 目标
基于已完成版本，推进剩余“部分实现”项，达成对外规则与系统行为一致。

## 2. 当前基线（来自实现核对 PRD）
- 已实现：22
- 部分实现：12
- 未实现：0
- 核心待收口：硬约束、默认开关、自动化执行、边界强校验

## 3. 里程碑与优先级

### M4-P0（强约束收口，先做）
1. 全球席位上限不可变更（固定 100）
- 代码点：
  - `web/app/api/partners/config/route.ts`
  - `web/lib/participation-program/partner-program.ts`
- 交付：禁止 admin 修改 `maxSeats>100`，并对历史脏配置做归一。
- 验收：
  - API 提交 `maxSeats=101` 返回 400/409。
  - `seats` 分配在 100 时稳定返回 `SEAT_CAP_REACHED`。

2. 托管硬门槛生产默认强制
- 代码点：
  - `web/app/api/managed-subscriptions/route.ts`
- 交付：生产默认强制 managed activation + custody auth；非生产可显式放宽。
- 验收：
  - 未激活 MANAGED 时订阅被拒。
  - 无有效授权时托管入口被拒。

3. 平级奖默认开启（生产）
- 代码点：
  - `web/lib/services/affiliate-engine.ts`
- 交付：生产默认启用；保留 break-glass 开关并加审计日志。
- 验收：
  - 盈利结算触发 1 代 4% / 2 代 1%。
  - 关闭开关时写审计日志。

4. 20% 计费口径边界固化
- 代码点：
  - `web/lib/services/affiliate-engine.ts`
  - `web/app/api/managed-subscriptions/[id]/withdraw/route.ts`
  - `web/app/api/proxy/utils.ts`（标注作用域/隔离）
- 交付：明确“参与利润费 20%”作用域，不与其他费路冲突重复计费。
- 验收：
  - 参与利润事件仅触发一条 20% 费路。
  - no-profit-no-fee 回归通过。

### M5-P1（自动化与边界）
5. 月末淘汰自动调度 + 同月幂等
- 代码点：
  - `web/app/api/partners/cycle/eliminate/route.ts`
  - `web/scripts/workers/*`（新增调度脚本）
- 交付：定时触发、`monthKey` 幂等、dry-run 预检查。

6. 退款 SLA 看门狗与告警
- 代码点：
  - `web/app/api/partners/refunds/route.ts`
  - `web/scripts/verify/*`（新增 SLA 扫描）
  - `docs/operations/runbook-partner-program.md`
- 交付：超时未退款自动告警，形成处理队列。

7. FREE/MANAGED 边界强校验
- 代码点：
  - `web/app/api/participation/account/route.ts`
  - `web/app/api/managed-subscriptions/route.ts`
  - 涉及托管/托管授权入口
- 交付：FREE 模式拒绝 managed/custodial-only 操作。

### M6-P2（验证与发布）
8. 测试补强
- 单测：fee scope、same-level default-on、cap immutability
- 集成：managed gate/custody gate、FREE 边界拒绝
- E2E：月末淘汰自动流 + SLA 异常告警流

9. 运维发布闸门
- Gate A：API 与模型约束通过
- Gate B：自动化任务 dry-run 连续 2 次通过
- Gate C：灰度环境 7 天无 SLA 漏洞

## 4. 并行实施建议
- 轨道 A（后端约束）：1,2,3,4
- 轨道 B（自动化运维）：5,6
- 轨道 C（测试与文档）：7,8,9

## 5. 任务分解（建议提交顺序）
1. `feat(partner): lock seat cap to immutable 100`
2. `feat(participation): enforce managed gates in production`
3. `feat(affiliate): default-on same-level bonus with audit trail`
4. `refactor(fee-logic): isolate participation 20% profit-fee scope`
5. `feat(partner-ops): add month-end elimination scheduler`
6. `feat(partner-ops): add refund sla watchdog and alerts`
7. `test: add regression for policy hard constraints`
8. `docs(operations): update runbook and rollout checklist`

## 6. 回归命令清单
```bash
cd web
npx tsc --noEmit
npx vitest run --config vitest.config.ts \
  lib/services/affiliate-engine.test.ts \
  app/api/participation/account.integration.test.ts \
  app/api/partners/partner-workflow.integration.test.ts
npx playwright test --config=playwright.config.mjs e2e/participation-partner.spec.mjs

cd ..
openspec validate harden-horus-participation-partner-policy --strict --no-interactive
```

## 7. 风险与回滚
- 风险：强约束上线后，历史“可放行”请求将被拒。
- 回滚：
  - 保留非生产宽松开关；
  - 生产仅允许短时 break-glass，且必须记录审计；
  - 所有变更先灰度到 staging，完成双周期开窗验证后再上生产。
