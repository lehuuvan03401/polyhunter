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
├── sdk/                        # TypeScript SDK (@catalyst-team/poly-sdk)
│   ├── src/
│   │   ├── core/               # 核心基础设施（速率限制、缓存、错误处理）
│   │   ├── clients/            # API 客户端（Data API、Gamma API、Subgraph 等）
│   │   ├── services/           # 高级服务
│   │   ├── config/             # 配置
│   │   ├── utils/              # 工具函数
│   │   └── index.ts            # SDK 入口点
│   ├── examples/               # 使用示例
│   ├── scripts/                # 实用脚本
│   └── tests/                  # 测试
├── web/                        # Next.js 16 前端应用
│   ├── app/                    # App Router 页面
│   │   ├── [locale]/           # 国际化路由
│   │   └── api/                # API 路由
│   │       ├── admin/          # 管理后台 API
│   │       ├── affiliate/      # 联盟推广 API
│   │       ├── agents/         # AI 代理 API
│   │       ├── copy-trading/   # 复制交易 API
│   │       ├── home/           # 首页 API
│   │       ├── managed-*       # 全托理财/会员管理 API
│   │       │   ├── managed-liquidation/   # 清算 API
│   │       │   ├── managed-membership/    # 会员管理 API
│   │       │   ├── managed-products/      # 产品管理 API
│   │       │   ├── managed-risk-events/   # 风险事件 API
│   │       │   ├── managed-settlement/    # 结算 API
│   │       │   ├── managed-subscriptions/ # 订阅 API
│   │       ├── markets/        # 市场数据 API
│   │       ├── participation/  # 参与项目 API
│   │       ├── partners/       # 合作伙伴 API
│   │       ├── proxy/          # 代理 API
│   │       ├── reserve-fund/   # 储备金 API
│   │       └── traders/        # 交易者 API
│   ├── components/             # React 组件
│   │   ├── agents/             # AI 代理组件
│   │   ├── managed-wealth/     # 全托理财组件
│   │   ├── participation/      # 参与项目组件
│   │   └── ...
│   ├── lib/                    # 工具库和服务
│   │   ├── managed-wealth/     # 全托理财核心逻辑
│   │   ├── participation-program/ # 参与项目核心逻辑
│   │   ├── copy-trading/       # 复制交易核心
│   │   └── ...
│   ├── prisma/                 # Prisma 数据库模型
│   ├── scripts/                # 实用脚本
│   │   ├── workers/            # 后台工作器
│   │   │   ├── copy-trading-supervisor.ts
│   │   │   ├── copy-trading-worker.ts
│   │   │   ├── managed-wealth-worker.ts
│   │   │   └── managed-liquidation-worker.ts
│   │   ├── db/                 # 数据库脚本
│   │   ├── verify/             # 验证脚本
│   │   └── services/           # 服务脚本
│   └── config/                 # 配置文件
├── contracts/                  # Hardhat 智能合约
│   ├── contracts/              # 合约源码
│   ├── scripts/                # 部署脚本
│   └── test/                   # 合约测试
├── openspec/                   # OpenSpec 规范管理
│   ├── specs/                  # 当前规范
│   └── changes/                # 变更提案
├── deploy/                     # 部署配置
│   └── stage1/                 # 阶段一部署（Docker/K8s）
└── docs/                       # 文档
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
- **其他**: ioredis ^5.9.2 (Redis), clsx ^2.1.1, date-fns ^4.1.0, zod ^4.3.6

### 智能合约
- **框架**: Hardhat ^2.22.0
- **语言**: Solidity ^0.8.24
- **依赖**: OpenZeppelin ^5.0.0
- **网络**: Polygon 主网 / Amoy 测试网

### 后端服务
- **框架**: Spring Boot 3.2.1
- **数据库**: PostgreSQL
- **文档**: OpenAPI (SpringDoc)

## SDK 服务层

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
- **TokenMetadataService** - 代币元数据服务
- **CTFEventListener** - CTF 事件监听器

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

### 5. 链上操作
- CTF（拆分/合并/兑换）
- 代币授权（ERC20/ERC1155）
- DEX 交换（QuickSwap V3）
- 桥接存款

### 6. 全托理财系统 (Managed Wealth)
- 策略订阅模式（STARTER/PRO/WHALE）
- 智能清算机制
- 结算数学计算
- 策略主题管理
- 试用系统
- 主权预留（Principal Reservation）
- 钱包认证

