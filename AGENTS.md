<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

---

# Horus 项目指南

本文档为 AI 助手提供了 Horus 项目的全面概览、架构指南和开发约定。

## 项目概述

**Horus** 是一个完整的 Polymarket 生态系统项目，包含 TypeScript SDK、前端应用、智能合约和后端服务。该项目为 Polymarket 提供统一的 API 接口、交易工具、智能资金分析和用户界面。

**当前版本**: v0.3.0  
**构建者**: [@hhhx402](https://x.com/hhhx402) | **项目**: [Catalyst.fun](https://x.com/catalystdotfun)

## 项目结构

```
Horus/
├── src/                        # SDK 源代码 (@catalyst-team/poly-sdk)
│   ├── core/                   # 核心基础设施（速率限制、缓存、错误处理）
│   ├── clients/                # API 客户端（Data API、Gamma API、Subgraph 等）
│   ├── services/               # 高级服务（交易、市场、智能资金、套利等）
│   ├── utils/                  # 工具函数
│   └── index.ts                # SDK 入口点
├── web/                   # Next.js 16 前端应用
│   ├── app/                    # App Router 页面
│   │   ├── [locale]/           # 国际化路由
│   │   ├── api/                # API 路由
│   │   │   ├── affiliate/      # 联盟推广 API
│   │   │   ├── copy-trading/   # 复制交易 API
│   │   │   ├── markets/        # 市场数据 API
│   │   │   ├── proxy/          # 代理 API
│   │   │   └── traders/        # 交易者 API
│   ├── components/             # React 组件
│   ├── lib/                    # 工具库和服务
│   ├── prisma/                 # Prisma 数据库模型
│   ├── scripts/                # 实用脚本
│   │   ├── copy-trading-supervisor.ts  # 复制交易监控器
│   │   ├── verify/             # 验证脚本
│   │   └── services/           # 服务脚本
│   ├── config/                 # 配置文件
│   ├── i18n/                   # 国际化配置
│   └── openspec/               # 前端 OpenSpec 规范
├── contracts/                  # Hardhat 智能合约
│   ├── contracts/              # 合约源码（Proxy、Factory、Treasury、Executor）
│   ├── scripts/                # 部署脚本
│   │   ├── deploy.ts           # 主部署脚本
│   │   ├── deploy-executor.ts  # 执行器部署
│   │   ├── add-worker.ts       # 添加工作器白名单
│   │   └── setup-local-fork.ts # 本地分叉设置
│   └── test/                   # 合约测试
├── backend/                    # 后端服务
│   └── affiliate-service/      # Spring Boot 联盟推广服务
├── examples/                   # SDK 使用示例
├── scripts/                    # 实用脚本和工具
│   ├── copy-trading-worker.ts  # 复制交易工作器
│   ├── archive-data.ts         # 数据归档
│   ├── verify/                 # 验证脚本
│   ├── api-verification/       # API 验证
│   ├── approvals/              # 授权操作
│   ├── arb/                    # 套利相关
│   ├── deposit/                # 存款操作
│   ├── research/               # 市场研究
│   ├── smart-money/            # 智能资金测试
│   ├── trading/                # 交易测试
│   └── wallet/                 # 钱包操作
├── docs/                       # 文档
├── openspec/                   # OpenSpec 规范管理
│   ├── specs/                  # 当前规范
│   └── changes/                # 变更提案
├── logs/                       # 日志文件
├── deploy/                     # 部署配置
├── demo/                       # 演示截图
└── package.json                # SDK 依赖配置
```

## 技术栈

### SDK (@catalyst-team/poly-sdk)
- **语言**: TypeScript 5.7.2
- **核心依赖**:
  - `@polymarket/clob-client` ^5.1.3 - 官方 CLOB 交易客户端
  - `@polymarket/real-time-data-client` ^1.4.0 - 官方 WebSocket 客户端
  - `ethers` ^5 - 区块链交互
  - `bottleneck` ^2.19.5 - 速率限制
  - `@prisma/client` ^7.3.0 - Prisma ORM 客户端
  - `pg` ^8.18.0 - PostgreSQL 客户端
- **测试**: Vitest ^2.1.8

### 前端应用
- **框架**: Next.js 16.1.1 (App Router)
- **UI**: React 19.2.3
- **样式**: Tailwind CSS 4
- **认证**: Privy ^3.10.0
- **数据库**: Prisma ORM ^7.2.0 (PostgreSQL)
- **图表**: Recharts ^3.6.0
- **动画**: Framer Motion ^12.23.26, GSAP ^3.14.2
- **数据获取**: SWR ^2.3.8
- **UI 组件**: Lucide React ^0.562.0, Sonner ^2.0.7
- **国际化**: next-intl ^4.8.1
- **其他**: ioredis ^5.9.2 (Redis), clsx ^2.1.1, date-fns ^4.1.0

### 智能合约
- **框架**: Hardhat ^2.22.0
- **语言**: Solidity ^0.8.24
- **依赖**: OpenZeppelin ^5.0.0
- **网络**: Polygon 主网 / Amoy 测试网

### 后端服务
- **框架**: Spring Boot 3.2.1
- **数据库**: PostgreSQL
- **文档**: OpenAPI (SpringDoc)

## SDK 三层架构

### Layer 3: 高级服务（推荐使用）
- **TradingService** - 订单管理（限价单/市价单/GTC/GTD/FOK/FAK）
- **MarketService** - 市场数据（K线/订单簿/套利检测）
- **OnchainService** - 链上操作（拆分/合并/兑换/授权/交换）
- **RealtimeServiceV2** - WebSocket 实时数据
- **WalletService** - 钱包/交易者分析
- **SmartMoneyService** - 智能资金跟踪与自动复制交易
- **ArbitrageService** - 套利检测与执行
- **AuthorizationService** - 代币授权管理
- **SwapService** - DEX 交换服务
- **CopyTradingExecutionService** - 复制交易执行服务
- **GasStation** - Gas 价格服务

### Layer 2: 低级客户端（高级用户）
- **DataApiClient** - 持仓、交易、排行榜
- **GammaApiClient** - 市场、事件、搜索
- **SubgraphClient** - 链上数据（Goldsky）
- **CTFClient** - CTF 合约操作
- **BridgeClient** - 跨链存款

### Layer 1: 核心基础设施
- **RateLimiter** - 每个端点的速率限制
- **Cache** - TTL 基础的缓存系统
- **Errors** - 结构化错误处理
- **Types** - 统一类型定义
- **PriceUtils** - 价格计算工具
- **TxMutex** - 交易互斥锁（支持作用域）

## 核心功能

### 1. 交易功能
- 支持限价单和市价单（GTC、GTD、FOK、FAK）
- 订单管理（下单、取消、查询）
- 奖励跟踪（做市激励）
- 最小订单金额：$1 USDC

### 2. 市场数据分析
- K线数据获取
- 订单簿分析
- 套利机会检测
- 价格历史数据
- 双K线分析（YES + NO）

### 3. 智能资金分析
- 顶级交易者跟踪
- 智能资金识别
- 自动复制交易（实时）
- 钱包配置文件分析
- 卖出活动检测

### 4. 套利服务
- 实时套利扫描
- 自动执行
- 资金再平衡
- 位置管理
- 智能清算

### 5. 链上操作
- CTF（拆分/合并/兑换）
- 代币授权（ERC20/ERC1155）
- DEX 交换（QuickSwap V3）
- 桥接存款
- 余额检查

### 6. 前端应用
- Next.js 16 + React 19
- Privy 嵌入式钱包
- 实时市场数据展示
- 投资组合管理（包含 ROI、最大收益等）
- 智能资金复制交易
- 联盟推广系统（5级层级）
- 国际化支持（i18n）
- 支持页面

### 7. 智能合约
- PolyHunterProxy - 用户交易代理
- ProxyFactory - 代理工厂
- Treasury - 费用管理
- PolyHunterExecutor - 执行器
- 自动费用收取（仅利润部分）
- 合约级执行守卫（白名单、暂停、执行器绑定）

### 8. 后端服务
- Spring Boot 3.2.1
- 联盟推广系统
- PostgreSQL 数据库
- OpenAPI 文档

### 9. 复制交易系统
- **复制交易工作器** (`scripts/copy-trading-worker.ts`) - 后台处理跟单交易
- **复制交易监控器** (`web/scripts/copy-trading-supervisor.ts`) - 实时监控和执行
- **预写执行** - 防止孤儿订单
- **智能路由** - EOA 和代理模式自动选择
- **性能优化** - Redis 共享存储、队列去重、缓存机制
- **执行吞吐优化** - 并行订单放置、异步结算、批量报销账本
- **交易监控** - 卡单自动加速、交易重试、债务记录

### 10. 模拟结算引擎
- 市场结算事件监听
- 自动结算模拟持仓
- 胜利份额兑换为 $1.00
- 失败份额过期为 $0.00
- 历史记录更新

### 11. 价格获取机制
- CLOB 订单簿价格（主要来源）
- Gamma API 价格（备用来源）
- 实时价格更新
- 准确的 PnL 计算
- 订单簿报价缓存（支持 TTL 和驱逐策略）

## 开发约定

### TypeScript
- 严格类型检查
- 完整的类型导出
- 与官方客户端库兼容的类型定义
- ES 模块格式

### 错误处理
- 结构化错误处理
- 自动重试机制
- 清晰的错误代码

### 代码风格
- 使用 ES 模块
- 遵循 TypeScript 最佳实践
- 清晰的接口定义和文档

### 前端约定
- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- TypeScript 5
- Privy 嵌入式钱包
- Prisma ORM（使用适配器模式）
- SWR 数据获取
- 国际化支持（next-intl）

### 智能合约约定
- Solidity ^0.8.24
- OpenZeppelin ^5.0.0
- Hardhat ^2.22.0
- ReentrancyGuard 保护
- SafeERC20 使用

## 构建和测试

### SDK 构建
```bash
# 构建项目
pnpm run build

# 运行测试
pnpm run test
pnpm run test:watch
pnpm run test:integration

# 运行开发模式（监听变化）
pnpm run dev
```

### 前端应用
```bash
cd frontend

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 启动生产服务器
npm start

# Lint
npm run lint

# 更新排行榜缓存
npm run cache:update

# 复制交易监控器（高速模式）
npm run copy-worker:speed

# 环境配置切换
npm run env:mainnet   # 切换到主网配置
npm run env:local     # 切换到本地配置
```

### 智能合约
```bash
cd contracts

# 安装依赖
npm install

# 编译合约
npm run compile

# 运行测试
npm run test

# 部署到本地网络
npm run deploy:local

# 部署到 Amoy 测试网
npm run deploy:amoy

# 部署到 Polygon 主网
npm run deploy:polygon

# 设置本地分叉
npx tsx scripts/setup-local-fork.ts

# 添加工作器白名单（本地测试）
npx tsx scripts/add-worker.ts
```

### 后端服务
```bash
cd backend/affiliate-service

# 使用 Maven 构建
mvn clean install

# 运行应用
mvn spring-boot:run

# 运行测试
mvn test
```

### 示例运行
```bash
# 基础示例
pnpm example:basic              # 基础使用
pnpm example:smart-money        # 智能资金分析
pnpm example:market-analysis    # 市场分析
pnpm example:kline              # K线聚合
pnpm example:follow-wallet      # 跟踪钱包策略

# 服务示例
pnpm example:services           # 所有服务演示
pnpm example:realtime           # WebSocket 流
pnpm example:trading            # 交易订单
pnpm example:rewards            # 奖励跟踪
pnpm example:ctf                # CTF 操作

# 套利示例
pnpm example:live-arb           # 实时套利扫描
pnpm example:trending-arb       # 趋势套利监控
pnpm example:arb-service        # 套利服务

# 复制交易工作器
pnpm run copy-worker            # 启动复制交易工作器

# 数据归档
pnpm run archive-data           # 运行数据归档脚本
```

### PM2 部署（监控器）
```bash
# 使用 PM2 部署复制交易监控器
pm2 start ecosystem.config.cjs

# 查看日志
pm2 logs copy-trading-supervisor

# 重启服务
pm2 restart copy-trading-supervisor

# 停止服务
pm2 stop copy-trading-supervisor
```

## 重要提示

### CTF 操作注意事项
- Polymarket CTF 需要 **USDC.e** (0x2791...)，而非原生 USDC
- 最小订单金额为 **$1 USDC**
- 使用 `OnchainService` 进行统一的链上操作

### 订单簿镜像订单
- Polymarket 订单簿具有镜像属性：买入 YES @ P = 卖出 NO @ (1-P)
- 使用 SDK 提供的有效价格计算函数避免重复计算
- 详细文档见：`docs/arb/arbitrage.md`

### WebSocket 连接
- 使用 `RealtimeServiceV2` 获取实时数据
- SDK 提供 `start()` 方法一次性完成初始化和连接
- 记得在结束时调用 `stop()` 清理资源
- 市场生命周期事件可通过 `COPY_TRADING_ENABLE_MARKET_EVENTS` 环境变量控制

### 智能合约费用
- PolyHunterProxy 自动收取利润费用
- 费用仅在提取利润时收取
- 费用比例由 Factory 设置（最高 20%）
- 费用按提取金额比例计算

### 前端钱包
- 使用 Privy 嵌入式钱包
- 支持社交登录（Google、Twitter 等）
- 无需助记词
- 自动管理私钥

### 模拟结算
- 复制交易工作器监听市场结算事件
- 自动结算模拟持仓为最终价值（$1 或 $0）
- 确保投资组合显示准确的 PnL

### 价格获取
- 优先使用 CLOB 订单簿价格
- 备用 Gamma API 价格用于流动性不足的市场
- 支持强制回退价格模式（`COPY_TRADING_FORCE_FALLBACK_PRICE`）
- 确保实时价格准确性

### 复制交易性能优化
- **订单簿报价缓存** - 使用 TTL 缓存和飞行中请求去重
- **预飞平衡缓存** - 缓存余额和授权检查
- **执行互斥锁** - 按签名者作用域的交易序列化
- **异步结算** - 支持结算队列和自动重试
- **批量报销账本** - 延迟报销以减少链上交易
- **Redis 共享存储** - 支持多实例部署和跨实例去重

### 数据库连接
- 前端使用 Prisma 适配器模式（`@prisma/adapter-pg`）
- 需要显式传递适配器给 PrismaClient 构造函数
- 支持连接池和高并发场景

## 数据库架构

前端使用 Prisma ORM 管理 PostgreSQL 数据库，主要模型包括：

### 联盟推广系统
- **Referrer** - 推荐人（5级层级：ORDINARY、VIP、ELITE、PARTNER、SUPER_PARTNER）
- **Referral** - 被推荐用户
- **TeamClosure** - 用于高效树遍历的闭包表
- **Payout** - 提现记录
- **CommissionLog** - 佣金详细账本
- **ReferralVolume** - 每日交易量聚合

### 代理系统
- **UserProxy** - 用户的交易代理钱包（3级订阅：STARTER、PRO、WHALE）
- **ProxyTransaction** - 代理财务交易（存款/提现）
- **FeeTransaction** - 费用交易记录

### 复制交易系统
- **CopyTradingConfig** - 复制交易配置
- **CopyTrade** - 单个复制交易记录
- **SyncLog** - 同步历史记录
- **DebtRecord** - 失败报销的债务记录
- **UserPosition** - 用户持仓（成本基础/利润计算）
- **GuardrailEvent** - 守卫事件记录
- **ReimbursementLedger** - 批量报销账本

### 利润费用系统
- **VolumeTier** - 交易量费用层级配置

### 排行榜缓存
- **CachedTraderLeaderboard** - 缓存的交易者排行榜
- **LeaderboardCacheMeta** - 缓存更新状态元数据

### 存档系统
- **ArchivedCopyTrade** - 存档的复制交易记录
- **ArchivedCommissionLog** - 存档的佣金日志

## OpenSpec 规范管理

项目使用 OpenSpec 进行规范驱动的开发。

### 查看现有规范
```bash
# 列出所有规范
openspec list --specs

# 列出活跃的变更提案
openspec list

# 查看特定规范
openspec show copy-trading --type spec
openspec show affiliate-system --type spec
```

### 创建变更提案
当需要添加功能、进行破坏性变更或架构调整时：

1. 检查现有规范和变更
2. 创建唯一的 change-id（kebab-case，动词引导）
3. 创建提案结构：
   ```
   openspec/changes/[change-id]/
   ├── proposal.md          # 为什么、什么、影响
   ├── tasks.md             # 实现清单
   ├── design.md            # 技术决策（可选）
   └── specs/               # Delta 变更
       └── [capability]/
           └── spec.md      # ADDED/MODIFIED/REMOVED
   ```
4. 验证提案：`openspec validate <change-id> --strict --no-interactive`
5. 等待批准后再开始实现

### 当前规范
- **affiliate-system** - 联盟推广系统（5级层级、佣金计算、自动升级）
- **copy-trading** - 复制交易系统（价格获取、债务记录、事件去重）
- **copy-execution** - 复制交易执行（代理模式、EOA 模式）
- **portfolio-api** - 投资组合 API
- **portfolio-ui** - 投资组合 UI
- **affiliate-landing-ui** - 联盟推广落地页 UI
- **affiliate-withdrawals** - 联盟推广提现功能
- **view-transaction-history** - 交易历史查看
- **fee-logic** - 费用逻辑
- **storage** - 存储规范

### 当前活跃变更（部分）
#### 执行优化
- **add-copy-trade-prewrite** - 预写执行防止孤儿订单
- **add-scoped-tx-mutex** - 作用域交易互斥锁
- **add-orderbook-quote-cache** - 订单簿报价缓存
- **add-preflight-balance-cache** - 预飞平衡缓存
- **add-price-fallback** - 价格回退机制
- **add-execution-tx-monitor** - 执行交易监控
- **add-cache-eviction** - 缓存驱逐策略
- **add-execution-stage-metrics** - 执行阶段指标
- **optimize-copy-execution-throughput** - 优化复制交易执行吞吐
- **add-batched-reimbursement-ledger** - 批量报销账本

#### 安全与守卫
- **add-contract-execution-guards** - 合约执行守卫（白名单、暂停、执行器绑定）
- **add-execution-safety-controls** - 执行安全控制
- **add-execution-whitelist-guardrails** - 执行白名单守卫

#### 数据库优化
- **optimize-db-design** - 数据库设计优化（索引、锁声明、归档）
- **optimize-db-performance** - 数据库性能优化
- **implement-data-archiving** - 数据归档实现

#### 扩展与监控
- **scale-copy-trading-supervisor** - 复制交易监控器扩容（Redis、分片、队列）
- **add-supervisor-capacity-controls** - 监控器容量控制
- **add-execution-monitoring-alerts** - 执行监控告警

#### 功能增强
- **add-affiliate-rules-page** - 联盟推广规则页面
- **enhance-portfolio-ui** - 增强投资组合 UI
- **enhance-positions-display** - 增强持仓显示
- **implement-scientific-scoring** - 实现科学评分
- **implement-strategy-profiles** - 实现策略配置
- **add-frontend-i18n** - 前端国际化

#### 修复
- **fix-copy-trading-logic** - 修复复制交易逻辑
- **fix-simulated-settlement** - 修复模拟结算逻辑
- **fix-simulation-pricing** - 修复模拟价格获取
- **fix-simulation-pnl-logic** - 修复模拟 PnL 逻辑

## v0.3.0 重大变更

### UnifiedMarket.tokens 现在是数组格式

**变更前 (v0.2.x)**:
```typescript
// 对象格式，包含 yes/no 属性
const yesPrice = market.tokens.yes.price;
const noPrice = market.tokens.no.price;
```

**变更后 (v0.3.0)**:
```typescript
// 数组格式，包含 MarketToken 对象
const yesToken = market.tokens.find(t => t.outcome === 'Yes');
const noToken = market.tokens.find(t => t.outcome === 'No');

const yesPrice = yesToken?.price;
const noPrice = noToken?.price;
```

### 迁移辅助函数
```typescript
function getTokenPrice(market: UnifiedMarket, outcome: 'Yes' | 'No'): number {
  return market.tokens.find(t => t.outcome === outcome)?.price ?? 0;
}
```

**变更原因**：数组格式更好地支持多结果市场，并且与 Polymarket API 响应格式更一致。

### 新增功能

#### 复制交易系统重构
- 预写执行机制防止孤儿订单
- PENDING 状态过期处理
- EOA 和代理模式智能路由
- 智能守卫系统（全局限制、每用户限制）
- 交易监控和自动重试
- 债务记录和恢复循环

#### 性能优化
- Redis 共享存储支持多实例部署
- 订单簿报价缓存（TTL + 驱逐）
- 预飞平衡缓存
- 作用域交易互斥锁
- 并行订单放置
- 异步结算队列
- 批量报销账本

#### 安全增强
- 合约级执行守卫（白名单、暂停、执行器绑定）
- 守卫事件持久化
- 配置 API 密钥脱敏
- 执行前验证

#### 模拟结算引擎
- 监听市场结算事件
- 自动结算模拟持仓
- 胜利份额兑换为 $1.00
- 失败份额过期为 $0.00

#### 增强的价格获取
- CLOB 订单簿价格（主要）
- Gamma API 价格（备用）
- 强制回退价格模式
- 实时价格更新
- 准确的 PnL 计算

#### 投资组合 UI 增强
- ROI 列显示
- 最大收益列显示
- 平均价格列显示
- 总投资额列显示
- 更清晰的术语（Side、Shares）

#### 数据库优化
- 热路径索引优化
- 行声明锁机制
- 数据归档系统
- 维护脚本（VACUUM/ANALYZE）

## 扩容与成本评估

根据 `scaling_analysis.md` 分析，系统扩容分为三个阶段：

### 阶段一：起步期（100 - 1,000 用户）
- **服务器**: 4 vCPU / 8GB RAM
- **架构**: PM2 运行 2-4 个 Supervisor 实例
- **数据库**: Managed PostgreSQL + PgBouncer
- **RPC**: QuickNode Growth ($49 - $100/月)

### 阶段二：高速发展期（1,000 - 10,000 用户）
- **服务器**: 2台 8 vCPU / 16GB RAM 集群
- **架构**: Redis 队列 + 读写分离
- **Fleet Wallet**: 50 - 100 个打手钱包
- **RPC**: QuickNode Scale ($300 - $800/月)

### 阶段三：海量并发（10,000+ 用户）
- **基础设施**: Kubernetes 自动扩容
- **RPC**: 自建节点（裸金属服务器）
- **高级特性**: Flashbots / FastLane 私有交易池

## 文档资源

### API 参考
- [docs/api/01-overview.md](docs/api/01-overview.md) - 完整 API 参考
- [docs/api/02-leaderboard.md](docs/api/02-leaderboard.md) - 排行榜 API
- [docs/api/03-position-activity.md](docs/api/03-position-activity.md) - 持仓和活动跟踪

### 架构文档
- [docs/architecture/01-overview.md](docs/architecture/01-overview.md) - 服务层设计
- [docs/architecture/02-websocket.md](docs/architecture/02-websocket.md) - WebSocket 实现
- [docs/architecture/03-data-model.md](docs/architecture/03-data-model.md) - 数据模型设计

### 实用指南
- [docs/guides/copy-trading.md](docs/guides/copy-trading.md) - 复制交易分析和实现
- [docs/guides/real_trading_architecture.md](docs/guides/real_trading_architecture.md) - 真实交易架构
- [docs/arb/arbitrage.md](docs/arb/arbitrage.md) - 套利机制和计算

### 概念理解
- [docs/concepts/polymarket-principles.md](docs/concepts/polymarket-principles.md) - Polymarket 三层架构

### 运维文档
- [docs/operations/runbook.md](docs/operations/runbook.md) - 运行手册
- [docs/operations/deploy-supervisor-capacity-controls.md](docs/operations/deploy-supervisor-capacity-controls.md) - 容量控制部署清单
- [docs/operations/sop-supervisor-capacity-controls.md](docs/operations/sop-supervisor-capacity-controls.md) - 容量控制标准操作流程
- [docs/operations/release-notes.md](docs/operations/release-notes.md) - 发布说明
- [docs/operations/debt-recovery-verification.md](docs/operations/debt-recovery-verification.md) - 债务恢复验证

### 脚本文档
- [scripts/README.md](scripts/README.md) - 实用脚本使用指南
- [examples/README.md](examples/README.md) - 示例代码说明
- [scripts/verify/README.md](scripts/verify/README.md) - 验证脚本指南

### 分析报告
- [scaling_analysis.md](scaling_analysis.md) - 扩容与成本评估报告
- [findings.md](findings.md) - 发现与决策
- [progress.md](progress.md) - 进度日志
- [task_plan.md](task_plan.md) - 任务计划

## 许可证

MIT License