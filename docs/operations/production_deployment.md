# PolyHunter 生产环境部署手册 (Production Deployment Manual)

本手册详细说明了如何将 PolyHunter 跟单交易系统部署到支持高并发、大流量的 **Polygon Mainnet** 生产环境。

---

## 1. 基础设施要求 (Infrastructure)

### 服务器配置 (Servers)
- **应用服务器 (App Server)**: Node.js v18+。建议配置: 4 vCPU, 8GB RAM。
- **数据库 (Database)**: **PostgreSQL**。
    - ⚠️ **严禁**在生产环境使用 SQLite，否则会导致并发锁死。
- **RPC 节点 (RPC Nodes)**:
    - **必须**: 1个支持 **WebSocket (WSS)** 的付费节点 (如 Alchemy Growth, Infura Pro)。
    - **原因**: 内存池嗅探 (Mempool Sniping) 和实时跟单必须使用 WebSocket 长连接。免费节点的速率限制会导致由高频交易触发的跟单任务失败。

### 钱包准备 (Wallet Preparation)
- **管理密钥 (Master Mnemonic)**: 需要一套 12 助记词。
    - index 0 (Master) 必须持有足够的 MATIC (建议 > 100 MATIC)。
    - 系统会自动从 Master 向 Worker Fleet (index 1-20+) 分发 Gas。

---

## 2. 环境变量配置 (Environment Setup)

在服务器创建 `frontend/.env` 文件，填入真实生产配置：

```env
# --- 区块链网络 (Blockchain) ---
# ⚠️ 必须是 137 (Polygon Mainnet)
NEXT_PUBLIC_CHAIN_ID=137

# ⚠️ 必须是 WSS 协议 (WebSocket)
# 推荐: Alchemy, Infura, QuickNode 的付费版
NEXT_PUBLIC_RPC_URL="wss://polygon-mainnet.g.alchemy.com/v2/您的API_KEY"

# --- 合约地址 (Contracts) ---
# Executor 合约 (将在部署阶段 1 获得)
NEXT_PUBLIC_EXECUTOR_ADDRESS="" 
# Proxy Factory (通常使用官方部署版本，或自己部署一个)
NEXT_PUBLIC_PROXY_FACTORY_ADDRESS="0xa536e751cc68997e898165b3213eec355e09c6d3"
# USDC 地址 (Polygon)
NEXT_PUBLIC_USDC_ADDRESS="0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"

# --- 敏感密钥 (Secrets) ---
# 用于生成 Worker Fleet 的助记词
TRADING_MNEMONIC="verify occur ... (请妥善保管您的 12 个单词)"

# --- 数据库 (Database) ---
DATABASE_URL="postgresql://user:password@db-host:5432/polyhunter?schema=public"

# --- 安全 (Security) ---
NEXTAUTH_SECRET="请生成一个复杂的随机字符串"
```

---

## 3. 部署流程 (Deployment Sequence)

请严格按以下顺序操作：

### 第一步：部署 Executor 合约
这是 Fleet Commander，负责授权所有 Worker 代理用户执行交易。

```bash
cd poly-hunter/contracts

# 1. 安装依赖
npm install

# 2. 部署到 Polygon 主网
# 确保此时 .env 里是主网配置
npx hardhat run scripts/deploy-executor.ts --network polygon

# ⚠️ 保存输出的 "PolyHunterExecutor deployed to: 0x..." 地址！
# 将其更新到 frontend/.env 的 NEXT_PUBLIC_EXECUTOR_ADDRESS 中。
```

### 第二步：初始化数据库
确保 PostgreSQL 数据库已启动并可连接。

```bash
cd ../frontend

# 1. 安装依赖
npm install

# 2. 同步数据库结构
npx prisma generate
npx prisma db push
```

### 第三步：启动 Supervisor (核心大脑)
Supervisor 是后台守护进程，负责监听链上信号并调度 Worker。**它必须 7x24 小时运行。** 我们使用 PM2 来管理它。

```bash
# 全局安装 PM2
npm install -g pm2

# 启动 Supervisor
# --max-memory-restart 2G 防止内存泄漏导致崩盘
pm2 start "npx tsx scripts/copy-trading-supervisor.ts" --name poly-supervisor --max-memory-restart 2G

# 设置开机自启
pm2 save
pm2 startup
```

**验证启动**:
```bash
pm2 logs poly-supervisor
# 应看到: [WalletManager] Initializing fleet of 20 wallets...
# 应看到: [MempoolDetector] 🦈 Starting Mempool Sniffing...
```

### 第四步：启动 Web 前端
启动用户界面 (Next.js)。

```bash
npm run build
pm2 start "npm start" --name poly-frontend
```

---

## 4. 核心逻辑与风险说明 (Core Logic & Risks)

### ✅ 真实的跟单逻辑
系统采用 **"Bot Proxy 代理人模型"**：
1.  **买入 (BUY)**: Worker Bot 优先用自己的资金垫付 -> 买入 Share -> 将 Share 转给用户 Proxy -> 从用户 Proxy 报销 USDC。
    *   *优势*: 极速成交，无需等待 Proxy 授权。
2.  **卖出 (SELL)**: Worker Bot 从用户 Proxy 提取 Share -> 卖出变现 -> 将 USDC 转回用户 Proxy。
    *   *优势*: 资金与资产最终都沉淀在用户 Proxy 中，Bot 仅作为执行通道。

### ⚠️ 重大风险提示 (Critical Risks)

