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
