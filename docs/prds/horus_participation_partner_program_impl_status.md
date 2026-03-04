# Horus参与机制与全球合伙人计划（正式对外版）
## 实现状态核对 PRD（2026-02-26）

## 1. 文档目的
本 PRD 用于回答两个问题：
1. 最近一批提交是否在实现“参与机制 + 全球合伙人计划”
2. 需求是否已全部落地

本文件以代码与 OpenSpec 为准，不以口头描述为准。

## 2. 核对范围
### 2.1 提交范围（重点）
- `fcd6310` feat: add participation-program M1 foundation and fixed profit fee
- `d941277` feat: add managed custody authorization and term window alignment
- `38f2f0a` feat: add V1-V9 level engine and daily snapshot APIs
- `7e7de6d` feat: add same-level bonus settlement with idempotent ledger
- `0e3fb95` feat: add double-zone promotion progress and snapshot APIs
- `d3ffed3` feat: implement global partner governance APIs and workflows
- `e4ce136` feat: harden referral bonus idempotency and profit-fee settlement trigger
- `1ab268f` feat: enforce membership single-active guard and trial helper
- `718057e` docs: add global partner monthly operations runbook
- `0db858b` refactor: unify strategy profile options across API and UI
- `d929d91` feat: add partner operations admin page and dashboard entry
- `bb491d0` feat: add formal participation rules panels to managed and affiliate UI
- `28a4fd0` test: add participation and partner workflow integration routes
- `e95aef5` test: add participation and partner e2e flow coverage
- `1c1cd68` chore: archive horus participation partner program change

### 2.2 规范范围
- `openspec/specs/participation-program/spec.md`
- `openspec/specs/global-partner-program/spec.md`
- `openspec/specs/affiliate-system/spec.md`
- `openspec/specs/fee-logic/spec.md`

## 3. 总结结论
- 结论：**最近提交确实在实现该方案，且已覆盖大部分核心条款，但并非 100% 完整闭环。**
- 判定：
  - 已实现：22 条
  - 部分实现：12 条
  - 未实现：0 条
- 核心差距集中在：
  - 规则硬约束与可配置项冲突（例如席位上限可被改到 100 以上）
  - 部分能力依赖环境开关才生效
  - 若干条款目前更偏“展示/运营流程”，未形成强制自动化执行

## 4. 需求逐条核对矩阵

### 一、参与基础：入金通道与门槛
| 条款 | 状态 | 实现证据 | 说明 |
|---|---|---|---|
| 交易所 + TP 钱包双通道入金 | 已实现 | `web/lib/participation-program/rules.ts`, `web/app/api/participation/funding/route.ts` | 通道枚举 `EXCHANGE` / `TP_WALLET`，并统一记账 |
| 最低入金 100U MCN | 已实现 | `web/lib/participation-program/rules.ts`, `web/app/api/participation/account/route.ts` | `FREE=100`, `MANAGED=500`，激活时校验 |
| 注册 + 入金激活 | 已实现 | `web/app/api/participation/account/route.ts` | 激活前必须已注册且净入金达到门槛 |

### 二、仓位类型与服务模式
| 条款 | 状态 | 实现证据 | 说明 |
|---|---|---|---|
| 自由仓 100U 起投 | 已实现 | `web/lib/participation-program/rules.ts`, `web/app/api/participation/account/route.ts` | 已有 FREE 模式与门槛 |
| 自由仓支持 AI 一键跟单 / 自主策略跟单 | 部分实现 | `web/components/proxy/strategy-selector.tsx`, `web/components/copy-trading/copy-trader-modal.tsx` | 复制交易能力存在，但未与 `ParticipationAccount.FREE` 做强绑定开关 |
| 托管仓 500U 起投 | 已实现 | `web/lib/participation-program/rules.ts`, `web/app/api/participation/account/route.ts` | MANAGED 门槛与激活校验存在 |
| 托管仓平台授权托管 | 部分实现 | `web/app/api/participation/custody-auth/route.ts`, `web/app/api/managed-subscriptions/route.ts` | 有托管授权 API；但强制校验受 `PARTICIPATION_REQUIRE_CUSTODY_AUTH` 开关控制 |
| 托管策略保守/稳健/激进 | 已实现 | `web/lib/participation-program/rules.ts`, `web/app/api/participation/rules/route.ts` | 三策略统一输出 |
| 自由仓收益用户自行止盈止损 | 部分实现 | 现有 copy-trading 与策略配置能力 | 有相关能力，但未见单独“自由仓止盈止损规则引擎” |
| 托管仓收益随周期/档位/策略浮动并按市场结算 | 部分实现 | `web/lib/participation-program/rules.ts`, `web/app/api/participation/rules/route.ts`, `web/app/api/managed-subscriptions/[id]/withdraw/route.ts` | 已有 A/B/C 收益矩阵与市场结算；矩阵更多用于规则展示，非直接结算驱动 |

