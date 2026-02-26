# 发现记录

## 核心链路总览
1. `TradingService` 负责 CLOB 初始化、下单、授权检查，是所有执行链路的交易底座。
2. `MarketService` 负责 CLOB + Gamma 的市场数据融合、订单簿处理与套利信号计算。
3. `SmartMoneyService` 负责地址筛选、Activity 订阅与自动跟单策略编排。
4. `CopyTradingExecutionService` 负责复制交易“资金搬运 + 下单 + 结算 + 回滚 + 恢复”的完整闭环。
5. `TxMutex`/`TxMonitor` 负责 nonce 并发安全和卡单替换，是稳定性关键。

## 关键风险点
- 授权与资金搬运存在链上状态竞争，需要 signer/proxy 双层互斥。
- FOK 失败后必须回滚资产，避免 Bot 与 Proxy 账实不一致。
- 机器人浮动资金（Bot Float）提高吞吐，但需要报销/债务兜底。
- 订单簿深度不足时自动滑点必须保守，否则会触发连续失败。
- 市场元数据来源（Gamma）与交易来源（CLOB）可能不一致，需要融合降级策略。

## 注释重点
- 解释“并行预检 + 互斥执行 + 失败回滚 + 延迟结算”的阶段化模型。
- 解释缓存、限流、授权检查在性能与安全之间的平衡。
- 解释镜像订单与有效价格在套利判定中的业务意义。

## 第二批新增发现（Worker + API）
- `copy-trading-worker` 是“检测/执行/恢复/结算/对账”五合一主控进程，核心稳定性来自：幂等键、任务锁、预写入、防孤儿订单、重试回退。
- `execute` API 的服务端分支实际上是对 Worker 执行链路的“按单触发版”，同样依赖 guardrail、orderbook 深度检查与 proxy 授权预检。
- `detect` API 只负责生成 `PENDING`，执行职责明确下沉到 Worker/Execute，实现了“检测与执行解耦”。
- `readiness` API 输出的是可执行动作清单（requiredActions），对前端引导意义大于单个 ready 布尔值。

## 第三批新增发现（查询与风控聚合）
- `orders` 接口内部做了“DB 状态 -> UI 订单状态”映射，`OPEN` 与 `PENDING` 存在语义桥接，若不注释容易误读统计口径。
- `positions` 与 `metrics` 都采用“CLOB 优先、Gamma 回退、Entry 兜底”的价格层级，并且会按市场结算状态重写估值口径。
- `metrics` 中 `totalInvested` 仅统计 OPEN 仓位，与累计成交量 (`cumulativeInvestment`) 是两个不同维度，容易混淆。
- `guardrail-service` 是前端 API 侧风控单一事实来源（额度、频率、allowlist、开关），与 worker/supervisor 需保持同口径。
- `copy-trading-supervisor` 在 HYBRID 信号模式下具备 WS 退化到 polling 的容灾机制，注释后更容易维护多信号源一致性。

## 第四批新增发现（配置控制面）
- `copy-trading-supervisor` 与 `copy-trading-worker` 的环境变量数量大、耦合强，必须按“网络/风控/并发/信号源/缓存”分组注释，否则排障成本很高。
- `SmartMoneyService.getSmartMoneyList` 的候选池放大、两层过滤、评分权重是策略核心，补注释后能更快解释“为什么榜单与原始 leaderboard 不一致”。

## 第五批新增发现（核心服务尾段）
- `TradingService` 的撤单、奖励、授权接口虽然直观，但对外语义依赖字段归一化与错误包装，注释后更清楚边界。
- `MarketService.detectMarketSignals` 是混合信号函数（market/orderbook/trades），注释后可直接定位每种信号来源。
- `CopyTradingExecutionService.calculateDynamicSlippage` 是保守估算模型而非精确成交仿真，需明确其用途与局限。
- `TxMutex/TxMonitor` 已补充“观测意义”说明，方便后续做队列背压与替换链路排障。

## 第六批新增发现（核心服务前半段）
- `TradingService`/`MarketService` 的惰性初始化与本地模式分支决定了“何时连远端、何时走 mock”，是联调稳定性的关键。
- `CopyTradingExecutionService` 的 chain address 路由、proxy 缓存、allowlist/paused 校验是执行前硬门槛，注释后更易定位“为什么被拦截”。
- `TxMutex.isLocked()` 当前是占位语义，真实拥塞应看 `getQueueDepth()`，已在注释中明确。

