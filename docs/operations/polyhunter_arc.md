Horus 系统就像一个紧密的“三层汉堡”结构：链下大脑 (Scripts)、链上肌肉 (Contracts)，以及中间的 API 桥梁。

我为您绘制了一张全景交互图，随后详细解释每个组件的角色。

### 1. 系统全景交互图
mermaid
graph TD
    subgraph "链下大脑 (Off-Chain Scripts)"
        S[Supervisor (总指挥)] -->|1. 监听信号| D[Mempool/Event Detector]
        S -->|2. 分发任务| WM[WalletManager (管家)]
        WM -->|3. 派遣 Bot| W[Worker Bot (打工仔)]
        W -->|4. 调用 API| CLOB[Polymarket API]
        W -->|5. 链上调用| RPC[RPC Node]
    end
    subgraph "链上肌肉 (On-Chain Contracts)"
        RPC -->|6. 鉴权| EX[Executor (工头合约)]
        EX -->|7. 执行| P[Proxy (用户主权钱包)]
        P -->|8. 交互| CTF[CTF Exchange / USDC]
    end
    subgraph "资金流 (Fund Flow)"
        User((User)) -->|充值| P
        P -.->|买入| CTF
        CTF -.->|盈利| P
    end
### 2. 核心组件详解
A. 链下脚本 (The Brain) - web/scripts/*.ts
这是运行在您服务器上的 Node.js 程序。

copy-trading-supervisor.ts
 (最高指挥官)
角色: 这是唯一启动的主进程。它不直接干活，只负责协调。
交互: 它初始化所有子服务，开启 setInterval 循环刷新配置，开启监听器。
mempool-detector.ts (雷达)
角色: 负责监听全网交易。
交互: 连接 WSS RPC -> 过滤 TransferSingle 事件 -> 告诉 Supervisor "大户动手了！"。
wallet-manager.ts
 (人力资源)
角色: 管理 20 个 Worker Bot 的私钥和状态。
交互: Supervisor 喊话 "我要一个人！" -> WalletManager 检查谁有空 -> 派出 Worker #7。
copy-trading-execution-service.ts
 (执行特工)
角色: 封装了所有复杂的业务逻辑（比如：是先垫资还是先转账？滑点怎么设？）。
交互: 它接收 Worker #7 的签名器，向 Executor 合约发指令，或者向 Polymarket CLOB 发订单。
B. 链上合约 (The Muscle) - contracts/*.sol
这是部署在 Polygon 区块链上的智能合约代码。

PolyHunterProxy.sol
 (用户钱包)
数量: 每个用户 1 个。
角色: 存钱、记账、扣费。它是所有交易的发起方 (msg.sender)。
交互: 它只听命于 Owner (用户) 和 Executor。它调用外部合约 (CTF/USDC)。
PolyHunterExecutor.sol
 (工头/鉴权中心)
数量: 全局 1 个 (单例)。
角色: 权限防火墙。
交互:
入口: 只有白名单里的 Worker Bot 可以调用它。
出口: 它去调用用户的 Proxy。
逻辑: "你是 Worker #7 吗？在白名单里？好，我放行你去操作 User A 的 Proxy。"
ProxyFactory.sol
 (兵工厂)
数量: 全局 1 个。
角色: 生产 Proxy。
交互: 用户点击“创建账户” -> Factory Clone 出一个新的 Proxy 合约。
### 3. 一个完整的交互剧本 (Smart Buffer Mode)
当大户买入 Trump 胜选 Token 时，脚本与合约是这样“接力”的：

1.  **侦查**: `mempool-detector.ts` 听到风吹草动。
2.  **调度**: Worker #3 抢到任务。
3.  **执行 (FastTrack)**: 
    *   Worker #3 检查自己兜里有 > 50 USDC。
    *   **直接下单**: Worker #3 向 Polymarket 买入 1000 股 (FOK订单)。
4.  **归仓 (Push)**: 
    *   Worker #3 发起 `Executor.executeOnProxy(PushToken + Reimburse)`.
    *   合约将 Token 从 Worker 转移到 Proxy。
    *   合约判断是否还钱给 Worker (如果 Worker 钱不够)。
5.  **结果**: 用户 Proxy 持有头寸，Worker 完成垫资代买。延迟更低，滑点更小。

### 4. 为什么比传统 Proxy 快？ (Why Faster?)

Horus 2.0 引入了 **"Smart Buffer"** 混合模式。

*   **传统 Proxy**: 资金必须先从 Proxy 拉出来 (tx1) -> 买入 (tx2) -> 还回去 (tx3)。链路太长，容易 miss 机会。
*   **Smart Buffer**: 
    *   Worker 自己持有少量 "Buffer" 资金 (如 $100)。
    *   遇到机会，**Worker 直接垫资买入** (1步完成)。
    *   事后异步结算。
    *   **效果**: 交易延迟从 ~6秒 (3个区块) 降低到 ~2秒 (1个区块)，几乎等同于 EOA 直连的速度，但保留了 Proxy 的资金归集优势。

> **注意**: 这要求 Worker 钱包里不仅有 MATIC (Gas)，还要常备少量 USDC (Buffer)。