1.  **RPC 速率限制 (Rate Limiting)**
    *   **风险**: 当大户进行批量操作时，20 个 Worker 可能瞬间发起 100+ 次 RPC 请求。免费节点会直接封禁 IP，导致全线停摆。
    *   **对策**: 务必使用**企业级 RPC 节点**。

2.  **资金垫付风险 (Reimbursement Fail)**
    *   **风险**: Bot 垫资买入 Share 后，试图从 Proxy 报销 USDC 时，发现 Proxy 余额不足（被用户提走了）。导致 Bot 持有资产但亏损现金。
    *   **对策**: 监控 Proxy 余额。商业版建议实现由于余额不足导致的“强制平仓”或“欠款记录”功能。

3.  **API 鉴权**
    *   **说明**: 生产环境下，Worker 首次运行时会自动签名向 Polymarket 申请 API Key。这需要消耗极少量的 Gas 用于建立连接。请确保 Master Wallet 有钱，Auto-Refuel 会自动处理。

---

## 5. 运维常用命令

**查看日志**:
```bash
pm2 logs poly-supervisor
```

**紧急停止**:
```bash
pm2 stop poly-supervisor
```

**扩容 (Scaling)**:
若需支持更多并发用户，修改 `frontend/scripts/copy-trading-supervisor.ts` 中的 `poolSize` (默认 20)，然后重启 Supervisor。
*注意: 增加 Worker 数量意味着需要更多的 Gas 储备。*



要转到 真实生产环境 (Production)，流程大体一致，但有几个关键的“替换”和“注意点”。

以下是生产环境部署的差异与修正清单：

1. 核心差异：不能做的事 (Local vs Prod)
步骤	本地仿真 (Local)	生产环境 (Production)	为什么？
部署 Proxy	setup-local-fork.ts	❌ 不要运行此脚本	本地脚本用的是测试账号。生产环境用户是在前端界面点击“创建账户”来部署 Proxy 的。
资金来源	setup-local-fork.ts (偷大户)	真实充值	生产环境您必须往 Master Wallet 转入真实的 MATIC，用户需往 Proxy 充值真实的 USDC。
触发交易	impersonate- 脚本 (模拟信号)	真实监听	Supervisor 会自动监听链上 CTF Exchange 的真实交易。不需要手动脚本触发。
Mock 模式	自动开启 (ChainID 31337)	自动关闭	当您设置 ChainID=137 时，TradingService 会自动尝试连接真实 Polymarket 接口。
2. 生产环境部署清单 (Checklist)
请按以下步骤将系统推向 Polygon Mainnet：

A. 环境变量修正 (.env)
将 .env 修改为真实的主网配置：

bash
# ⚠️ 必须是 137 (Polygon Mainnet)
NEXT_PUBLIC_CHAIN_ID=137
# ⚠️ 必须是高质量的节点 (Alchemy/Infura付费版)，必须支持 WebSocket (wss://)
# 只有 WebSocket 才能做到毫秒级监听 Mempool
NEXT_PUBLIC_RPC_URL="wss://polygon-mainnet.g.alchemy.com/v2/您的API_KEY"
# ⚠️ 您的真实助记词 (管理整个 Fleet)
TRADING_MNEMONIC="您的 12 个助记词 ..."
# ⚠️ 生产级数据库 (不要用 SQLite 文件)
DATABASE_URL="postgresql://user:pass@AWS_RDS_HOST:5432/mydb"
B. 基础设施部署 (仅需一次)
您需要在主网上部署一个属于您的 Executor 合约（Fleet Commander）。

bash
cd contracts
# 注意：确保此时 .env 里是主网配置
npx hardhat run scripts/deploy-executor.ts --network polygon
执行后，将获得的地址填入 .env 的 NEXT_PUBLIC_EXECUTOR_ADDRESS。

C. 启动服务 (PM2)
生产环境不要直接用 npx tsx 跑前台，要用 PM2 守护进程。 参考 docs/operations/production_deployment.md：

bash
# 启动 Supervisor (7x24小时运行)
pm2 start "npx tsx scripts/copy-trading-supervisor.ts" --name poly-supervisor --max-memory-restart 2G
# 启动前端
npm run build
pm2 start "npm start" --name poly-frontend
3. 需要特别注意的风险
CLOB API 鉴权：
在 Mock 模式下我们跳过了鉴权。
在生产环境，Worker 钱包第一次启动时，会自动签名消息去 Polymarket 申请 API Key。确保 Worker 钱包里有少量的 MATIC，虽然申请 Key 只需签名不耗 Gas，但建立连接和后续下单需要 Gas。
Auto-Refuel 机制会自动解决这个问题，只要您的 Master Wallet 有钱。
RPC 速率限制：
本地测试没有限制。
生产环境如果并发 20 个 Worker 同时查余额或下单，可能会瞬间打爆免费的 RPC 节点。务必使用付费的 Alchemy/Infura 节点，或者在代码中调大 src/core/rate-limiter.ts 的限制。
资金安全：
TRADING_MNEMONIC 控制所有跟单资金。请务必妥善保管。
结论： 代码逻辑已经 Ready。只要改一下配置（Env），部署一次合约（Executor），并给钱包充钱，这套系统就能在 Polygon 主网上跑起来。建议先用小资金（10 USDC）进行一次真实验证。



# 启动 Supervisor (7x24小时运行)
pm2 start "npx tsx scripts/copy-trading-supervisor.ts" --name poly-supervisor --max-memory-restart 2G
# 启动前端
npm run build
pm2 start "npm start" --name poly-frontend