## 第七批新增发现（阈值与降级口径）
- `readiness` 路由的本质是“动作清单生成器”，其容错策略是单项失败降级而非整体失败，注释后更易解释为什么链路抖动时仍返回 200。
- `MarketService` 的历史 spread 信号是“指示性”而非“可执行性”，必须与实时 orderbook 信号分开理解，否则会误把回测信号当实盘机会。
- `CopyTradingExecutionService` 在资金搬运、下单、结算之间使用“signer 锁 + proxy 锁”分层互斥，结合 float 与报销延迟策略是吞吐优化关键。

## 2026-02-25 新增发现：参与机制与全球合伙人需求映射

### 已有能力（可复用）
- 订阅定价已存在：`88/月`、`228/季度`，并且 `MCN` 支付已实现 `50%` 折扣（`managed-membership`）。
- 新人 1 天试用与直推 +1 天已具备实现基础（`managed-subscriptions` + `Referral.subscriptionBonusGrantedAt` 一次性保护）。
- 托管三类策略（保守/稳健/激进）在 `StrategyProfile` 与托管理财产品上已具备骨架。
- 盈利才收费（loss 不收费）已有基础逻辑，但费率当前并非全场景固定 20%。

### 主要缺口（需新增）
- 缺少“交易所入金 + TP 钱包入金”统一入金通道与激活口径（注册+入金）。
- 缺少 `FREE` / `MANAGED` 双仓位制度与对应起投门槛（100U/500U）统一约束。
- 缺少按 A/B/C 资金档位 + 周期 + 策略的托管收益矩阵配置与 API。
- 缺少按净入金驱动的 V1-V9 等级体系与团队分红引擎（日考核）。
- 缺少平级奖（1代4%、2代1%）的账务模型与结算链路。
- 缺少全球合伙人 100 席位、月度末位淘汰、7日退款、补位定价与专属权限系统。

### 规范层发现
- 当前 `openspec/specs` 未沉淀 `managed-wealth` 能力规格（仅在 archive 中有历史变更），本次新增提案已通过新 capability delta 补充策略。

### 2026-02-25 续推进发现：排期关键路径
- M1 重点不是“功能数量”，而是先锁定计费与激活口径，否则后续等级与分红会反复返工。
- M2 与 M3 的公平性都依赖净入金账本准确性，必须在 M1/M2 前期完成对账机制。
- 全球合伙人淘汰与退款属于强运营流程，技术实现必须包含审计快照与SLA告警，不可只做状态字段。

### 2026-02-25 开发推进发现（M1 第一批）
- 参与机制可先通过“独立账户/入金/规则 API”落地，不必立即硬切现有托管理财主流程，从而降低发布风险。
- 托管最小本金 500U 可直接在 `managed-subscriptions` 入口强约束；激活闸门采用环境变量开关更利于平滑迁移。
- 收益矩阵采用独立 `ManagedReturnMatrix` 表后，可实现“数据库配置优先 + 代码默认兜底”的运营改价模式。

### 2026-02-25 开发推进发现（M1 第二批）
- 托管授权采用独立表记录后，可以在不耦合交易执行代码的情况下提供审计链路和撤销机制。
- 将期限过滤下沉到 managed-products API，可避免前端和种子脚本各自维护不同的有效周期集合。
- 授权与激活都通过环境变量开关接入主流程，适合分阶段灰度，不会强制影响现有流程。

### 2026-02-25 开发推进发现（M2 第一批）
- 等级计算若只基于实时查询会导致口径漂移，落 `DailyLevelSnapshot` 可确保日考核可追溯。
- 团队净入金计算基于 `Referrer + TeamClosure`，可复用现有联盟树结构，不需要新增层级树模型。
- 将快照 API 设计为 admin + dry-run，能先做运营验算再落库，降低结算风险。

### 2026-02-25 开发推进发现（M2 第二批）
- 平级奖必须有独立幂等账本，单靠 `CommissionLog` 无法避免重复发放。
- 将平级奖开关化（env 控制）可以先完成链路联调，不会对现有收益分配造成突发影响。
- 在 `distributeProfitFee` 内同步结算平级奖可以复用已计算的 realizedProfit，减少重复计算和口径偏差。