### 三、收费标准
| 条款 | 状态 | 实现证据 | 说明 |
|---|---|---|---|
| 仅对盈利收费，不盈利 0 收费 | 部分实现 | `web/lib/services/affiliate-engine.ts`, `web/app/api/managed-subscriptions/[id]/withdraw/route.ts` | 利润分成路径满足“无盈利不收费”；但托管仍存在提前退出费等附加费用逻辑 |
| 自由仓/托管仓统一盈利 20% | 部分实现 | `web/lib/participation-program/rules.ts`, `web/lib/services/affiliate-engine.ts` | 已固定 20% 利润费逻辑；但系统中仍存在其他费率体系（如 `web/app/api/proxy/utils.ts` 的 10/5/2） |
| 新人 1 天免费体检期 | 已实现 | `web/lib/managed-wealth/subscription-trial.ts`, `web/app/api/managed-subscriptions/route.ts` | 首次 + 1 天周期触发试用 |
| 月订阅 88 / 季度 228 | 已实现 | `web/lib/managed-wealth/membership-plans.ts`, `web/app/api/managed-membership/route.ts` | 价格一致 |
| 交易所通道使用平台币享 50% 订阅折扣 | 部分实现 | `web/lib/managed-wealth/membership-plans.ts` | MCN 支付折扣已实现；但当前折扣不与“交易所通道”做硬绑定 |

### 四、推荐激励规则
| 条款 | 状态 | 实现证据 | 说明 |
|---|---|---|---|
| 直推 1 人完成参与，推荐人订阅 +1 天 | 已实现 | `web/lib/participation-program/referral-subscription-bonus.ts`, `web/app/api/participation/account/route.ts`, `web/app/api/managed-subscriptions/route.ts` | 触发后自动延长 |
| 单地址仅触发 1 次，奖励独立核算 | 已实现 | `web/prisma/schema.prisma`（`Referral.refereeAddress @unique` + `subscriptionBonusGrantedAt`）, `web/lib/participation-program/referral-subscription-bonus.ts` | 幂等防重入 |

### 五、资金安全机制
| 条款 | 状态 | 实现证据 | 说明 |
|---|---|---|---|
| 资产留存在用户地址/账户 | 部分实现 | `web/app/api/participation/rules/route.ts`, `web/app/api/participation/custody-auth/route.ts` | 规则与授权边界已定义；但全局执行路径仍有历史模式共存 |
| 平台无权动用用户本金 | 部分实现 | 同上 | 在 FREE 规则上声明成立；需结合执行模式治理做全链路约束 |
| 仅在授权范围执行（托管除外） | 部分实现 | `web/app/api/participation/custody-auth/route.ts`, `web/app/api/managed-subscriptions/route.ts` | 已有授权留痕；强制校验受环境开关控制 |

### 六、托管套餐与周期收益表（A/B/C）
| 条款 | 状态 | 实现证据 | 说明 |
|---|---|---|---|
| A/B/C 三档、7/30/90/180/360 周期、三策略收益区间 | 已实现 | `web/lib/participation-program/rules.ts`, `web/app/api/participation/rules/route.ts` | 数值与需求表一致 |

