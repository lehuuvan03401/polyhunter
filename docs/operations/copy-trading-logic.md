# Copy Trading Logic (核心执行逻辑)

> **Last Updated**: 2026-03-06  
> **Core Files**: `copy-trading-supervisor.ts`, `trade-orchestrator.ts`, `copy-trading-execution-service.ts`

## 0. Authority Runtime (当前权威链路)

当前自动执行的权威链路是：

`copy-trading-supervisor.ts` -> `sdk/src/core/trade-orchestrator.ts` -> `sdk/src/services/copy-trading-execution-service.ts`

- `copy-trading-supervisor.ts` 负责信号摄取、fanout、queue、guardrail、settlement recovery。
- `trade-orchestrator.ts` 负责 prewrite、执行编排、CopyTrade/UserPosition 落账。
- `copy-trading-execution-service.ts` 负责 proxy/EOA 执行、资金搬运、结算回补。

`copy-trading-worker.ts` 现在仅保留为兼容/手工验证脚本，默认不应作为生产自动执行入口。直接运行旧 worker 需要显式设置 `COPY_TRADING_LEGACY_WORKER_ALLOWED=true`。

## 1. 真实环境监听逻辑 (The Eyes)

### A. 🐢 区块监听 (Event Listening)
- **原理**: Supervisor 监听 CTF 合约 `TransferSingle`，并结合 polling / mempool 作为混合信号源。
- **代码**: `copy-trading-supervisor.ts`
- **逻辑**: 事件去重 -> fanout 到订阅者 -> 进入 queue -> orchestrator 执行。

### B. 🦈 内存池嗅探 (WebSocket)
- **原理**: 通过 WebSocket 订阅 Pending Transactions 或 Mempool。
- **优势**: 毫秒级响应，快于区块确认。

---

## 2. ⚡️ Execution Pipeline (执行管道 - 2026-02 增强版)

新的架构采用了 **"Optimistic Parallel Execution"** (乐观并行执行) 模式，极大地降低了端到端延迟。

### Step 1: 信号捕获与定价 (Quote & Pricing)
*   **Quote Cache**: 优先检查内存中的 Orderbook 价格缓存 (`5s TTL`)。
*   **Fallback**: 如果 Orderbook 不可用，使用 Trade Event 中的即时价格作为参考。
*   **Metric**: `quoteStats` 监控命中率。

### Step 2: 并行预检 (Parallel Preflight)
同时发起以下检查 (利用 `preflightCache` 缓存结果, `2s TTL`):
1.  **Proxy 解析**: 内存缓存 (`Map<User, Proxy>`) -> 链上 Factory。
2.  **资金检查**: 
    *   Proxy USDC 余额
    *   Bot USDC 余额 (Float)
3.  **授权检查**: Proxy 对 CTF/USDC 的 Allowance。
4.  **Guardrails**: 每日限额、最大单笔、滑点保护。

### Step 3: 状态预写 (Prewrite "PENDING")
*   **操作**: 在发起链上交易前，先在 DB 创建 `status: 'PENDING'` 记录。
*   **代码**: `trade-orchestrator.ts`
*   **目的**: 防止由于进程崩溃导致的“幽灵订单”。

### Step 4: 极速执行 (FastTrack Execution)
*   如果预检通过，Supervisor 将任务交给 `TradeOrchestrator`，随后调用 `ExecutionService`。
*   **Scoped Mutex**: 
    *   使用 `scopedTxMutex` (基于 Proxy 地址的细粒度锁)，而不是全局锁。
    *   这允许不同用户的跟单并发执行，互不阻塞。

### Step 5: 结果持久化 & 修复
*   根据执行结果更新 DB (`EXECUTED` / `SETTLEMENT_PENDING` / `FAILED`)。
*   自动执行与 API 兼容入口现在共用同一套 `UserPosition` / `realizedPnL` 写账语义。

---

## 3. 🚀 关键性能优化 (Performance Engine)

### A. Smart Buffer Strategy (智能缓冲/延迟报销)
这是 HFT (高频交易) 模式的核心优化。
*   **旧逻辑**: Bot 垫付买入 -> 立即发起 `transferFrom` 报销 USDC (2笔交易/单)。
*   **新逻辑**: Bot 垫付买入 -> **检查 Bot 余额**:
    *   若 Bot 余额 > $50 (Buffer): **跳过报销**。Bot 暂时持有债权，节省 1 笔链上 TX。
    *   若 Bot 余额不足: 发起报销补货。
*   **收益**: 交易延迟减少 3-5秒，Gas 节省 50%。

