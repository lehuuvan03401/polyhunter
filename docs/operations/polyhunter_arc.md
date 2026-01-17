PolyHunter 系统就像一个紧密的“三层汉堡”结构：链下大脑 (Scripts)、链上肌肉 (Contracts)，以及中间的 API 桥梁。

我为您绘制了一张全景交互图，随后详细解释每个组件的角色。

1. 系统全景交互图
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
2. 核心组件详解
A. 链下脚本 (The Brain) - frontend/scripts/*.ts
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
3. 一个完整的交互剧本
当大户买入 Trump 胜选 Token 时，脚本与合约是这样“接力”的：

侦查: mempool-detector.ts 听到风吹草动。
调度: Supervisor 从 
WalletManager
 借出 Worker #3。
执行 (脚本层): 
execution-service.ts
 计算出要买 1000 股。
上链 (脚本->合约): Worker #3 向 Executor 发送交易：executeOnProxy(ProxyA, "buy 1000")。
鉴权 (合约层): Executor 检查 Worker #3 是自己人，放行。
动作 (合约层): 
ProxyA
 拿着 1000 USDC 去 CTF 市场买了 Token。
结果: Token 进入 
ProxyA
 的肚子。Worker #3 深藏功与名，归队休息。
这就是这套系统即去中心化（资金在 Proxy）又高并发（Worker 集群干活）的奥秘。