### 七、服务周期选择
| 条款 | 状态 | 实现证据 | 说明 |
|---|---|---|---|
| 1 天试用 + 7/30/90/180/360 | 已实现 | `web/lib/participation-program/rules.ts`, `web/app/api/managed-products/route.ts`, `web/app/api/managed-products/[id]/route.ts`, `web/prisma/seed-managed-wealth.ts` | 周期已统一输出并在产品接口过滤 |

### 八、业绩考核与引流规则
| 条款 | 状态 | 实现证据 | 说明 |
|---|---|---|---|
| 业绩口径按净入金（入金-出金） | 已实现 | `web/app/api/participation/funding/route.ts`, `web/lib/participation-program/levels.ts` | 已建立 `NetDepositLedger` 及聚合 |
| 一推二双区晋升，最高 V9 | 已实现 | `web/lib/participation-program/promotion.ts`, `web/app/api/participation/promotion/route.ts` | 双区进度与到 V9 目标逻辑已落地 |

### 九、等级制度与团队分红
| 条款 | 状态 | 实现证据 | 说明 |
|---|---|---|---|
| V1~V9 净入金门槛 | 已实现 | `web/lib/participation-program/levels.ts` | 阈值与需求一致 |
| 团队盈利分红比例 30%~70% | 已实现 | `web/lib/participation-program/levels.ts` | 分红比例与需求一致 |
| 日考核落库 | 已实现 | `web/app/api/participation/levels/route.ts`, `web/prisma/schema.prisma` (`DailyLevelSnapshot`) | 已有快照 API |

### 十、平级奖规则
| 条款 | 状态 | 实现证据 | 说明 |
|---|---|---|---|
| 一代 4%，二代 1% | 部分实现 | `web/lib/participation-program/bonuses.ts`, `web/lib/services/affiliate-engine.ts` | 逻辑已实现；是否生效受 `PARTICIPATION_ENABLE_SAME_LEVEL_BONUS` 开关控制 |

### 十一、全球合伙人招募计划（100席）
| 条款 | 状态 | 实现证据 | 说明 |
|---|---|---|---|
| 全球仅限 100 席，永不增发 | 部分实现 | `web/lib/participation-program/partner-program.ts`, `web/app/api/partners/seats/route.ts`, `web/app/api/partners/config/route.ts` | 默认 100 席并校验上限；但管理接口允许把 `maxSeats` 改到 1000 |
| 月度考核，末位淘汰 | 部分实现 | `web/app/api/partners/cycle/eliminate/route.ts`, `docs/operations/runbook-partner-program.md` | 有月度淘汰流程与 runbook；主要依赖人工/运维触发 |
| 每月末淘汰后 10 名 | 已实现 | `web/lib/participation-program/partner-program.ts` (`MONTHLY_ELIMINATION_COUNT=10`), `web/app/api/partners/cycle/eliminate/route.ts` | 逻辑存在 |
| 淘汰后一周内退还席位费 | 部分实现 | `web/lib/participation-program/partner-program.ts` (`REFUND_SLA_DAYS=7`), `web/app/api/partners/refunds/route.ts` | 已记录 deadline 和退款流；无自动强制完成任务 |
| 补位机制，费用按行情确定 | 已实现 | `web/app/api/partners/config/route.ts`, `web/app/api/partners/seats/route.ts` | 支持 `refillPriceUsd` 和空位回补 |
| 合伙人权益 = V5 + 专属后台权限 | 已实现 | `web/lib/participation-program/partner-program.ts`, `web/app/api/partners/privileges/route.ts`, `web/app/api/partners/seats/route.ts` | 默认 V5 + backendAccess，淘汰后可撤销 |

### 备注条款：USDT 按 MCN 等值通道
| 条款 | 状态 | 实现证据 | 说明 |
|---|---|---|---|
| 所有 USDT 条款按 MCN 等值通道结算 | 已实现 | `web/app/api/participation/rules/route.ts`, `web/app/api/participation/funding/route.ts` | 规则声明 + 账本字段已采用 `mcnEquivalentAmount` |