### 7. 参与项目系统 (Participation Program)
- 多级会员体系（ORDINARY/VIP/ELITE/PARTNER/SUPER_PARTNER）
- 佣金计算
- 推广奖励
- 费用作用域管理
- 合作伙伴运营自动化
- 政策门禁

### 8. 复制交易系统
- 复制交易工作器
- 复制交易监控器（Supervisor）
- 预写执行机制
- 智能路由（EOA/代理模式）
- 性能优化（Redis/缓存/队列）
- 交易监控和重试
- 债务记录和恢复

### 9. 储备金系统 (Reserve Fund)
- 资金管理
- 状态追踪

### 10. AI 代理系统 (Agents)
- AI 代理组件和 API
- 代理集成

### 11. 会员管理系统 (Managed Membership)
- 会员等级管理
- 会员权益

### 12. 产品管理系统 (Managed Products)
- 产品配置
- 风险管理

### 13. 风险事件系统 (Managed Risk Events)
- 风险事件追踪
- 风险预警

## 开发约定

### TypeScript
- 严格类型检查
- 完整的类型导出
- ES 模块格式
- Zod 用于运行时验证

### 前端约定
- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- TypeScript 5
- Privy 嵌入式钱包
- Prisma ORM（适配器模式）
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
cd sdk

# 构建项目
pnpm run build

# 运行测试
pnpm run test
pnpm run test:watch
pnpm run test:integration

# 开发模式
pnpm run dev

# 示例运行
pnpm example:basic
pnpm example:smart-money
pnpm example:market-analysis
pnpm example:kline
pnpm example:trading
pnpm example:ctf
pnpm example:live-arb
pnpm example:arb-service
```

### 前端应用
```bash
cd web

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

# 全托理财相关
npm run seed:managed-wealth              # 种子数据
npm run test:managed-wealth:unit         # 单元测试
npm run test:managed-wealth:e2e          # E2E 测试
npm run managed-wealth:worker            # 启动全托理财工作器
npm run managed-liquidation:worker        # 启动清算工作器
npm run verify:managed-wealth:lifecycle  # 验证全托理财生命周期
npm run verify:managed-wealth:marketing  # 验证营销规则

# 合作伙伴计划
npm run seed:participation-program       # 种子数据
npm run partner:eliminate:monthly        # 月度淘汰

# 复制交易
npm run copy-worker:speed                # 高速模式

# 环境配置
npm run env:mainnet                      # 切换到主网
npm run env:local                        # 切换到本地

# 参与项目
npm run participation:levels:daily      # 每日等级快照
npm run participation:promotion:daily    # 每日晋升快照

# 数据验证
npm run verify:partner:refund-sla        # 验证退款 SLA
npm run verify:managed-membership:lifecycle # 验证会员生命周期
```

### 智能合约
```bash
cd contracts

# 编译
npm run compile

# 测试
npm run test

