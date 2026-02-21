# 真实跟单系统全链路交互与资金流转指南
(Real Copy Trading: Full Chain Interaction & Fund Flow Guide)

本文档详细记录了 PolyHunter 真实跟单系统的内部架构、交互流程以及用户视角的资金流转闭环。

---

## Part 1: 全链路交互图 (The Full Interaction Pipeline)

系统核心由 **UI 控制台**、**数据库**、**后台 Worker** 和 **执行服务** 组成。

### 1️⃣ 用户配置 (Frontend -> DB)
*   **交互**: 用户在 `CopyTraderModal` 设置参数（如 "Fixed $10", "Auto-Slippage"）并启动任务。
*   **代码**: `web/components/copy-trading/copy-trader-modal.tsx`
*   **动作**: 发送 POST 请求到 `/api/copy-trading/config`。
*   **结果**: 在数据库 `CopyTradingConfig` 表中根据用户签名创建一条配置记录。此步骤**不触发**任何交易，仅完成“意图注册”。

### 2️⃣ 信号捕获 (Worker -> Listener)
*   **交互**: 后台 `copy-trading-worker.ts` 进程持续监听 Polymarket 实时数据流。
*   **代码**: `scripts/copy-trading-worker.ts` + `src/services/ctf-event-listener.ts`
*   **动作**:
    *   Worker 启动时加载所有 `Active` 的配置。
    *   通过 WebSocket 订阅全市场或特定地址的交易事件。
    *   当收到 `Trade` 事件时，毫秒级比对：`Trader == Config.traderAddress`?

### 3️⃣ 执行决策 (Worker Trigger)
这里的核心是“竞速” (Race against latency)。
*   **代码**: `scripts/copy-trading-worker.ts` (Fast Track Logic)
*   **流程**:
    1.  **匹配成功**: 命中跟单规则。
    2.  **风控预检**: 检查日限额、单笔上限、余额充足性。
    3.  **快速通道**: 如果检查通过，**立即**调用执行服务 (不等待数据库 I/O)。

### 4️⃣ 核心执行 (Execution Service) **[The Muscle]**
这是系统的执行引擎，负责资金调度和原子化交易。
*   **代码**: `src/services/copy-trading-execution-service.ts`
*   **流程**:
    1.  **并行预检 (Parallel Fetches)**: 同时请求 Gas Price (Gas Station)、Proxy 余额、Polymarket 盘口深度。
    2.  **乐观授权 (Optimistic Allowance)**: 除非余额不足，否则跳过上链授权步骤。
    3.  **资金调度**:
        *   **Standard Mode**: 如果 Proxy 余额不足，通过 `transferFromProxy` 拉取。
        *   **Smart Buffer (New)**: 如果 Bot 定义了 Buffer 且余额充足 (> $50)，**跳过**链上拉取，直接垫资。
    4.  **原子下单**: 调用 Polymarket CLOB API 下达 **Market Order** 并带有 **FOK (Fill-Or-Kill)** 标志。
        *   要么全部成交，要么全部失败。不留残单。

### 5️⃣ 记录与反馈 (DB -> UI)
*   **代码**: `web/lib/hooks/useOrderStatus.ts`
*   **交互**:
    *   Worker 将最终结果写入 `CopyTrade` 数据库表 (状态: `EXECUTED` / `FAILED`)。
    *   前端 `PortfolioPage` 轮询 `/api/copy-trading/orders`。
    *   用户界面更新，显示跟单成功状态。

---

## Part 2: 用户资金流转闭环 (User Fund Flow)

核心设计思想：**“Proxy (代理合约) 是金库，Bot (机器人) 是跑腿员”**。

### 1. 登录与初始化 (Onboarding)
*   **动作**: 用户登录。系统检查是否有 Proxy 合约。
*   **结果**: 若无，调用 `ProxyFactory.createProxy` 部署专属智能合约钱包 (Smart Contract Wallet)。这是用户的**专属金库**。

### 2. 入金 (Funding)
*   **动作**: 用户点击 "Deposit"。
*   **流向**: `User EOA (MetaMask)` -> `Proxy Contract`。
*   **底层**:
    1.  `USDC.approve(Proxy)`
    2.  `Proxy.deposit(amount)`
*   **状态**: 资金安全地躺在 Proxy 合约中，只有用户 (Owner) 和绑定的 Executor 合约可动用。

### 2.5 合约级安全护栏 (On-chain Guardrails)
*   **执行入口**: `Proxy.execute` 仅允许 Owner 或绑定的 Executor 调用。
*   **目标白名单**: Proxy + Executor 仅允许调用已批准的目标合约（默认 USDC.e + CTF）。
*   **紧急暂停**: 平台可在链上暂停执行，但不影响入金/提现。

### 3. 跟单交易 (Real Trading - "The Flash Transfer")
客户无感，后台自动完成的“闪电中转”：

1.  **提款 (Pull)**: Bot 发现交易机会。
    *   **Standard**: `Proxy Contract` -> `Bot Wallet` (10 USDC)。
    *   **High Performance**: **跳过此步**。Bot 使用自有资金垫付。
2.  **交易 (Trade)**: Bot 拿着钱去交易所买货。
    *   流向: `Bot Wallet` -> `Polymarket Exchange` -> `Bot Wallet` (获得 Token)。
3.  **归仓 (Push)**: 交易完成瞬间，Bot 将 Token 存回金库。
    *   流向: `Bot Wallet` -> `Proxy Contract` (Positions)。
    *   **报销 check**: 如果 Bot 垫付了资金：
        *   若 Bot 余额充足: **暂不报销** (Proxy 欠 Bot 10 USDC)。
        *   若 Bot 余额不足: 立即发起 `transferFromProxy` 报销。
*   **结果**: 用户的 Proxy 账户持有头寸。在高性能模式下，用户资金 (USDC) 可能暂时未动，这就解释了由 Smart Buffer 带来的 **"无感交易"** 体验。

### 4. 结算 (Settlement)
*   **触发**: 市场决议 (Resolution)。
*   **动作**: Worker 监听到决议事件。
*   **流向**: `Polymarket CTF` -> `Proxy Contract` (Winning USDC)。
*   **结果**: 盈利直接回到金库，实现复利基础。

### 5. 提现 (Withdrawal)
*   **动作**: 用户点击 "Withdraw"。
*   **流向**: `Proxy Contract` -> `User EOA`。
*   **底层**: `Proxy.withdraw(amount)`。合约验证 Owner 权限后放款。