## 5. 验证与测试覆盖
- 单测：
  - `web/lib/participation-program/rules.test.ts`
  - `web/lib/participation-program/levels.test.ts`
  - `web/lib/participation-program/levels-aggregation.test.ts`
  - `web/lib/participation-program/bonuses.test.ts`
  - `web/lib/participation-program/partner-program.test.ts`
  - `web/lib/participation-program/referral-subscription-bonus.test.ts`
  - `web/lib/services/affiliate-engine.test.ts`
- 集成测试：
  - `web/app/api/participation/account.integration.test.ts`
  - `web/app/api/partners/partner-workflow.integration.test.ts`
- E2E：
  - `web/e2e/participation-partner.spec.mjs`

## 6. 关键差距与整改建议（按优先级）
### P0（上线前必须收口）
1. 固化全球 100 席硬上限
- 现状：`/api/partners/config` 可把 `maxSeats` 提到 1000。
- 建议：去掉可变上限，或强制 `maxSeats===100` 且不可修改。

2. 统一 20% 收费策略边界
- 现状：利润费 20% 已有；但仍并存其他费率体系（例如代理 tier 10/5/2、托管性能费可变）。
- 建议：明确“20%”作用域（仅联盟利润分成 or 用户端统一手续费），并在代码中单一化。

### P1（强一致性）
3. 将托管授权、托管激活从“开关可选”升级为默认强制
- 现状：`PARTICIPATION_REQUIRE_MANAGED_ACTIVATION` / `PARTICIPATION_REQUIRE_CUSTODY_AUTH` 为可选。
- 建议：生产默认开启，或改成不可绕过。

4. 平级奖从“开关可选”升级为生产必开（若对外规则已承诺）
- 现状：`PARTICIPATION_ENABLE_SAME_LEVEL_BONUS` 控制是否启用。
- 建议：按运营规则设为默认启用并加入启动时校验。

### P2（运营自动化）
5. 月末淘汰与退款 SLA 自动任务化
- 现状：已有 API + runbook，主要靠人工触发。
- 建议：增加调度任务与超时告警，避免人工遗漏。

6. FREE 模式能力做强绑定
- 现状：FREE 模式与“AI 一键跟单/策略跟单”能力存在，但未见硬性绑定关系。
- 建议：在账户模式/产品权限层加显式约束。

## 7. 最终判断
- “是否是实现该市场合伙人方案的提交？”：**是，属于该方案的核心实现批次。**
- “是否全部实现？”：**未完全实现，当前更准确结论是“核心能力已到位，仍有若干硬约束与自动化闭环待收口”。**

## 8. 收口进展更新（2026-02-26，第二批）
以下缺口已在后续提交中完成收口：

1. 100 席不可增发已硬约束
- `maxSeats` 已改为不可提升，配置与分配路径统一强制 100，上层管理页改只读。

2. 托管硬门槛与模式边界已加固
- 生产默认强制托管激活 + 托管授权。
- `managed-subscriptions` 拒绝 `FREE` 模式账户。
- `custody-auth` 要求账户处于 `MANAGED` 模式，否则返回 `MODE_BOUNDARY_VIOLATION`。

3. 20% 参与利润费作用域已显式隔离
- 新增 fee-scope 解析，非参与费路事件不进入参与利润费结算。
- `managed-withdraw` 显式传入参与费路 scope，避免与其他费路歧义重叠。

4. 自动化幂等与 SLA 判定测试已补齐
- 月末淘汰脚本与退款 SLA 看门狗抽象为可测试纯函数。
- 已补“同月幂等跳过”和“SLA breach 检测”单测。

当前剩余主要是运维发布层动作（调度编排、告警接入与灰度观察），不再是核心业务逻辑空缺。

## 9. 机制详解（机制补充说明）

### 9.1 机制的核心基石（席位与定价）

