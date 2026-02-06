全链路仿真验证指南 (Final Runbook)
为了在本地 100% 真实还原 线上环境，我们需要按顺序初始化所有组件。请打开 4 个终端窗口，严格按以下步骤操作：

🖥️ 终端 1: 启动 Mainnet Fork 节点
这是我们的模拟“主网”。

bash
cd contracts
export ENABLE_FORK=true
# 确保 frontend/.env 中已设置 NEXT_PUBLIC_CHAIN_ID=1337
npx hardhat node

🖥️ 终端 2: 部署基础设施 (合约 & Proxy)
这步会部署 Executor、Factory，并为您的账号创建 Proxy 和充值 USDC，同时初始化 on-chain allowlist 与执行绑定。

bash
# 1. 部署 Executor & 初始化 Worker Fleet + Allowlist
cd contracts
npx hardhat run scripts/deploy-executor.ts --network localhost
# ✅ 脚本会自动更新 .env 中的 NEXT_PUBLIC_EXECUTOR_ADDRESS
# ✅ 脚本会根据 USDC_ADDRESS / CTF_ADDRESS 自动设置 Executor allowlist

# 2. 部署 Factory & 创建 User Proxy
# 注意：此脚本会读取 frontend/.env
npx hardhat run scripts/setup-local-fork.ts --network localhost
# ✅ 脚本会自动更新 .env 中的 NEXT_PUBLIC_PROXY_FACTORY_ADDRESS
# ✅ 新 Proxy 默认绑定 Executor，并在 Proxy/Executor 上初始化 allowlist（USDC + CTF）

(脚本执行完毕后，.env 已自动更新，直接进行下一步)

🖥️ 终端 3: 初始化数据 & 启动 Supervisor
配置跟单关系，并启动监控服务。

bash
cd frontend
# 1. 写入数据库配置 (Master 跟单 0x7099...Trader)
npx tsx scripts/seed-test-config.ts

# 2. 启动 Supervisor (企业版)
# ✅ 特性已激活: 
# - 任务队列 (Job Queue): 防止并发丢单
# - 自动加油站 (Auto-Refuel): 监控 Fleet 余额
# - 内存池嗅探 (Mempool Sniping): 支持批量转账
# ✅ 本地仿真优化:
# 当检测到 Localhost (ChainID 31337) 时，TradingService 会自动进入 "Mock Mode"：
# 跳过真实 CLOB 鉴权，模拟下单成功，避免 401/404 错误。

npx tsx scripts/copy-trading-supervisor.ts

您应该看到 Supervisor 启动并显示 Fleet: 20/20 ready，且能够看到 [TaskQueue] 日志。

🖥️ 终端 4: 触发模拟交易 (Trigger)
模拟那个被跟单的大户 (0x7099...) 发起交易。

bash
cd frontend
# 模拟普通转账
npx tsx scripts/impersonate-mainnet-trade.ts
# 或者模拟批量转账 (测试 Mempool Detector)
# npx tsx scripts/impersonate-batch-trade.ts (如果已创建)

👀 预期结果 (Success Criteria):

终端 4 显示 ✅ Signal Sent!。
终端 3 (Supervisor) 显示：
🚨 SIGNAL DETECTED
Dispatching 1 jobs...
CopyExec 日志流畅输出：
*   **Standard**: `Pull Funds` -> `Place Order` -> `Push`
*   **Smart Buffer**: `Check Buffer` -> `Place Order` -> `Push` -> `Reimburse` (并行/异步)
最后显示 ✅ Job Complete。
如果不报错，恭喜您！这套系统已经准备好上战场了。

---

## Copy Trading 执行环境变量（核心）

完整清单见 `frontend/.env.example`。以下是执行相关的核心项：

- `ENABLE_REAL_TRADING`：真实执行开关
- `COPY_TRADING_EXECUTION_ALLOWLIST`：执行白名单（可选）
- `COPY_TRADING_MAX_TRADE_USD`：单笔上限（可选）
- `COPY_TRADING_DAILY_CAP_USD` / `COPY_TRADING_WALLET_DAILY_CAP_USD`：日限额（可选）
- `COPY_TRADING_RPC_URL` / `COPY_TRADING_RPC_URLS`：执行 RPC（支持多节点兜底）
- `COPY_TRADING_WORKER_KEYS` / `COPY_TRADING_WORKER_INDEX`：多 Worker 分片
- `COPY_TRADING_MAX_RETRY_ATTEMPTS`：失败重试次数

建议在启动 worker 前运行就绪检查：
```
npx tsx scripts/verify/copy-trading-readiness.ts
```

---

## Supervisor 扩容与共享存储（多实例）

当需要 **多实例部署** 来支撑大量用户/跟单量时，建议启用共享存储与分片：

### 1) 共享 Redis（队列 + 去重 + Guardrail 计数）
设置以下任一环境变量：
- `SUPERVISOR_REDIS_URL`（优先）
- `REDIS_URL`（兜底）

若未设置，将退回内存模式（仅适用于单实例）。
如需启用 Redis，请确保已安装 `ioredis`（在 `frontend` 目录执行 `npm install ioredis`）。

