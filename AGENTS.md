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

# PolyHunter 项目指南

本文档为 AI 助手提供了 PolyHunter 项目的全面概览、架构指南和开发约定。

## 项目概述

**PolyHunter** 是一个完整的 Polymarket 生态系统项目，包含 TypeScript SDK、前端应用、智能合约和后端服务。该项目为 Polymarket 提供统一的 API 接口、交易工具、智能资金分析和用户界面。

**当前版本**: v0.3.0  
**构建者**: [@hhhx402](https://x.com/hhhx402) | **项目**: [Catalyst.fun](https://x.com/catalystdotfun)

## 项目结构

```
poly-hunter/
├── src/                        # SDK 源代码 (@catalyst-team/poly-sdk)
│   ├── core/                   # 核心基础设施（速率限制、缓存、错误处理）
│   ├── clients/                # API 客户端（Data API、Gamma API、Subgraph 等）
│   ├── services/               # 高级服务（交易、市场、智能资金、套利等）
│   ├── utils/                  # 工具函数
│   └── index.ts                # SDK 入口点
├── frontend/                   # Next.js 16 前端应用
│   ├── app/                    # App Router 页面
│   │   ├── affiliate/          # 联盟推广页面
│   │   ├── api/                # API 路由
│   │   ├── dashboard/          # 仪表板
│   │   ├── markets/            # 市场页面
│   │   ├── portfolio/          # 投资组合
│   │   ├── smart-money/        # 智能资金页面
│   │   ├── traders/            # 交易者页面
│   │   └── settings/           # 设置页面
│   ├── components/             # React 组件
│   ├── lib/                    # 工具库和服务
│   ├── prisma/                 # Prisma 数据库模型
│   └── scripts/                # 实用脚本
├── contracts/                  # Hardhat 智能合约
│   ├── contracts/              # 合约源码（Proxy、Factory、Treasury）
│   ├── scripts/                # 部署脚本
│   └── test/                   # 合约测试
├── backend/                    # 后端服务
│   └── affiliate-service/      # Spring Boot 联盟推广服务
├── examples/                   # SDK 使用示例
├── scripts/                    # 实用脚本和工具
├── docs/                       # 文档
├── openspec/                   # OpenSpec 规范管理
│   ├── specs/                  # 当前规范
│   └── changes/                # 变更提案
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
- **测试**: Vitest ^2.1.8

### 前端应用
- **框架**: Next.js 16.1.1 (App Router)
- **UI**: React 19.2.3
- **样式**: Tailwind CSS 4
- **认证**: Privy ^3.10.0
- **数据库**: Prisma ORM ^7.2.0 (PostgreSQL)
- **图表**: Recharts ^3.6.0
- **动画**: Framer Motion ^12.23.26

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
- 投资组合管理
- 智能资金复制交易
- 联盟推广系统（5级层级）

### 7. 智能合约
- PolyHunterProxy - 用户交易代理
- ProxyFactory - 代理工厂
- Treasury - 费用管理
- 自动费用收取（仅利润部分）

### 8. 后端服务
- Spring Boot 3.2.1
- 联盟推广系统
- PostgreSQL 数据库
- OpenAPI 文档

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
- Prisma ORM

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

## 数据库架构

前端使用 Prisma ORM 管理 PostgreSQL 数据库，主要模型包括：

### 联盟推广系统
- **Referrer** - 推荐人（5级层级：ORDINARY、VIP、ELITE、PARTNER、SUPER_PARTNER）
- **Referral** - 被推荐用户
- **TeamClosure** - 用于高效树遍历的闭包表
- **Payout** - 提现记录
- **CommissionLog** - 佣金详细账本

### 代理系统
- **UserProxy** - 用户的交易代理钱包（3级订阅：STARTER、PRO、WHALE）
- **ProxyTransaction** - 代理财务交易（存款/提现）
- **FeeTransaction** - 费用交易记录

### 复制交易系统
- **CopyTradingConfig** - 复制交易配置
- **CopyTrade** - 单个复制交易记录
- **SyncLog** - 同步历史记录
- **DebtRecord** - 失败报销的债务记录

### 利润费用系统
- **UserPosition** - 用户持仓（成本基础/利润计算）
- **VolumeTier** - 交易量费用层级配置

### 排行榜缓存
- **CachedTraderLeaderboard** - 缓存的交易者排行榜
- **LeaderboardCacheMeta** - 缓存更新状态元数据

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

### 当前活跃变更
- **cache-trader-leaderboard** - 缓存交易者排行榜数据
- **add-affiliate-rules-page** - 添加联盟推广规则页面
- **enhance-positions-display** - 增强持仓显示
- **implement-comprehensive-affiliate-system** - 实现综合联盟推广系统
- **implement-execution-modes** - 实现执行模式
- **improve-team-network-ui** - 改进团队网络 UI
- **optimize-execution-engine** - 优化执行引擎
- **optimize-mempool-provider** - 优化内存池提供商
- **optimize-real-copy-trading** - 优化真实复制交易
- **verify-live-copy-trading** - 验证实时复制交易

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
- [docs/arb/arbitrage.md](docs/arb/arbitrage.md) - 套利机制和计算

### 概念理解
- [docs/concepts/polymarket-principles.md](docs/concepts/polymarket-principles.md) - Polymarket 三层架构

### 脚本文档
- [scripts/README.md](scripts/README.md) - 实用脚本使用指南
- [examples/README.md](examples/README.md) - 示例代码说明

## 许可证

MIT License