### 2026-02-25 开发推进发现（M2 第三批）
- 双区晋升若直接按全团队总量会失真，必须按“直推腿”拆分后再取弱区口径。
- 使用现有 `TeamClosure(depth=1)` 提取直推腿，能避免新增推荐关系表。
- 推广进度 API 与日快照并存：前者用于实时查看，后者用于考核与审计。

### 2026-02-25 开发推进发现（M3 全球合伙人）
- 淘汰流程必须防“同月重复执行”，否则会出现多轮淘汰叠加导致超预期席位流失。
- 月榜与淘汰结果要分离：月榜可实时预览（LIVE），淘汰依据应以落库快照（SNAPSHOT）为准，便于争议审计。
- 退款流程需要状态机保护：已完成退款不允许回退为失败，避免运营误操作破坏账实一致性。
- 权益映射建议按席位 `ACTIVE` 状态判定，后台权限与等级映射解耦成独立接口，便于后续接入管理台。
- 补位能力可先用“可用席位 + 当前补位价格”对外，不必先引入复杂排队模型，以降低交付复杂度。

### 2026-02-25 开发推进发现（计费与推荐补强）
- 推荐奖励逻辑在“参与激活”和“托管订阅”双入口可能重复，必须抽象共享 helper 并使用一次性标记做幂等。
- 推荐延展应优先作用于订阅型权益（`ManagedMembership`），并在无活跃会员时兼容回退到运行中托管订阅，避免奖励丢失。
- 盈利费触发放在提现结算路径时，建议采用“主流程成功优先、分发失败告警”的弱耦合策略，避免因佣金链路故障阻塞用户提现。
- 单元测试要覆盖“净入金为负值”的场景，否则等级引擎容易在极端出金路径下出现口径偏差。

### 2026-02-25 开发推进发现（会员单活跃与试用）
- 会员“单活跃”仅靠先查后插在高并发下仍有竞态，需钱包级事务锁保障串行化。
- 试用资格应从 API 事务逻辑中抽离为纯函数，便于验证“仅新人 + 1天周期”规则并防止后续修改破坏口径。

### 2026-02-25 开发推进发现（合伙人运维手册）
- 月度淘汰流程必须先 dry-run 再执行，且必须约束“同月仅执行一次”，否则会引发席位争议与补位混乱。
- 退款 SLA 管理的关键不是状态字段本身，而是以 `refundDeadlineAt` 做队列优先级和超时告警。
- 争议处理要以月度快照（SNAPSHOT）为准，避免用 LIVE 实时榜单回溯历史决策。

### 2026-02-25 开发推进发现（策略选项统一）
- 策略值本身虽然在 DB/API 基本一致，但 UI 主题映射如果分散维护会出现同一策略不同视觉语义的问题（已出现于卡片与订阅弹窗）。
- 将策略解析（parse）、标签（labelKey）、主题（theme）拆成共享常量后，可同时收敛 API 参数校验和 UI 展示口径，降低未来改动漂移风险。

### 2026-02-25 开发推进发现（合伙人后台操作页）
- 合伙人运营是“多步骤强流程”场景（配置 -> dry-run -> 执行 -> 退款），单 API 可用性不足以支撑日常运营，需要聚合操作页降低误操作概率。
- 月度淘汰执行按钮必须与 dry-run 结果并列展示，能显著降低在错误 monthKey 下直接执行的风险。

### 2026-02-25 开发推进发现（正式外宣规则 UI）
- 外宣规则若继续散落在 managed/affiliate 多页面文案中，后续政策更新会出现口径漂移；抽成共享组件可显著降低维护风险。
- 托管收益矩阵适合直接复用 `/api/participation/rules` 的结构化输出，避免前端重复维护 A/B/C + 周期 + 策略映射。
- 推广侧规则展示应优先引用 `V1-V9`、平级奖、席位上限等配置常量，减少“文案与结算引擎不一致”的运营风险。

### 2026-02-25 开发推进发现（8.2 集成测试）
- 参与激活链路与推荐奖励的一次性幂等，需要在路由事务层做集成验证，单纯 helper 单测无法覆盖“先注册再激活”的真实顺序约束。
- 合伙人月度淘汰与退款是同一状态机链路，必须验证“同月重复淘汰拦截 + 已完成退款不可失败回退”这两个防误操作护栏。