### 2) 分片（避免多实例重复处理）
每个实例设置不同分片：
- `SUPERVISOR_SHARD_COUNT=4`
- `SUPERVISOR_SHARD_INDEX=0|1|2|3`

### 3) 监听过滤（降低 WS 噪声）
默认启用地址过滤：
- `SUPERVISOR_WS_FILTER_BY_ADDRESS=true`（默认）
设置为 `false` 将订阅全量 activity。

### 4) 性能调参
- `SUPERVISOR_FANOUT_CONCURRENCY=25`：同一交易的并发分发上限
- `SUPERVISOR_QUEUE_MAX_SIZE=5000`：队列容量（满则丢弃并记录指标）
- `SUPERVISOR_QUEUE_DRAIN_INTERVAL_MS=500`：队列自动排空周期
- `SUPERVISOR_DEDUP_TTL_MS=60000`：去重 TTL
- `SUPERVISOR_GUARDRAIL_CACHE_TTL_MS=5000`：Guardrail 计数缓存 TTL
- `SUPERVISOR_MARKET_META_TTL_MS=300000`：市场元数据缓存 TTL
- `SUPERVISOR_WORKER_POOL_SIZE=20`：每实例 worker 数量（默认 20）
- `SUPERVISOR_CONFIG_REFRESH_MS=10000`：增量配置刷新间隔
- `SUPERVISOR_CONFIG_FULL_REFRESH_MS=300000`：全量配置重建间隔

### 5) 容量规划（10k 用户基线）
假设：10k 用户 × 每人跟 10 个交易员 × 每人 5k 单/天。

- 总跟单量/天：50,000,000
- 平均跟单量/秒：约 579/s
- 若平均执行延迟 250ms，20 workers/实例 → 单实例吞吐约 80/s
- 建议实例数：8（均值）/ 16（2x headroom）/ 24（3x 峰值）

相关部署步骤见：`docs/operations/deploy-supervisor-capacity-controls.md`

---

## 主网迁移步骤（新合约逻辑）

当合约逻辑有变更（如 Executor 绑定、allowlist、pause）时，需要 **重新部署** 并迁移用户到新 Proxy。建议步骤如下：

### 1) 部署新 Executor + 设置 Allowlist
```bash
cd contracts
USDC_ADDRESS=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 \
CTF_ADDRESS=0x4D97DCd97eC945f40cF65F87097ACe5EA0476045 \
npx hardhat run scripts/deploy-executor.ts --network polygon
```
输出新的 `NEXT_PUBLIC_EXECUTOR_ADDRESS`，并确保 **Executor allowlist 已包含 USDC + CTF**。

### 2) 部署新 ProxyFactory（绑定新 Executor）
```bash
cd contracts
USDC_ADDRESS=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 \
CTF_ADDRESS=0x4D97DCd97eC945f40cF65F87097ACe5EA0476045 \
npx hardhat run scripts/deploy.ts --network polygon
```
输出新的 `ProxyFactory/Treasury/Executor` 地址，并更新 `.env` / `deployed-addresses.json`。

### 3) 更新运行环境
- `PROXY_FACTORY_ADDRESS` / `EXECUTOR_ADDRESS` / `USDC_ADDRESS` / `CTF_ADDRESS`
- `NEXT_PUBLIC_*` 前端地址同步更新

### 4) 为执行钱包创建 Proxy
使用执行钱包（TRADING_PRIVATE_KEY）在新 Factory 上创建 Proxy（或通过前端用户钱包创建）。

### 5) 迁移用户资金（旧 Proxy -> 新 Proxy）
建议策略（按需选择）：
- **用户主动迁移**：用户自行提款 → 再入金到新 Proxy
- **运营协助**：提供迁移提示与引导（避免直接代转）

### 6) 废弃旧 Proxy
- 旧 Proxy 不具备新的安全护栏（allowlist/pause/绑定），建议 **停止新交易** 并引导迁移。


setup-local-fork.ts 的说明：

部署 Executor (🚀 Deploying Executor):
部署执行中枢合约，并初始化 allowlist（默认 USDC.e + CTF）。
部署 ProxyFactory (🏭 Deploying ProxyFactory):
虽然主网上已经有 Factory 了，但我们在本地无法控制它（比如无法随意设置 Owner）。
所以我们部署一个全新的、属于您的 Factory。通过构造函数，我们将它指向真实的 USDC 和 CTF，并绑定 Executor，这样它创建出来的 Proxy 就能和真实世界的合约交互，并且执行入口受控。
创建 Proxy Wallet (👤 Creating Proxy):
调用刚才部署的新 Factory，为您（Hardhat 默认账号 #0）创建一个智能合约钱包。
充值 USDC (💰 Funding Proxy):
这是最酷的一步。您的新 Proxy 钱包刚创建，里面没钱。
脚本使用 hardhat_impersonateAccount 功能，冒充了一个已知的 USDC 巨鲸用户（Binance 热钱包 0xe780...）。
脚本强制让这个巨鲸给您的 Proxy 转账 1000 USDC。
这只有在 Fork 模式下才能做到（我们在本地拥有上帝视角，可以控制任意账户），从而免去了测试时找水龙头领币的麻烦。