# 部署
npm run deploy:local
npm run deploy:amoy
npm run deploy:polygon
```

### PM2 部署
```bash
pm2 start ecosystem.config.cjs
pm2 logs copy-trading-supervisor
pm2 restart copy-trading-supervisor
pm2 stop copy-trading-supervisor
```

## 重要提示

### CTF 操作注意事项
- Polymarket CTF 需要 **USDC.e** (0x2791...)，而非原生 USDC
- 最小订单金额为 **$1 USDC**
- 使用 `OnchainService` 进行链上操作

### 订单簿镜像
- Polymarket 订单簿具有镜像属性：买入 YES @ P = 卖出 NO @ (1-P)
- 使用 SDK 提供的价格计算工具

### 价格获取优先级
1. CLOB 订单簿价格（主要）
2. Gamma API 价格（备用）
3. 强制回退价格模式（`COPY_TRADING_FORCE_FALLBACK_PRICE`）

### 全托理财系统
- 支持三种订阅级别：STARTER、PRO、WHALE
- 自动清算机制保护投资者
- 结算数学计算确保准确
- 策略主题支持自定义

### 参与项目
- 5级会员体系：ORDINARY → VIP → ELITE → PARTNER → SUPER_PARTNER
- 自动升级和淘汰机制
- 佣金实时计算

## 数据库架构

前端使用 Prisma ORM 管理 PostgreSQL 数据库，主要模型包括：

### 联盟推广系统
- **Referrer** - 推荐人
- **Referral** - 被推荐用户
- **TeamClosure** - 闭包表
- **Payout** - 提现记录
- **CommissionLog** - 佣金账本
- **ReferralVolume** - 交易量聚合

### 代理系统
- **UserProxy** - 用户代理钱包
- **ProxyTransaction** - 代理交易
- **FeeTransaction** - 费用记录

### 复制交易系统
- **CopyTradingConfig** - 复制交易配置
- **CopyTrade** - 复制交易记录
- **DebtRecord** - 债务记录
- **UserPosition** - 用户持仓
- **GuardrailEvent** - 守卫事件
- **ReimbursementLedger** - 报销账本

### 全托理财系统
- **ManagedSubscription** - 理财订阅
- **ManagedPosition** - 理财持仓
- **SettlementRecord** - 结算记录
- **LiquidationIntent** - 清算意向
- **StrategyTheme** - 策略主题

### 参与项目系统
- **Participant** - 参与者
- **LevelHistory** - 等级历史
- **BonusGrant** - 奖金发放
- **PolicyGate** - 政策门禁

## OpenSpec 规范管理

### 查看现有规范
```bash
openspec list --specs
openspec list
openspec show [spec-id] --type spec
```

### 创建变更提案
1. 检查现有规范和变更
2. 创建唯一的 change-id（kebab-case，动词引导）
3. 创建提案结构
4. 验证提案：`openspec validate <change-id> --strict --no-interactive`
5. 等待批准后再实现

### 当前活跃变更（部分）
- **add-daily-sell-reconciliation** - 每日卖出对账
- **add-funding-status-panel** - 资金状态面板
- **add-hybrid-signal-ingestion** - 混合信号摄取
- **add-liquidity-volume-filters** - 流动性/交易量过滤器
- **add-supervisor-auto-load-shedding** - 监控器自动负载丢弃
- **add-supervisor-dlq-ops-tool** - 死信队列操作工具
- **add-supervisor-monitoring-templates** - 监控模板
- **add-supervisor-operational-slo-metrics** - SLO 指标
- **add-supervisor-settlement-recovery-loop** - 结算恢复循环
- **close-managed-wealth-loop** - 关闭全托理财循环
- **enhance-positions-display** - 增强持仓展示
- **optimize-copy-execution-throughput** - 复制执行吞吐优化
- **optimize-portfolio-api-performance** - 投资组合 API 性能优化
- **enforce-redis-sharded-supervisor** - 强制 Redis 分片监控器

### 当前规范
- **affiliate-system** - 联盟推广系统
- **affiliate-landing-ui** - 联盟推广落地页
- **affiliate-withdrawals** - 联盟提现
- **copy-trading** - 复制交易系统
- **copy-execution** - 复制交易执行
- **fee-logic** - 费用逻辑
- **global-partner-program** - 全球合作伙伴计划
- **participation-program** - 参与项目系统
- **portfolio-api** - 投资组合 API
- **portfolio-ui** - 投资组合 UI
- **storage** - 存储规范
- **view-transaction-history** - 交易历史查看

## v0.3.0 重大变更

### UnifiedMarket.tokens 数组格式
```typescript
// v0.3.0
const yesToken = market.tokens.find(t => t.outcome === 'Yes');
const noToken = market.tokens.find(t => t.outcome === 'No');
```

### 新增服务
- **TokenMetadataService** - 代币元数据管理
- **CTFEventListener** - CTF 事件监听

### 全托理财系统
- 策略订阅模式
- 智能清算机制
- 结算数学计算
- 试用系统
- 主权预留

### 参与项目系统
- 5级会员体系
- 自动升级/淘汰
- 佣金实时计算

### 扩展 API
- 新增风险事件 API（managed-risk-events）
- 新增会员管理 API（managed-membership）
- 新增产品管理 API（managed-products）

## 文档资源

- [docs/api/](docs/api/) - API 参考
- [docs/architecture/](docs/architecture/) - 架构文档
- [docs/guides/](docs/guides/) - 实用指南
- [docs/operations/](docs/operations/) - 运维文档
- [sdk/examples/](sdk/examples/) - SDK 示例
- [docs/prds/](docs/prds/) - 产品需求文档
- [docs/plans/](docs/plans/) - 计划文档
- [docs/reports/](docs/reports/) - 分析报告

## 许可证

MIT License