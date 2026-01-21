# PolyHunter 生产环境部署手册 (Production Deployment Manual)

本手册详细说明了如何将 PolyHunter 跟单交易系统部署到支持高并发、大流量的 **Polygon Mainnet** 生产环境。

---

## 目录 (Table of Contents)

1. [基础设施要求 (Infrastructure)](#1-基础设施要求-infrastructure)
2. [安全性 (Security)](#2-安全性-security)
3. [监控与告警 (Monitoring & Alerting)](#3-监控与告警-monitoring--alerting)
4. [数据库 (Database)](#4-数据库-database)
5. [性能优化 (Performance Optimization)](#5-性能优化-performance-optimization)
6. [部署流程 (Deployment Process)](#6-部署流程-deployment-process)
7. [资金管理 (Fund Management)](#7-资金管理-fund-management)
8. [测试与验证 (Testing & Validation)](#8-测试与验证-testing--validation)
9. [运维管理 (Operations Management)](#9-运维管理-operations-management)
10. [风险控制 (Risk Control)](#10-风险控制-risk-control)
11. [合规性 (Compliance)](#11-合规性-compliance)
12. [成本控制 (Cost Control)](#12-成本控制-cost-control)
13. [快速检查清单 (Quick Checklist)](#13-快速检查清单-quick-checklist)

---

## 1. 基础设施要求 (Infrastructure)

### 服务器配置 (Servers)
- **应用服务器 (App Server)**: Node.js v18+。建议配置: 4 vCPU, 8GB RAM。
- **数据库 (Database)**: **PostgreSQL**。
    - ⚠️ **严禁**在生产环境使用 SQLite，否则会导致并发锁死。
- **RPC 节点 (RPC Nodes)**:
    - **必须**: 1个支持 **WebSocket (WSS)** 的付费节点 (如 Alchemy Growth, Infura Pro)。
    - **原因**: 内存池嗅探 (Mempool Sniping) 和实时跟单必须使用 WebSocket 长连接。免费节点的速率限制会导致由高频交易触发的跟单任务失败。

### 网络与域名
- 配置 HTTPS 证书
- 设置 CDN 加速静态资源
- 配置防火墙规则
- 考虑多区域部署提高可用性

### 钱包准备 (Wallet Preparation)
- **管理密钥 (Master Mnemonic)**: 需要一套 12 助记词。
    - index 0 (Master) 必须持有足够的 MATIC (建议 > 100 MATIC)。
    - 系统会自动从 Master 向 Worker Fleet (index 1-20+) 分发 Gas。

---

## 2. 安全性 (Security)

### 密钥管理
- **TRADING_MNEMONIC**: 使用硬件钱包或专业密钥管理服务
- **NEXTAUTH_SECRET**: 生成强随机字符串
- **API Keys**: 使用环境变量管理，不要硬编码
- 考虑使用 AWS Secrets Manager 或 HashiCorp Vault

### 访问控制
- 数据库访问白名单
- API 接口限流和认证
- 管理后台二次验证
- 敏感操作审计日志

### 合约安全
- 审计智能合约代码
- 多签钱包管理 Treasury
- 设置合理的费用上限
- 实现紧急暂停机制

### 网络安全
- 启用 DDoS 防护
- 配置 WAF (Web Application Firewall)
- 定期安全扫描
- 漏洞修复流程

---

## 3. 监控与告警 (Monitoring & Alerting)

### 应用监控
- **PM2 监控**: Supervisor 和前端进程状态
- **日志收集**: 集中化日志管理 (ELK Stack, Grafana Loki)
- **性能指标**: CPU、内存、响应时间
- **错误追踪**: 异常自动告警

### 业务监控
- Worker 钱包余额监控
- 交易成功率统计
- 套利机会检测
- 智能资金跟单延迟
- 用户活跃度

### 告警配置
- 服务异常重启
- RPC 节点连接失败
- 数据库连接异常
- 交易失败率过高 (>5%)
- Gas 费异常波动 (>200%)
- Worker 余额不足 (<1 MATIC)

### 监控工具推荐
- **Prometheus + Grafana**: 指标收集和可视化
- **Sentry**: 错误追踪
- **PagerDuty/钉钉/企业微信**: 告警通知

---

## 4. 数据库 (Database)

### 生产配置
- **严禁使用 SQLite**，会导致并发锁死
- 使用 PostgreSQL 主从复制
- 配置连接池 (建议 20-50 连接)
- 定期备份策略

### 性能优化
- 添加必要索引
- 查询优化
- 缓存热点数据
- 分库分表（如需要）

### 备份与恢复
- 每日自动备份
- 异地备份存储
- 定期恢复演练
- 保留 30 天历史

### 监控指标
- 连接数
- 查询响应时间
- 慢查询日志
- 磁盘使用率

---

## 5. 性能优化 (Performance Optimization)

### 前端优化
- 启用 Next.js 静态生成 (ISR)
- 图片懒加载和压缩
- 代码分割
- CDN 加速
- Gzip/Brotli 压缩

### 后端优化
- 速率限制调优
- 缓存策略优化 (Redis)
- 数据库查询优化
- WebSocket 连接池管理

### RPC 优化
- 多节点负载均衡
- 请求队列管理
- 失败重试机制
- 节点健康检查

### 性能基准
- API 响应时间 < 200ms
- 页面加载时间 < 2s
- WebSocket 延迟 < 100ms
- 数据库查询 < 100ms

---

## 6. 环境变量配置 (Environment Setup)

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

## 7. 部署流程 (Deployment Process)

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

## 8. 资金管理 (Fund Management)

### Master Wallet
- 持有 > 100 MATIC 用于 Gas 分发
- 启用 Auto-Refuel 机制
- 定期充值监控
- 设置余额告警阈值 (< 20 MATIC)

### Worker Fleet
- 20+ 个 Worker 账号
- 自动 Gas 分发机制
- 余额不足告警
- 异常 Worker 自动隔离

### 用户资产
- Proxy 资金隔离
- 垫付报销机制
- 余额不足保护
- 资金流向审计

### 费用管理
- Gas 费优化 (GAS 价格监控)
- 交易成本统计
- 费用分摊机制
- 利润计算

---

## 9. 测试与验证 (Testing & Validation)

### 部署前测试
- Amoy 测试网完整测试
- 压力测试（高并发场景，100+ 并发用户）
- 安全渗透测试
- 灾难恢复演练

### 功能测试清单
- [ ] 用户创建 Proxy
- [ ] 充值 USDC
- [ ] 跟单配置
- [ ] 实时跟单执行
- [ ] 资金报销
- [ ] 费用收取
- [ ] 资产提取

### 性能测试
- API 响应时间测试
- 并发交易测试
- WebSocket 稳定性测试
- 数据库性能测试

### 灰度发布
- 小流量验证 (1% 用户)
- 逐步扩大范围 (5% -> 20% -> 50%)
- 监控关键指标
- 快速回滚准备

---

## 10. 运维管理 (Operations Management)

### 日常运维命令
```bash
# 查看日志
pm2 logs poly-supervisor

# 查看状态
pm2 status

# 重启服务
pm2 restart poly-supervisor

# 停止服务
pm2 stop poly-supervisor

# 查看监控
pm2 monit
```

### 扩容 (Scaling)
修改 `frontend/scripts/copy-trading-supervisor.ts` 中的 `poolSize` (默认 20)，然后重启 Supervisor。
*注意: 增加 Worker 数量意味着需要更多的 Gas 储备。*

### 版本管理
- Git 分支策略 (main -> develop -> feature)
- 版本回滚方案
- 数据迁移脚本
- 配置变更记录

### 日志管理
- 日志轮转配置
- 日志保留策略 (30 天)
- 敏感信息脱敏
- 日志分析工具

---

## 11. 风险控制 (Risk Control)

### 已知风险及对策

#### 1. RPC 速率限制
- **风险**: 当大户进行批量操作时，20 个 Worker 可能瞬间发起 100+ 次 RPC 请求。免费节点会直接封禁 IP，导致全线停摆。
- **对策**: 务必使用**企业级 RPC 节点**，配置多节点负载均衡。

#### 2. 资金垫付风险
- **风险**: Bot 垫资买入 Share 后，试图从 Proxy 报销 USDC 时，发现 Proxy 余额不足（被用户提走了）。导致 Bot 持有资产但亏损现金。
- **对策**: 监控 Proxy 余额。商业版建议实现由于余额不足导致的"强制平仓"或"欠款记录"功能。

#### 3. API 鉴权
- **说明**: 生产环境下，Worker 首次运行时会自动签名向 Polymarket 申请 API Key。这需要消耗极少量的 Gas 用于建立连接。请确保 Master Wallet 有钱，Auto-Refuel 会自动处理。

#### 4. Gas 费波动
- **风险**: Gas 费突然上涨导致交易成本过高
- **对策**: 实时监控 Gas 价格，设置最大 Gas 限制，暂停高 Gas 交易

#### 5. 智能合约漏洞
- **风险**: 合约代码漏洞导致资产损失
- **对策**: 代码审计、多签控制、紧急暂停机制

### 应急预案
- 服务异常处理流程
- 资金异常冻结机制
- 合约紧急暂停
- 用户资产保护措施
- 数据恢复流程

### 风险监控指标
- 交易失败率
- 资金异常流动
- 异常交易模式
- 系统异常日志

---

## 12. 合规性 (Compliance)

### 法律合规
- 用户协议和隐私政策
- KYC/AML 要求（如适用）
- 数据保护法规（GDPR、CCPA 等）
- 证券法合规（如适用）

### 数据管理
- 交易记录保存 (至少 7 年)
- 用户数据加密
- 数据访问控制
- 数据删除政策

### 审计要求
- 审计日志记录
- 操作追溯能力
- 定期安全审计
- 合规性报告

### 透明度
- 费用结构公开
- 风险披露
- 用户教育
- 投诉处理机制

---

## 13. 成本控制 (Cost Control)

### 成本构成
- RPC 节点费用
- Gas 费用
- 服务器费用
- 数据库费用
- 监控和告警费用

### 优化策略
- RPC 节点费用预算和优化
- Gas 费优化 (批量交易、Gas 价格监控)
- 服务器资源监控和自动扩缩容
- 定期成本审计

### 成本监控
- 实时成本追踪
- 成本预算设置
- 异常成本告警
- 成本效益分析

### 成本优化建议
- 使用 Spot 实例降低服务器成本
- 批量交易减少 Gas 费
- 缓存策略减少 API 调用
- 定期清理无用数据

---

## 14. 核心逻辑与风险说明 (Core Logic & Risks)

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

## 15. 运维常用命令

### 服务管理
```bash
# 查看日志
pm2 logs poly-supervisor

# 紧急停止
pm2 stop poly-supervisor

# 重启服务
pm2 restart poly-supervisor

# 查看状态
pm2 status

# 监控面板
pm2 monit
```

### 扩容 (Scaling)
若需支持更多并发用户，修改 `frontend/scripts/copy-trading-supervisor.ts` 中的 `poolSize` (默认 20)，然后重启 Supervisor。
*注意: 增加 Worker 数量意味着需要更多的 Gas 储备。*

### 数据库操作
```bash
# 生成 Prisma Client
npx prisma generate

# 同步数据库结构
npx prisma db push

# 查看数据库
npx prisma studio
```

### 日志查看
```bash
# 查看实时日志
pm2 logs poly-supervisor --lines 100

# 查看错误日志
pm2 logs poly-supervisor --err

# 日志清理
pm2 flush
```

---

## 16. 快速检查清单 (Quick Checklist)

### 部署前确认
- [ ] 付费 RPC 节点已配置（WSS 协议）
- [ ] PostgreSQL 数据库已部署并配置主从复制
- [ ] Executor 合约已部署到主网
- [ ] Master Wallet 有足够 MATIC (> 100 MATIC)
- [ ] 所有环境变量已正确配置
- [ ] 监控和告警系统已启用
- [ ] 备份策略已实施并测试
- [ ] 安全审计已完成
- [ ] 测试网验证通过
- [ ] 应急预案已准备

### 安全检查
- [ ] 密钥已安全存储（未硬编码）
- [ ] HTTPS 证书已配置
- [ ] 数据库访问白名单已设置
- [ ] API 接口限流和认证已启用
- [ ] 敏感操作审计日志已开启
- [ ] DDoS 防护已启用
- [ ] WAF 已配置
- [ ] 定期安全扫描已计划

### 监控检查
- [ ] PM2 监控已配置
- [ ] 日志收集系统已搭建
- [ ] 性能指标监控已启用
- [ ] 错误追踪已配置
- [ ] 业务监控指标已设置
- [ ] 告警通知已配置（邮件、短信、IM）
- [ ] 告警阈值已合理设置

### 资金检查
- [ ] Master Wallet 余额充足
- [ ] Worker Fleet 已初始化
- [ ] Auto-Refuel 机制已测试
- [ ] Proxy 余额监控已启用
- [ ] 费用计算逻辑已验证
- [ ] 资金流向审计已配置

### 合规检查
- [ ] 用户协议已更新
- [ ] 隐私政策已发布
- [ ] 数据保护措施已实施
- [ ] 审计日志已启用
- [ ] 交易记录保存策略已制定
- [ ] 投诉处理流程已建立

### 性能检查
- [ ] API 响应时间 < 200ms
- [ ] 页面加载时间 < 2s
- [ ] WebSocket 延迟 < 100ms
- [ ] 数据库查询 < 100ms
- [ ] CDN 已配置
- [ ] 静态资源已压缩
- [ ] 缓存策略已优化

### 测试检查
- [ ] 功能测试全部通过
- [ ] 性能测试达标
- [ ] 压力测试通过
- [ ] 安全测试通过
- [ ] 灾难恢复演练成功
- [ ] 回滚策略已验证

### 上线前最终确认
- [ ] 灰度发布计划已制定
- [ ] 回滚方案已准备
- [ ] 团队已培训
- [ ] 用户通知已准备
- [ ] 客服支持已就绪
- [ ] 监控大屏已设置

---

## 17. 生产环境部署注意事项 (Production Deployment Notes)

### 本地 vs 生产环境差异

| 步骤 | 本地仿真 (Local) | 生产环境 (Production) | 为什么？ |
|------|------------------|----------------------|----------|
| 部署 Proxy | setup-local-fork.ts | ❌ 不要运行此脚本 | 本地脚本用的是测试账号。生产环境用户是在前端界面点击"创建账户"来部署 Proxy 的。 |
| 资金来源 | setup-local-fork.ts (偷大户) | 真实充值 | 生产环境您必须往 Master Wallet 转入真实的 MATIC，用户需往 Proxy 充值真实的 USDC。 |
| 触发交易 | impersonate- 脚本 (模拟信号) | 真实监听 | Supervisor 会自动监听链上 CTF Exchange 的真实交易。不需要手动脚本触发。 |
| Mock 模式 | 自动开启 (ChainID 31337) | 自动关闭 | 当您设置 ChainID=137 时，TradingService 会自动尝试连接真实 Polymarket 接口。 |

### 生产环境部署修正清单

#### A. 环境变量修正 (.env)
将 .env 修改为真实的主网配置：

```bash
# ⚠️ 必须是 137 (Polygon Mainnet)
NEXT_PUBLIC_CHAIN_ID=137

# ⚠️ 必须是高质量的节点 (Alchemy/Infura付费版)，必须支持 WebSocket (wss://)
# 只有 WebSocket 才能做到毫秒级监听 Mempool
NEXT_PUBLIC_RPC_URL="wss://polygon-mainnet.g.alchemy.com/v2/您的API_KEY"

# ⚠️ 您的真实助记词 (管理整个 Fleet)
TRADING_MNEMONIC="您的 12 个助记词 ..."

# ⚠️ 生产级数据库 (不要用 SQLite 文件)
DATABASE_URL="postgresql://user:pass@AWS_RDS_HOST:5432/mydb"
```

#### B. 基础设施部署 (仅需一次)
您需要在主网上部署一个属于您的 Executor 合约（Fleet Commander）。

```bash
cd contracts
# 注意：确保此时 .env 里是主网配置
npx hardhat run scripts/deploy-executor.ts --network polygon
```

执行后，将获得的地址填入 .env 的 `NEXT_PUBLIC_EXECUTOR_ADDRESS`。

#### C. 启动服务 (PM2)
生产环境不要直接用 `npx tsx` 跑前台，要用 PM2 守护进程。

```bash
# 启动 Supervisor (7x24小时运行)
pm2 start "npx tsx scripts/copy-trading-supervisor.ts" --name poly-supervisor --max-memory-restart 2G

# 启动前端
npm run build
pm2 start "npm start" --name poly-frontend
```

### 特别注意事项

1. **CLOB API 鉴权**:
   - 在 Mock 模式下我们跳过了鉴权。
   - 在生产环境，Worker 钱包第一次启动时，会自动签名消息去 Polymarket 申请 API Key。
   - 确保 Worker 钱包里有少量的 MATIC，虽然申请 Key 只需签名不耗 Gas，但建立连接和后续下单需要 Gas。
   - Auto-Refuel 机制会自动解决这个问题，只要您的 Master Wallet 有钱。

2. **RPC 速率限制**:
   - 本地测试没有限制。
   - 生产环境如果并发 20 个 Worker 同时查余额或下单，可能会瞬间打爆免费的 RPC 节点。
   - 务必使用付费的 Alchemy/Infura 节点，或者在代码中调大 `src/core/rate-limiter.ts` 的限制。

3. **资金安全**:
   - `TRADING_MNEMONIC` 控制所有跟单资金。请务必妥善保管。
   - 建议使用硬件钱包或专业的密钥管理服务。

### 结论

代码逻辑已经 Ready。只要改一下配置（Env），部署一次合约（Executor），并给钱包充钱，这套系统就能在 Polygon 主网上跑起来。

**建议**: 先用小资金（10 USDC）进行一次真实验证，确认一切正常后再扩大规模。

---

## 18. 联系与支持 (Contact & Support)

- **项目主页**: [Catalyst.fun](https://x.com/catalystdotfun)
- **构建者**: [@hhhx402](https://x.com/hhhx402)
- **问题反馈**: GitHub Issues

---

**最后更新**: 2026-01-21



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