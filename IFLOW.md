# 项目概览

## 项目简介

`@catalyst-team/poly-sdk` 是一个全面的 TypeScript SDK,为 Polymarket 提供统一的 API 接口。该 SDK 支持交易、市场数据分析、智能资金分析和链上操作。它整合了多个 Polymarket API(Data API、Gamma API、CLOB API)并提供了高级服务如套利检测、智能资金跟踪和实时 WebSocket 数据流。

**当前版本**: v0.3.0  
**构建者**: [@hhhx402](https://x.com/hhhx402) | **项目**: [Catalyst.fun](https://x.com/catalystdotfun)

## 项目架构

### 三层架构

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              PolymarketSDK                                    │
│                            (Entry Point)                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Layer 3: High-Level Services (Recommended)                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                      │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                 │
│  │  TradingService │ │  MarketService  │ │ OnchainService  │                 │
│  │  ────────────── │ │  ────────────── │ │ ──────────────  │                 │
│  │  • Limit orders │ │  • K-lines      │ │ • Split/Merge   │                 │
│  │  • Market orders│ │  • Orderbook    │ │ • Redeem        │                 │
│  │  • Order mgmt   │ │  • Price history│ │ • Approvals     │                 │
│  │  • Rewards      │ │  • Arbitrage    │ │ • Swaps         │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘                 │
│                                                                               │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                 │
│  │RealtimeServiceV2│ │  WalletService  │ │SmartMoneyService│                 │
│  │  ────────────── │ │  ────────────── │ │ ──────────────  │                 │
│  │  • WebSocket    │ │  • Profiles     │ │ • Top traders   │                 │
│  │  • Price feeds  │ │  • Smart scores │ │ • Copy trading  │                 │
│  │  • Book updates │ │  • Sell detect  │ │ • Signal detect │ │
│  │  • User events  │ │  • PnL calc     │ │ • Leaderboard   │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘                 │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                        ArbitrageService                                  │ │
│  │  ─────────────────────────────────────────────────────────────────────  │ │
│  │  • Market scanning  • Auto execution  • Rebalancer  • Smart clearing    │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                     AuthorizationService                                  │ │
│  │  ─────────────────────────────────────────────────────────────────────  │ │
│  │  • ERC20 approvals   • ERC1155 approvals   • Allowance checking         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         SwapService                                      │ │
│  │  ─────────────────────────────────────────────────────────────────────  │ │
│  │  • DEX swaps (QuickSwap V3)   • Token transfers   • Balance checks      │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Layer 2: Low-Level Clients (Advanced Users / Raw API Access)                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│  │GammaApiClnt│ │DataApiClnt │ │SubgraphClnt│ │ CTFClient  │ │BridgeClient│ │
│  │ ────────── │ │ ────────── │ │ ────────── │ │ ────────── │ │ ────────── │ │
│  │ • Markets  │ │ • Positions│ │ • On-chain │ │ • Split    │ │ • Cross-   │ │
│  │ • Events   │ │ • Trades   │ │ • PnL      │ │ • Merge    │ │   chain    │ │
│  │ • Search   │ │ • Activity │ │ • OI       │ │ • Redeem   │ │ • Deposits │ │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘ │
│                                                                               │
│  Uses Official Polymarket Clients:                                           │
│  • @polymarket/clob-client - Trading, orderbook, market data                 │
│  • @polymarket/real-time-data-client - WebSocket real-time updates           │
│                                                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Layer 1: Core Infrastructure                                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│  │RateLimiter │ │   Cache    │ │   Errors   │ │   Types    │ │Price Utils │ │
│  │ ────────── │ │ ────────── │ │ ────────── │ │ ────────── │ │ ────────── │ │
│  │ • Per-API  │ │ • TTL-based│ │ • Retry    │ │ • Unified  │ │ • Arb calc │ │
│  │ • Bottleneck│ │ • Pluggable│ │ • Codes    │ │ • K-lines  │ │ • Rounding │ │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘ │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 服务职责

| 服务 | 职责 |
|------|------|
| **PolymarketSDK** | 入口点,集成所有服务 |
| **TradingService** | 订单管理(下单/取消/查询) |
| **MarketService** | 市场数据(订单簿/K线/搜索) |
| **OnchainService** | 链上操作(拆分/合并/兑换/授权/交换) |
| **RealtimeServiceV2** | WebSocket 实时数据 |
| **WalletService** | 钱包/交易者分析 |
| **SmartMoneyService** | 智能资金跟踪与自动复制交易 |
| **ArbitrageService** | 套利检测与执行 |
| **AuthorizationService** | 代币授权管理 |
| **SwapService** | DEX 交换服务 |

## 主要功能

### 1. 交易功能
- 支持限价单和市价单(GTC、GTD、FOK、FAK)
- 订单管理(下单、取消、查询)
- 奖励跟踪(做市激励)
- 最小订单金额:$1 USDC

### 2. 市场数据分析
- K线数据获取
- 订单簿分析
- 套利机会检测
- 价格历史数据
- 双K线分析(YES + NO)

### 3. 智能资金分析
- 顶级交易者跟踪
- 智能资金识别
- 自动复制交易(实时)
- 钱包配置文件分析
- 卖出活动检测

### 4. 套利服务
- 实时套利扫描
- 自动执行
- 资金再平衡
- 位置管理
- 智能清算

### 5. 链上操作
- CTF(拆分/合并/兑换)
- 代币授权(ERC20/ERC1155)
- DEX 交换(QuickSwap V3)
- 桥接存款
- 余额检查

## 核心实现细节

### 速率限制
SDK 使用 Bottleneck 库实现 API 速率限制:
- Data API: 100ms 最小间隔
- Gamma API: 10 req/s
- CLOB API: 10 req/s
- Subgraph: 50ms 最小间隔

### 缓存系统
SDK 提供统一的缓存接口,支持:
- 内置内存缓存
- 外部缓存适配器(如 Redis)
- TTL 基于的时间限制
- 统一缓存接口(UnifiedCache)

### WebSocket 实时数据
使用官方的 `@polymarket/real-time-data-client` 库,支持:
- 价格更新
- 订单簿更新
- 最后成交价
- 用户订单和交易事件
- 自动重连

### 订单簿套利计算
SDK 实现了 Polymarket 的镜像订单处理:
- 有效买入价格:min(YES.ask, 1 - NO.bid)
- 有效卖出价格:max(YES.bid, 1 - NO.ask)
- 长套利利润:1 - (有效买入 YES + 有效买入 NO)
- 短套利利润:(有效卖出 YES + 有效卖出 NO) - 1

### v0.3.0 重大变更

**UnifiedMarket.tokens 现在是数组格式**

变更前(v0.2.x):
```typescript
// 对象格式,包含 yes/no 属性
const yesPrice = market.tokens.yes.price;
const noPrice = market.tokens.no.price;
```

变更后(v0.3.0):
```typescript
// 数组格式,包含 MarketToken 对象
const yesToken = market.tokens.find(t => t.outcome === 'Yes');
const noToken = market.tokens.find(t => t.outcome === 'No');

const yesPrice = yesToken?.price;
const noPrice = noToken?.price;
```

迁移辅助函数:
```typescript
function getTokenPrice(market: UnifiedMarket, outcome: 'Yes' | 'No'): number {
  return market.tokens.find(t => t.outcome === outcome)?.price ?? 0;
}
```

## 使用示例

### 基础使用(只读操作)
```typescript
import { PolymarketSDK } from '@catalyst-team/poly-sdk';

// 无需认证的只读操作
const sdk = new PolymarketSDK();

// 通过 slug 或条件 ID 获取市场
const market = await sdk.getMarket('will-trump-win-2024');
console.log(`${market.question}`);
console.log(`YES: ${market.tokens.find(t => t.outcome === 'Yes')?.price}`);
console.log(`NO: ${market.tokens.find(t => t.outcome === 'No')?.price}`);

// 获取分析处理后的订单簿
const orderbook = await sdk.getOrderbook(market.conditionId);
console.log(`Long Arb Profit: ${orderbook.summary.longArbProfit}`);
console.log(`Short Arb Profit: ${orderbook.summary.shortArbProfit}`);

// 检测套利机会
const arb = await sdk.detectArbitrage(market.conditionId);
if (arb) {
  console.log(`${arb.type.toUpperCase()} ARB: ${(arb.profit * 100).toFixed(2)}% profit`);
  console.log(arb.action);
}
```

### 带认证的交易
```typescript
import { PolymarketSDK } from '@catalyst-team/poly-sdk';

// 推荐:使用静态工厂方法(一行代码开始)
const sdk = await PolymarketSDK.create({
  privateKey: process.env.POLYMARKET_PRIVATE_KEY!,
});
// 准备交易 - SDK 已初始化并 WebSocket 已连接

// 下限价单
const order = await sdk.tradingService.createLimitOrder({
  tokenId: yesTokenId,
  side: 'BUY',
  price: 0.45,
  size: 10,
  orderType: 'GTC',
});
console.log(`Order placed: ${order.id}`);

// 获取未平仓订单
const openOrders = await sdk.tradingService.getOpenOrders();
console.log(`Open orders: ${openOrders.length}`);

// 完成时清理
sdk.stop();
```

### 智能资金自动复制交易
```typescript
import { PolymarketSDK } from '@catalyst-team/poly-sdk';

const sdk = await PolymarketSDK.create({ privateKey: '0x...' });

// 启动自动复制交易
const subscription = await sdk.smartMoney.startAutoCopyTrading({
  topN: 50,                    // 跟踪排行榜前50名交易者
  sizeScale: 0.1,              // 复制10%的交易规模
  maxSizePerTrade: 10,         // 每笔交易最大$10
  maxSlippage: 0.03,           // 3%滑点容忍度
  orderType: 'FOK',            // FOK或FAK
  minTradeSize: 5,             // 仅复制>$5的交易
  sideFilter: 'BUY',           // 仅复制买单(可选)
  dryRun: true,                // 设置为false进行真实交易

  onTrade: (trade, result) => {
    console.log(`复制 ${trade.traderName}: ${result.success ? '✅' : '❌'}`);
  },
  onError: (error) => console.error(error),
});

// 获取统计信息
const stats = subscription.getStats();
console.log(`检测到: ${stats.tradesDetected}, 执行: ${stats.tradesExecuted}`);

// 停止
subscription.stop();
sdk.stop();
```

### 套利服务
```typescript
import { ArbitrageService } from '@catalyst-team/poly-sdk';

const arbService = new ArbitrageService({
  privateKey: process.env.POLY_PRIVKEY,
  profitThreshold: 0.005,  // 0.5%最小利润
  minTradeSize: 5,         // $5最小
  maxTradeSize: 100,       // $100最大
  autoExecute: true,       // 自动执行机会
  enableRebalancer: true,  // 启用再平衡器
  minUsdcRatio: 0.2,       // 最小20% USDC
  maxUsdcRatio: 0.8,       // 最大80% USDC
  targetUsdcRatio: 0.5,    // 再平衡目标
});

// 扫描市场机会
const results = await arbService.scanMarkets({ minVolume24h: 5000 }, 0.005);

// 启动监控最佳市场
const best = await arbService.findAndStart(0.005);
console.log(`启动: ${best.market.name} (+${best.profitPercent.toFixed(2)}%)`);

// 运行一段时间后停止并清算位置
await arbService.stop();
const clearResult = await arbService.clearPositions(best.market, true);
console.log(`回收: $${clearResult.totalUsdcRecovered.toFixed(2)}`);
```

## 构建和测试

### 构建命令
```bash
# 构建项目
pnpm run build

# 运行测试
pnpm run test
pnpm run test:watch
pnpm run test:integration

# 运行开发模式(监听变化)
pnpm run dev
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

## 项目结构

```
poly-sdk/
├── src/
│   ├── index.ts                 # SDK 入口点
│   ├── core/                    # 核心基础设施
│   │   ├── rate-limiter.ts      # 速率限制
│   │   ├── cache.ts             # 缓存系统
│   │   ├── errors.ts            # 错误处理
│   │   ├── types.ts             # 类型定义
│   │   └── unified-cache.ts     # 统一缓存接口
│   ├── clients/                 # API 客户端
│   │   ├── data-api.ts          # Data API
│   │   ├── gamma-api.ts         # Gamma API
│   │   ├── subgraph.ts          # Subgraph (Goldsky)
│   │   ├── ctf-client.ts        # CTF 合约
│   │   └── bridge-client.ts     # 跨链桥接
│   ├── services/                # 高级服务
│   │   ├── trading-service.ts   # 交易服务
│   │   ├── market-service.ts    # 市场数据服务
│   │   ├── wallet-service.ts    # 钱包分析服务
│   │   ├── smart-money-service.ts  # 智能资金服务
│   │   ├── arbitrage-service.ts    # 套利服务
│   │   ├── realtime-service-v2.ts  # 实时数据服务
│   │   ├── onchain-service.ts      # 链上操作服务
│   │   ├── authorization-service.ts # 授权服务
│   │   └── swap-service.ts         # 交换服务
│   └── utils/                   # 工具函数
│       └── price-utils.ts       # 价格计算工具
├── examples/                   # 使用示例
│   └── README.md                # 示例文档
├── scripts/                    # 实用脚本
│   ├── README.md                # 脚本文档
│   ├── api-verification/       # API 验证
│   ├── approvals/              # 授权操作
│   ├── arb/                    # 套利相关
│   ├── arb-tests/              # 套利测试
│   ├── deposit/                # 存款操作
│   ├── smart-money/            # 智能资金测试
│   ├── trading/                # 交易测试
│   ├── verify/                 # 验证脚本
│   ├── wallet/                 # 钱包操作
│   └── research/               # 市场研究
├── docs/                       # 文档
│   ├── README.md               # 文档导航
│   ├── api/                    # API 参考
│   ├── architecture/           # 架构文档
│   ├── guides/                 # 实用指南
│   ├── arb/                    # 套利文档
│   ├── concepts/               # 概念理解
│   ├── reports/                # 分析报告
│   ├── plans/                  # 计划文档
│   ├── test/                   # 测试文档
│   └── archive/                # 归档文档
├── contracts/                  # 智能合约(Hardhat)
│   ├── contracts/              # 合约源码
│   ├── scripts/                # 部署脚本
│   └── test/                   # 合约测试
├── backend/                    # 后端服务
│   └── affiliate-service/      # 联盟推广服务(Spring Boot)
├── frontend/                   # 前端应用(Next.js)
│   ├── app/                    # App Router 页面
│   ├── components/             # React 组件
│   ├── lib/                    # 工具库
│   └── prisma/                 # 数据库模型
└── dashboard/                  # Next.js 仪表板
```

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

## 依赖

### 核心依赖
- `@polymarket/clob-client` (^5.1.3) - 官方 CLOB 交易客户端
- `@polymarket/real-time-data-client` (^1.4.0) - 官方 WebSocket 客户端
- `ethers@5` - 区块链交互
- `bottleneck` (^2.19.5) - 速率限制
- `@catalyst-team/cache` - 缓存适配器
- `ws` (^8.18.3) - WebSocket
- `isomorphic-ws` (^5.0.0) - WebSocket 兼容层

### 开发依赖
- `typescript` (^5.7.2) - TypeScript 编译器
- `vitest` (^2.1.8) - 测试框架
- `tsx` (^4.7.0) - TypeScript 执行器

## 重要提示

### CTF 操作注意事项
- Polymarket CTF 需要 **USDC.e** (0x2791...),而非原生 USDC
- 最小订单金额为 **$1 USDC**
- 使用 `OnchainService` 进行统一的链上操作

### 订单簿镜像订单
- Polymarket 订单簿具有镜像属性:买入 YES @ P = 卖出 NO @ (1-P)
- 使用 SDK 提供的有效价格计算函数避免重复计算
- 详细文档见:`docs/arb/arbitrage.md`

### WebSocket 连接
- 使用 `RealtimeServiceV2` 获取实时数据
- SDK 提供 `start()` 方法一次性完成初始化和连接
- 记得在结束时调用 `stop()` 清理资源

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