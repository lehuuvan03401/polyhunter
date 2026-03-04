# 托管理财 (Managed Wealth) 流程与核心逻辑

托管理财系统的核心目标是允许用户将资金投入到预设的理财产品（`ManagedProduct`）中，系统会自动通过“跟单交易（Copy Trading）”或底层策略运行资金，并在周期结束时进行结算和利润分配。以下是系统完整的流程与逻辑拆解：

## 一、核心数据模型 (Data Models)
1. **`ManagedProduct` (理财产品)**: 定义产品的大类（如保守型、稳健型、激进型），包含绩效费率、披露策略、是否保本等配置。
2. **`ManagedTerm` (理财周期)**: 挂载在理财产品下的具体投资期限（如 7天、30天、90天等），包含目标收益率区间、最大回撤等指标。
3. **`ManagedReturnMatrix` (收益矩阵)**: 定义了不同投入资金量（如A/B/C档）在不同周期（7/30/90天等）下的预期年化收益率。
4. **`ManagedSubscription` (用户认购/订单)**: 用户实际参与的理财订单。包含本金、开始时间、到期时间、水位线（高水位法计算盈利）以及当前状态等。状态机：`PENDING` -> `RUNNING` -> `MATURED` -> `LIQUIDATING` -> `SETTLED`。
5. **`CopyTradingConfig` / `ManagedSubscriptionExecutionTarget`**: 认购资金实际映射到的底层交易账号/带单员，负责把资金投入到真实市场。

## 二、前端用户流程 (Frontend Flow)
_对应的页面：`app/[locale]/managed-wealth/page.tsx`_

1. **产品展示与计算**：
   - 页面加载时请求后端的 `ManagedProduct` 列表和 `ManagedReturnMatrix` 收益矩阵。
   - 用户在页面上输入**预期投入资金**，选择**投资周期**（如30天）。前端根据投入金额划分档位（如 \<=5000U 为 A 档），结合周期，实时展示预估投资回报（例如，预估收益 $50.00）。
2. **发起认购**：
   - 用户确认后点击 `Subscribe`（通过 `app/api/managed-wealth/subscribe` 接口提交）。
   - 后端创建一条状态为 `PENDING` 的 `ManagedSubscription` 记录，并锁定用户的资金（通过 `ManagedPrincipalReservationLedger` 预留本金）。

## 三、后台执行流程 (Backend Worker Logic)
_对应的脚本：`scripts/workers/managed-wealth-worker.ts`_

后台存在一个定时循环（默认每分钟运行一次的 Worker），处理理财订单在整个生命周期中的自动流转：

1. **分配与启动 (`ensureExecutionMappings`)**:
   - 扫描状态为 `PENDING` 的新认购。
   - 系统将用户的资金（本金）分配给产品绑定的底层跟单策略（`AgentTemplate` / 带单员）。
   - 创建 `CopyTradingConfig` 以追踪这些子账号，并将认购状态更改为 `RUNNING`（开始生息）。

2. **每日计算 NAV 净值 (`refreshNavSnapshots`)**:
   - 扫描状态为 `RUNNING` 或处于清算中的订阅。
   - 查询当前底层的实际总权益（持仓资产 + 现金余额），计算出每份订阅的最新净值（NAV）和资产总额，写入 `ManagedNavSnapshot` 供用户在控制台查看。

3. **到期标记 (`markMaturedSubscriptions`)**:
   - 检查已到期（当前时间 > `endAt`）的 `RUNNING` 订阅。
   - 将它们标记为 `MATURED`（已成熟）。这会触发接下来的清算平仓逻辑。

4. **强制平仓 (`liquidateSubscriptions`)**:
   - 对 `MATURED`（到期）或 `CANCELLED`（中途取消）的订阅执行资产清算。
   - 系统会卖出底层所有挂钩的头寸，将各类资产转换回 USDC 本金账户。
   - 当所有头寸变现后，订阅状态将变为就绪，等待结算。

5. **资金结算 (`settleMaturedSubscriptions`)**:
   - 对于所有已平仓准备退出的订阅进行结算。
   - 计算逻辑：**最终资产 (Final Equity) - 初始本金 (Principal) = 毛利 (Gross PNL)**。
   - **高水位法则 (High Water Mark)**：系统采用高水位线提取性能表现费（通常比如总利润的 20%提取为平台性能费，剩下的 80% 返还给用户）。
   - 给平台推广员发放佣金，更新储备金池（如果有保本逻辑）。
   - 最终将计算好的扣除费用后的金额释放给用户的钱包。
   - 订阅状态变更为最终的 `SETTLED`（已结算）。

6. **风险控制与保本机制 (`enforceGuaranteedPause` / `ReserveFundLedger`)**:
   - 如果产品标记为“保本”（`isGuaranteed: true`），系统会引入一个**储备金 (Reserve Fund)**。
   - 在结算时，如果用户产生了亏损，系统会利用储备池对用户进行补偿，确保退回金额等于本金或约定的保底资金。
   - 如果储备池自身资金严重不足而跌破警戒线，Worker会触发全局熔断机制，暂停接受新的订阅（Pause New Entries）并可能强制降低仓位杠杆。

## 总结
**前端**是一个收益预测与申购的终端，**后端**是一个资金流机器，**Worker**则是真正的心脏，它不停轮询并依据时间戳和资产净值在 **“申购建仓 -> 运行计算 -> 到期平仓 -> 利润分配与结算”** 几个阶段中安全地流转用户的资金。