### B. TxMonitor (交易监控与加速)
*   **原理**: `TxMonitor` 守护进程监听发出的交易。
*   **动作**: 如果交易在 N 秒内未打包，自动以 `1.2x` Gas Price 发起 **Replacement Transaction**。
*   **保障**: 即使网络拥堵，交易也能在确定时间内上链，避免死锁。

### C. Multi-Layer Caching (多级缓存)
| 缓存层 | 内容 | TTL/策略 | 作用 |
|-------|------|---------|------|
| **ProxyCache** | User -> Proxy 地址 | 永久 (进程级) | 消除 Factory调用 (200ms) |
| **QuoteCache** | Token -> Price | 5秒 / 500条 | 消除 Orderbook 获取延迟 |
| **Preflight** | Balance / Allowance | 2秒 / 1000条 | 防止高频信号打爆 RPC |

---

## 4. 🛡️ 容错与恢复 (Recovery Mechanisms)

### A. Stale Pending Expiration
*   **现状**: `trade-orchestrator.ts` 预写 `PENDING` 时已经写入 `expiresAt`，Supervisor 会定时扫描并把过期 `PENDING` 标记为失败，同时释放 runtime lock。
*   **运维含义**: 如果出现长期停留在 `PENDING` 的记录，优先检查 `SUPERVISOR_STALE_PENDING_RECOVERY_ENABLED`、`COPY_TRADING_PENDING_EXPIRY_MINUTES` 和 Supervisor 是否存活，而不是回退到旧 worker。

### B. Pending Debt Recovery
*   **问题**: Smart Buffer 策略下，Bot 垫付了资金但尚未报销。如果进程重启，内存中的“债权”怎么算？
*   **机制**: 
    1.  垫付失败或延迟报销时，写入 `DebtRecord` (DB)。
    2.  `recoverPendingDebts` 循环每 5 分钟运行一次。
    3.  检查 Proxy 余额，如果充足，发起 `transferFrom` 追回欠款并标记 `REPAID`。
*   **现状补充**: authority runtime 已经接入 `ReimbursementLedger`，BUY 且使用 bot float 的成功执行会创建/刷新 ledger entry，Supervisor 定时 claim + batch flush + retry。

### C. Crash-Safe State
*   所有关键状态（订单、债务）均已持久化。Worker 随时重启不丢失资产。

### D. Market Resolution Ownership
*   **现状**: Supervisor 已订阅 `market_resolved` 事件，并维护 resolution queue / reconciliation loop。winner redeem、loss settlement、`CopyTrade` 结算记录和 `UserPosition` 清账都由 authority runtime 负责。
*   **运维含义**: 旧 worker 不再承担默认 market resolution 责任；它仅作为兼容脚本保留。

### E. Reservation-Safe Guardrails
*   **现状**: Supervisor 在真正执行前为 global / wallet / market / rate guardrail 预留容量，成功后按实际成交额 commit，skip/failure/exception 则 release。
*   **机制**:
    1. `checkExecutionGuardrails` 仍用于 dispatch/preflight 的快速短路。
    2. `reserveGuardrailCapacity` 在 execution 边界做 reservation-safe 判定。
    3. reservation 带 TTL，并由 sweep loop 回收 crash/leak 场景。
*   **运维含义**: 如果 burst fanout 下出现 guardrail 拒单增多，先看 reservation metrics，而不是只看 `CopyTrade` 的已执行总量。

## 5. Rollout Checklist

1. 先执行历史仓位回填：`npm run backfill:copy-trading:positions`，默认 dry-run；确认结果后使用 `APPLY=true` 落库。
2. 先确保 Supervisor 是唯一自动执行入口：默认脚本、Docker worker、compose profile 都应指向 supervisor，legacy worker 仅在显式 `COPY_TRADING_LEGACY_WORKER_ALLOWED=true` 时运行。
3. 打开 recovery flags：确认 stale pending recovery、settlement recovery、ledger flush、guardrail reservations 全部启用。
4. 进入双跑观测窗口时，不要让 legacy worker 和 supervisor 同时自动执行同一信号；兼容链路只能做手工验证或只读观测。
5. 重点观测指标：
   `copy_supervisor_settlement_recovery_*`
   `copy_supervisor_guardrail_reservations_*`
   `copy_supervisor_queue_*`
   `copy_supervisor_reject_*`
6. 下线顺序：
   先确认 `PENDING` / `SETTLEMENT_PENDING` / `ReimbursementLedger(PENDING)` 无异常堆积。
   再停 legacy worker profile。
   最后收紧兼容入口和运维权限。
