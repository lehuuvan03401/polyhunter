# Copy Trading Logic (核心执行逻辑)

> **Last Updated**: 2026-01-18  
> **Core Files**: `copy-trading-supervisor.ts`, `copy-trading-execution-service.ts`

## 1. 真实环境监听逻辑 (The Eyes)

我们的"眼睛"由两部分组成，互为补充：

### A. 🐢 区块监听 (Event Listening)
- **原理**: Supervisor 监听 CTF 合约的 `TransferSingle` 事件
- **代码**: `ctf.on("TransferSingle", handleTransfer)`
- **逻辑**:
  1. 检查 `from`/`to` 是否在 `monitoredTraders` 列表
  2. **[NEW]** 事件去重 (60秒TTL) 防止重复执行
  3. 如果匹配，触发跟单
- **特点**: 绝对可靠，但比大户慢 1 个区块 (~2秒)

### B. 🦈 内存池嗅探 (Mempool Sniping)
- **原理**: 通过 WebSocket 监听 Pending Transactions
- **代码**: `src/core/mempool-detector.ts`
- **逻辑**: 实时捕获待打包交易，解码 `safeTransferFrom` 调用
- **优势**: 理论上能与大户同区块成交

---

## 2. 真实跟单执行逻辑 (The Hands)

执行逻辑采用 **"Bot Proxy 代理人模型"**，保证资金安全。

### 场景一：跟随买入 (BUY)

```
1. [NEW] Filter Check (过滤器验证)
   - 检查 maxOdds: 如果价格 > 用户设定的最大赔率，跳过此交易

2. [NEW] Price Fetch (实时价格获取)
   - 从 OrderBook 获取真实价格 (5秒缓存TTL)
   - 用于精确计算仓位大小

3. Float Check (垫资优化)
   - 有钱：Bot 直接用自己的 USDC 买入
   - 没钱：Bot 从 User Proxy 提取 USDC

4. Market Order (下单)
   - Bot 向 Polymarket CLOB 发送 FOK 市价单

5. Settlement (资产交割)
   - Bot 将 Share 转入 User Proxy
   - [ENHANCED] 如果垫资报销失败，记录债务 (DebtManager)
```

### 场景二：跟随卖出 (SELL)

```
1. [NEW] Balance Check (余额验证)
   - 查询 User Proxy 实际 Token 余额
   - 如果请求卖出量 > 实际余额，自动封顶

2. Token Pull (提货)
   - Bot 从 User Proxy 提取 Share

3. Market Order (抛售)
   - Bot 在市场卖出 Share，换回 USDC

4. Settlement (回款)
   - Bot 将 USDC 转回 User Proxy
```

---

## 3. 新增安全机制 (2026-01 Update)

| 机制 | 描述 | 代码位置 |
|-----|------|---------|
| **价格缓存** | 5秒TTL避免重复API调用 | `getCachedPrice()` |
| **事件去重** | 60秒TTL防止重复交易 | `isEventDuplicate()` |
| **过滤器验证** | maxOdds 等过滤器在执行前校验 | `passesFilters()` |
| **SELL余额检查** | 防止卖出超过实际持有量 | `executeOrderWithProxy()` |
| **债务记录** | 垫资失败时记录IOU | `DebtLogger.logDebt()` |
| **启动时恢复** | Supervisor启动时自动恢复历史债务 | `debtManager.recoverPendingDebts()` |

---

## 4. 重大风险评估 (Risk Assessment)

### 🔴 风险 1：垫资报销失败 (Reimbursement Fail)
- **场景**: Bot 垫资买入后，User Proxy 余额不足
- **后果**: Bot 亏损
- **对策**: ✅ **已实现** - DebtManager 记录债务并定期恢复

### 🔴 风险 2：链路重组 (Chain Reorg)
- **场景**: Mempool 嗅探交易后链发生重组
- **后果**: 跟了一笔不存在的交易
- **对策**: 建议增加 Confirmation Block 设置

### 🔴 风险 3：RPC 节点限流
- **场景**: 大量并发请求导致 429 错误
- **后果**: 跟单失败
- **对策**: 使用付费独享 RPC 节点 (Alchemy/Infura)