*   **绝对稀缺：全球 100 席硬上限（Seat Cap）**
    这是该机制最基础的护栏。系统在全球范围内**只开放 100 个合伙人席位**作为最高阈值，业务上**永不增发**。
    *   **系统级锁死**：为了防止因为管理人员的误操作或滥用，系统在代码层面对 `maxSeats` 进行了写死处理（硬约束最大值为 100），就算超管在后台强行输入 101，也会被后端 API 拦截拒绝，确保席位的绝对稀缺性。
*   **“暗标”浮动补位定价（Dynamic Refill Price）**
    如果前期 100 席未满，或者当有人被淘汰空出席位后，这些空位会重新开放给市场抢注。
    *   **随行就市**：补位卡槽的席位费（`refillPriceUsd`）不是固定的，而是由平台根据当时的市场热度、整体管理规模动态调价配置。抢占席位的门槛会随着平台的发展水涨船高。

### 9.2 合伙人的核心权益（Privileges）

一旦花钱拿到了这 100 分之一的席位，合伙人能享受以下特权：

*   **“开挂式”的 V5 满配分红权**
    在普通推广（Affiliate）体系中，用户需要一步步拉新（比如直推 50 人、团队 1000 人）才能爬到 V5 这个最高等级（最高可享团队盈利的 70% 提成）。
    *   **绿卡通道**：全球合伙人**不需要爬坡**，只要占据席位，系统会通过权益映射直接赋予其 **V5 等级** 的全部满配收益权。
*   **半自治的管理后台权限（Backend Access）**
    全球合伙人被视为平台的利益共同体，系统会为其解锁**专属的内部后台进入权限**，允许合伙人查看比普通会员更深度的大盘数据、团队报表和分润细则。

### 9.3 活水机制：月度末位淘汰（Monthly Elimination）

高收益伴随高要求，平台不养“占着茅坑不拉屎”的僵尸席位。

*   **每月拉榜竞业调查**
    在每个自然月的月末，系统都会启动自动化考核引擎，以净入金（入金减出金）等核心业绩指标对当前的 100 位合伙人进行强制大盘排名。
*   **残酷的末10名出局制**
    *   **10% 淘汰率**：排名垫底的 **10 名合伙人**（即末尾 10%），会被自动打上 `ELIMINATED`（已淘汰）标签。
    *   **降级与剥夺**：一旦被裁定淘汰，平台会自动剥夺其 V5 身份和专属后台权限。
*   **容错预演防护**
    系统给这个残酷的机制加了安全锁。在执行大清洗前，管理员可以在后台进行 `Dry-Run`（沙盒预演），提前查阅本月度会死掉的危险名单；同时系统加入了“同月防重”验证，防止因为页面卡顿点两次导致多淘汰了一批无辜的人。

### 9.4 兜底与循环闭环（退款 SLA）

虽然会被淘汰，但这个机制保证了合伙人的“初始本金”不被吞没。

*   **一周内退款承诺（Refund SLA=7天）**
    淘汰并非罚没。对于被打上 `ELIMINATED` 标签的合伙人，平台承诺在 **7 天（SLA 时效）** 内，将当初购买席位的本金通过 `REFUND_PENDING -> REFUNDED` 链路全额退改给该用户。
    *   **退款看门狗**：系统后台驻留了一个守护脚本，只要有人的退款拖延超过7天，系统就会自动对开发和运营发出紧急告警。
*   **生态的良性循环**
    当退款完成，合伙人席位被彻底清出，那 10 个空位又回到了系统奖池。
    此时管理后台调整好新一期的价格（通常比之前的更高），向全网重新投放，引来新一批有资金、有资源的 “狼性” 玩家争夺，依次往复。

### 9.5 总结

概括来说，这是一个**“交高额保证金锁位 -> 享受平台顶配分红 -> 月度考核干掉垫底 -> 七天退还保证金 -> 空位涨价再入市”**的封闭式经济模型。
它既确保了头部玩家能够获取到平台极早期红利与核心分账，同时利用机制保障了这些头部玩家必须源源不断地为平台引流输血，成为了整个业务体系中最强劲的吸金引擎。