### 2026-02-25 开发推进发现（8.3 E2E）
- 参与侧 E2E 更适合“规则展示 + 关键门槛行为”组合验证：既验证 FREE/MANAGED 外宣口径，也验证托管最低本金约束的前后端联动。
- 合伙人操作 E2E 关键在于串联 dry-run、execute、refund 完成三个动作，确保运营路径可闭环，而不是仅验证单个 API 成功。
- Playwright 首次运行暴露了既有构建阻断：`affiliate-engine` 末尾 `../prisma.js` 路径在 Next build 下不可解析，已修复为 `@/lib/prisma`。

### 2026-02-26 开发推进发现（OpenSpec 归档）
- 任务全量完成后立即归档可把“change 内规则”沉淀为 `specs` 单一事实来源，避免后续继续基于已归档 change 开发导致口径分叉。
- `openspec validate --all` 在归档后可一次性验证活跃 change 与正式 specs 一致性，适合作为收口闸门。

### 2026-02-26 开发推进发现（缺口收口计划）
- 目前“部分实现”项可收敛为四类：硬约束（cap/gate）、默认行为（same-level bonus）、自动化（elimination/SLA watchdog）、边界隔离（FREE 与 fee scope）。
- 优先级上必须先做 P0 约束收口，否则外宣规则与真实系统行为仍存在偏差。
- 建议用新 OpenSpec change 独立承载本轮收口，避免和已归档 change 混用造成审计歧义。

### 2026-02-26 开发推进发现（P0-1 席位硬上限）
- 仅在 `POST /api/partners/config` 拦截 `maxSeats>100` 不够，仍需在配置读取与席位分配路径做“自愈归一化”，否则历史脏数据会继续影响上限判断。
- 管理台继续暴露可编辑 `maxSeats` 会诱发误操作；改为只读展示可显著降低运营侧规则违背风险。
- 新增配置路由集成测试可直接锁定“拒绝增发 + 保留补位价格可配置”两条核心行为，避免后续回归。

### 2026-02-26 开发推进发现（P0-2/P0-3 与费路防重）
- 将“生产默认强制”抽成独立策略函数后，托管激活和托管授权可以共用同一判断口径，避免分支漂移。
- 平级奖策略改为“生产默认开启 + 生产关闭审计日志”能兼顾政策一致性与事故应急开关。
- `distributeProfitFee` 增加按 `referrer + sourceTradeId + sourceUserId + type` 的防重查询，可降低重复触发导致的重复计费风险。

### 2026-02-26 开发推进发现（FREE 边界约束）
- 托管订阅入口若仅依赖“生产开关”会在非生产放大误用风险；增加 `preferredMode=FREE` 直接拦截可以稳定模式边界语义。
- custody 授权接口限制为 `MANAGED` 单模式后，可避免产生“FREE 模式授权记录”这类无效审计数据。

### 2026-02-26 开发推进发现（淘汰/SLA 自动化）
- 复用现有管理 API（而不是重复实现业务逻辑）可以让调度脚本天然继承幂等保护（如 `CYCLE_ALREADY_EXECUTED`）。
- SLA 看门狗采用“阈值告警并非直接改状态”更稳妥，避免脚本误操作覆盖运营决策。

