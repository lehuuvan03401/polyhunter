# 自动跟单系统详解 (Supervisor Edition)

> [!IMPORTANT]
> **状态**: 功能已上线并验证 (2026-02)  
> **核心脚本**: `web/scripts/copy-trading-supervisor.ts`  
> **架构**: 并行钱包舰队 (Parallel Wallet Fleet) - 无 Nonce 阻塞

## 1. 概览 (Overview)

为了支持大规模并发 (1000+ 用户)，我们将架构从单工模式升级为 **Supervisor (总管) 模式**。

-   **钱包舰队 (Wallet Fleet)**: 20+ 个 "操作员钱包" (Operator Wallets)，全部由 `TRADING_MNEMONIC` 派生。
-   **并行执行**: 每个用户分配一个独立的操作员钱包 (互不阻塞 Nonce)。
-   **高性能**: 零延迟 RPC 监听 + 内存化任务分发。

## 2. 配置 (Configuration)

```env
# 钱包舰队的总控助记词 (Master Mnemonic)
TRADING_MNEMONIC="your twelve word phrase here ..."
```

## 3. 如何运行 (生产环境)

```bash
cd Horus/frontend
# 导出环境变量并运行
export $(grep -v '^#' .env | xargs) && npx tsx scripts/copy-trading-supervisor.ts
```

> [!TIP]
> **守护进程模式**: 使用 PM2 后台运行
> `pm2 start "npx tsx scripts/copy-trading-supervisor.ts" --name poly-supervisor`

## 4. 架构组件 (Architecture Components)

| 组件 | 职责 |
| :--- | :--- |
| **Detector (侦查员)** | 监听区块链上的 `TransferSingle` 事件。 |
| **WalletManager (管家)** | 管理操作员钱包的 "借出/归还" (Checkout/Checkin)。 |
| **Dispatcher (调度员)** | 将信号与订阅者匹配，并创建执行任务 (Jobs)。 |
| **ExecutionService (特工)** | 使用分配的操作员钱包执行具体交易。 |
| **DebtManager (催收员)** | 负责追回因垫资失败而产生的 Pending 债务。 |
| **TxMonitor (监工)** | 监控发出的交易，如果卡住 (Stuck) 则自动加速。 |

## 5. 新特性 (2026-02 Update)

| 特性 | 描述 |
| :--- | :--- |
| **Smart Buffer** | 智能缓冲策略：Bot 垫资执行，大幅降低延迟。 |
| **Price Caching** | 5秒 TTL 缓存 OrderBook 价格，减少 API 请求。 |
| **Event Deduplication** | 60秒 TTL 事件去重，防止重复跟单。 |
| **Preflight Caching** | 2秒 TTL 缓存余额/授权，保护 RPC 节点。 |
| **Scoped Mutex** | 基于 Proxy 地址的细粒度锁，实现高并发安全。 |
| **Startup Debt Recovery** | 启动时自动恢复历史债务。 |
| **Periodic Debt Recovery** | 每 2 分钟自动运行一次债务回收任务。 |

## 6. 启动日志示例

```text
[Supervisor] 🩺 Checking for pending debts from previous sessions...
[WalletManager] Initializing fleet of 20 wallets...
[WalletManager] Loaded Worker #0: 0xf39F...
[WalletManager] Loaded Worker #1: 0x7099...
[Supervisor] Refreshed: 5 strategies. Fleet: 20/20 ready.
[Supervisor] 🎧 Listening for TransferSingle events...
```

## 7. 企业级架构说明

### A. Wallet Fleet & Supervisor
**状态**: ✅ **Production Ready**

-   `WalletManager` 维护一个包含 20 个隔离 `ethers.Wallet` 实例的池子。
-   `Supervisor` 将任务分发给空闲的 Worker。
-   **Auto-Refuel**: 当 Worker 原生代币余额 < 0.1 MATIC 时，自动从主钱包分发 Gas。

### B. Mempool Sniping (Alpha Layer)
**状态**: ⚠️ **Experimental**

-   需要 **WebSocket (WSS)** 提供商或私有节点。
-   标准的 HTTP 轮询太慢，无法实现真正的抢跑/跟单。