### 2026-02-26 新增发现：托管理财闭环仍有核心断点
- 交易员分配仍是“静态主模板”而非“策略化随机匹配”：`managed-wealth-worker` 只取 `product.agents[0]` 并写固定仓位参数（`web/scripts/workers/managed-wealth-worker.ts:80`, `web/scripts/workers/managed-wealth-worker.ts:105`, `web/scripts/workers/managed-wealth-worker.ts:106`）。
- 持仓与净值核算仍按钱包聚合，未按订阅隔离：`UserPosition` 唯一键仅 `walletAddress+tokenId`（`web/prisma/schema.prisma:1052`），worker/withdraw 也按钱包查仓（`web/scripts/workers/managed-wealth-worker.ts:192`, `web/scripts/workers/managed-wealth-worker.ts:517`, `web/app/api/managed-subscriptions/[id]/withdraw/route.ts:146`）。
- 结算后营销分润存在入口不一致：手动提现路径会触发分润（`web/app/api/managed-subscriptions/[id]/withdraw/route.ts:320`），但 admin 批量结算与 worker 自动结算路径未统一触发（`web/app/api/managed-settlement/run/route.ts` 未出现分润调用）。
- 清仓仍保留模拟成交路径：`SYSTEM_LIQUIDATOR` + `sim-liquidation-*` 记录（`web/scripts/workers/managed-wealth-worker.ts:557`, `web/scripts/workers/managed-wealth-worker.ts:565`），会削弱结算可审计性。
- 资金授权与本金占用缺少硬关联账本：虽然已有 funding/custody 记录，但订阅创建阶段尚未形成“可用托管余额 -> 本金占用 -> 释放”闭环约束。
- 收益矩阵主要用于展示和估算，尚未形成“策略承诺 vs 实际表现”的偏离监控与告警机制。
- 历史提交 `007182175ef4aaabd612a32d3ff32ed824802a23` 的目录仍是 `frontend/*`，当前仓库实际运行目录为 `web/*`，导致用户脚本路径容易误用；同时 `web/package.json` 缺少 `seed:agents` 统一入口。

### 2026-02-26 新增发现：可执行收口路径
- 可先做“统一结算服务”作为 P0，打通 manual/worker/admin 三路径同一结算+分润语义，先消除最直接的账务不一致风险。
- 订阅级作用域隔离应成为 P1 主线，优先把持仓/NAV/清仓从钱包聚合改为订阅聚合，再推进多交易员组合分配。
- 分配引擎可复用现有 `trader-scoring-service`、`leaderboard-cache-service`、`smart-money-discovery-service` 作为候选池，不需要从零重建评分体系。
- 需新增 `managed-wealth` 正式 spec（当前未在 `openspec/specs` 列表中），已通过新 change 草案承载需求和任务拆分。

### 2026-02-26 新增发现：Phase A 已落地但仍有后续风险
- 结算写路径与分润触发已在 `withdraw/run/worker` 三入口统一，避免“同业务不同账务语义”。
- `run` 路径已补上“有持仓不结算”护栏，降低提前结算风险。
- 当前全量 `tsc` 仍受前端历史类型错误阻断（`subscription-modal.tsx`），后续发布前需要单独清理该阻断项。

### 2026-02-26 新增发现：Phase B 第一批（订阅维度持仓隔离）已落地
- 通过新增 `ManagedSubscriptionPosition`，managed 结算与清仓判定从“钱包级”切换为“订阅级”，避免同钱包多策略互相卡结算。
- 在 `TradeOrchestrator` 侧按 `copyConfigId -> managedSubscription` 建立作用域并双写持仓，能在不打断现有 `UserPosition` 的前提下逐步迁移。
- `managed-wealth-worker` 清仓路径不再直接把钱包 token 持仓归零，而是按订阅持仓递减 legacy 表，降低跨订阅污染风险。
- 新增回填脚本后，可在读切换前将历史 `CopyTrade` 回放为 scoped positions，减少迁移窗口内“旧仓位丢失”风险。
- 迁移期 fallback 采用“copyTrade token universe + legacy userPosition”保守判定，可优先避免误结算；代价是当同钱包多订阅命中相同 token 时，可能出现短期过度阻塞，需靠回填完成后逐步关闭 fallback。
- 增加 `verify:managed-positions:scope` 对账脚本后，可在正式关闭 fallback 前做量化校验（差异率、回填缺口），降低盲切风险。

### 2026-02-26 新增发现：托管闭环缺少统一运维健康视图
- 结算入口虽已统一，但缺少“映射缺口/清仓积压/分润一致性”三类可观测指标，运营侧无法快速定位卡点。
- 增加 `managed-settlement/health` 聚合接口后，可直接识别：
  - 执行映射缺口（`copyConfigId` 为空且超时）
  - `LIQUIDATING` 积压（有未平仓位但长期未清）
  - 盈利结算后分润缺失或金额偏差（按 `managed-withdraw:<subscriptionId>:<settlementId>` 对账）
- 在 admin 增加 `Managed Ops` 面板比单纯日志排查更有效，能把异常列表直接给运营执行处理。
