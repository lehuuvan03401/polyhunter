/**
 * TradingService
 *
 * 交易服务（基于官方 @polymarket/clob-client），是 SDK 的“下单执行底座”。
 *
 * 主要职责：
 * - 订单创建（限价/市价）
 * - 订单管理（撤单、查询）
 * - 做市奖励查询
 * - 余额与授权管理
 *
 * 注意：
 * - 行情分析能力已拆分到 MarketService，TradingService 只关注“可执行交易”。
 * - 复制交易等上层服务应复用本类，避免重复实现授权与下单细节。
 */

import {
  ClobClient,
  Side as ClobSide,
  OrderType as ClobOrderType,
  Chain,
  type OpenOrder,
  type Trade as ClobTrade,
  type TickSize,
} from '@polymarket/clob-client';

import { Wallet } from 'ethers';
import { RateLimiter, ApiType } from '../core/rate-limiter.js';
import type { UnifiedCache } from '../core/unified-cache.js';
import { CACHE_TTL } from '../core/unified-cache.js';
import { PolymarketError, ErrorCode } from '../core/errors.js';
import type { Side, OrderType } from '../core/types.js';

// Chain IDs
export const POLYGON_MAINNET = 137;
export const POLYGON_AMOY = 80002;

// CLOB Host
const CLOB_HOST = 'https://clob.polymarket.com';
const LOCAL_CHAIN_ID = 31337;

// ============================================================================
// Types
// ============================================================================

// Side and OrderType are imported from core/types.ts
// Re-export for backward compatibility
export type { Side, OrderType } from '../core/types.js';

export interface ApiCredentials {
  key: string;
  secret: string;
  passphrase: string;
}

export interface TradingServiceConfig {
  /** Private key for signing */
  privateKey: string;
  /** Chain ID (default: Polygon mainnet 137) */
  chainId?: number;
  /** Pre-generated API credentials (optional) */
  credentials?: ApiCredentials;
}

// Order types
export interface LimitOrderParams {
  tokenId: string;
  side: Side;
  price: number;
  size: number;
  orderType?: 'GTC' | 'GTD';
  expiration?: number;
}

export interface MarketOrderParams {
  tokenId: string;
  side: Side;
  amount: number;
  price?: number;
  orderType?: 'FOK' | 'FAK';
}

export interface Order {
  id: string;
  status: string;
  tokenId: string;
  side: Side;
  price: number;
  originalSize: number;
  filledSize: number;
  remainingSize: number;
  associateTrades: string[];
  createdAt: number;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  orderIds?: string[];
  errorMsg?: string;
  transactionHashes?: string[];
}

export interface TradeInfo {
  id: string;
  tokenId: string;
  side: Side;
  price: number;
  size: number;
  fee: number;
  timestamp: number;
}

// Rewards types
export interface UserEarning {
  date: string;
  conditionId: string;
  assetAddress: string;
  makerAddress: string;
  earnings: number;
  assetRate: number;
}

export interface MarketReward {
  conditionId: string;
  question: string;
  marketSlug: string;
  eventSlug: string;
  rewardsMaxSpread: number;
  rewardsMinSize: number;
  tokens: Array<{ tokenId: string; outcome: string; price: number }>;
  rewardsConfig: Array<{
    assetAddress: string;
    startDate: string;
    endDate: string;
    ratePerDay: number;
    totalRewards: number;
  }>;
}

// ============================================================================
// Orderbook Types
// ============================================================================

export interface OrderSummary {
  price: string;
  size: string;
}

export interface Orderbook {
  hash: string;
  asks: OrderSummary[];
  bids: OrderSummary[];
}

// ============================================================================
// TradingService Implementation
// ============================================================================

export class TradingService {
  private clobClient: ClobClient | null = null;
  private wallet: Wallet;
  private chainId: Chain;
  private credentials: ApiCredentials | null = null;
  private initialized = false;
  private tickSizeCache: Map<string, string> = new Map();
  private negRiskCache: Map<string, boolean> = new Map();

  constructor(
    private rateLimiter: RateLimiter,
    private cache: UnifiedCache,
    private config: TradingServiceConfig
  ) {
    // TradingService 始终以单钱包身份运行；上层若要多钱包并发应创建多实例。
    this.wallet = new Wallet(config.privateKey);
    this.chainId = (config.chainId || POLYGON_MAINNET) as Chain;
    this.credentials = config.credentials || null;
  }

  /**
   * Check if running on local/hardhat network
   * Local networks don't require real API credentials
   */
  private isLocalChain(): boolean {
    const chainId = this.chainId as number;
    return chainId === LOCAL_CHAIN_ID || chainId === 1337;
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.isLocalChain()) {
      // 本地链路不强依赖真实 API Key，主要用于流程联调与单测。
      console.log(`[TradingService] ⚠️ Localhost detected. Mocking CLOB initialization.`);
      this.credentials = {
        key: 'mock-key',
        secret: 'mock-secret',
        passphrase: 'mock-passphrase',
      };
      // We still create the client but we will bypass it in methods
      this.clobClient = new ClobClient(CLOB_HOST, this.chainId, this.wallet);
      console.log(`[TradingService] Initialized with Chain ID: ${this.chainId} (Local=${LOCAL_CHAIN_ID})`);
      this.initialized = true;
      return;
    }

    // 第一步：使用钱包（L1）初始化客户端，用于派生/创建 API Key。
    // 这是官方推荐流程：先通过签名身份建立 L2 凭据。
    this.clobClient = new ClobClient(CLOB_HOST, this.chainId, this.wallet);

    // 第二步：获取（或派生）L2 API 凭据。
    // 生产环境下应优先复用已有凭据，减少重复派生调用。
    if (!this.credentials) {
      const creds = await this.clobClient.createOrDeriveApiKey();
      this.credentials = {
        key: creds.key,
        secret: creds.secret,
        passphrase: creds.passphrase,
      };
    }

    // 第三步：使用 L2 凭据重建 client，后续交易请求走 API 鉴权路径。
    // 这样可以避免每次交易都依赖钱包签名，降低延迟和复杂度。
    this.clobClient = new ClobClient(
      CLOB_HOST,
      this.chainId,
      this.wallet,
      {
        key: this.credentials.key,
        secret: this.credentials.secret,
        passphrase: this.credentials.passphrase,
      }
    );

    this.initialized = true;
    return;

    this.initialized = true;
  }

  private async ensureInitialized(): Promise<ClobClient> {
    if (!this.initialized || !this.clobClient) {
      // 惰性初始化：首次真实调用时再建连接，减少冷启动开销。
      await this.initialize();
    }
    return this.clobClient!;
  }

  // ============================================================================
  // Trading Helpers
  // ============================================================================

  /**
   * Get tick size for a token
   */
  async getTickSize(tokenId: string): Promise<TickSize> {
    if (this.tickSizeCache.has(tokenId)) {
      // 热 token 会频繁下单，tickSize 缓存可减少重复 CLOB 请求。
      return this.tickSizeCache.get(tokenId)! as TickSize;
    }

    // 本地链路下返回固定 tick，便于本地联调不依赖远端 market 元信息。
    if (this.isLocalChain()) return { minimum_tick_size: 0.01 } as any;

    const client = await this.ensureInitialized();
    const tickSize = await client.getTickSize(tokenId);
    this.tickSizeCache.set(tokenId, tickSize);
    return tickSize;
  }

  /**
   * Check if token is neg risk
   */
  async isNegRisk(tokenId: string): Promise<boolean> {
    if (this.negRiskCache.has(tokenId)) {
      // negRisk 也按 token 缓存，避免每单重复查询市场属性。
      return this.negRiskCache.get(tokenId)!;
    }

    // 本地环境默认非 neg-risk，避免依赖线上特性开关。
    if (this.isLocalChain()) return false;

    const client = await this.ensureInitialized();
    const negRisk = await client.getNegRisk(tokenId);
    this.negRiskCache.set(tokenId, negRisk);
    return negRisk;
  }

  // ============================================================================
  // Order Creation
  // ============================================================================

  /**
   * Create and post a limit order
   */
  async createLimitOrder(params: LimitOrderParams): Promise<OrderResult> {
    const client = await this.ensureInitialized();

    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      if (this.isLocalChain()) {
        // Mock success for localhost
        console.log(`[TradingService] ⚠️ Localhost: Mocking Limit Order for ${params.tokenId}`);
        return {
          success: true,
          orderId: "mock-order-id-" + Date.now(),
          orderIds: ["mock-order-id-" + Date.now()],
          transactionHashes: ["0xmockhash"],
        };
      }
      try {
        const [tickSize, negRisk] = await Promise.all([
          this.getTickSize(params.tokenId),
          this.isNegRisk(params.tokenId),
        ]);

        const orderType = params.orderType === 'GTD' ? ClobOrderType.GTD : ClobOrderType.GTC;

        const result = await client.createAndPostOrder(
          {
            tokenID: params.tokenId,
            side: params.side === 'BUY' ? ClobSide.BUY : ClobSide.SELL,
            price: params.price,
            size: params.size,
            expiration: params.expiration || 0,
          },
          { tickSize, negRisk },
          orderType
        );

        // 兼容性说明：
        // 不同版本的 clob-client 在 success/orderID 字段行为上并不完全一致，
        // 因此这里采用“结果字段兜底判断”，避免把已提交订单误判为失败。
        const success = result.success === true ||
          (result.success !== false &&
            ((result.orderID !== undefined && result.orderID !== '') ||
              (result.transactionsHashes !== undefined && result.transactionsHashes.length > 0)));

        return {
          success,
          orderId: result.orderID,
          orderIds: result.orderIDs,
          errorMsg: result.errorMsg,
          transactionHashes: result.transactionsHashes,
        };
      } catch (error) {
        return {
          success: false,
          errorMsg: `Order failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    });
  }

  /**
   * Create and post a market order
   */
  async createMarketOrder(params: MarketOrderParams): Promise<OrderResult> {
    const client = await this.ensureInitialized();

    if (this.isLocalChain()) {
      // Mock success for localhost
      console.log(`[TradingService] ⚠️ Localhost: Mocking Market Order for ${params.tokenId}`);
      return {
        success: true,
        orderId: "mock-order-id-" + Date.now(),
        orderIds: ["mock-order-id-" + Date.now()],
        transactionHashes: ["0xmockhash"],
      };
    }

    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      try {
        const [tickSize, negRisk] = await Promise.all([
          this.getTickSize(params.tokenId),
          this.isNegRisk(params.tokenId),
        ]);

        const orderType = params.orderType === 'FAK' ? ClobOrderType.FAK : ClobOrderType.FOK;

        // 市价单语义说明：
        // - amount 按 USDC 价值传入（由上层决定 size 计算方式）
        // - price 作为保护价（滑点上限），并非传统“固定成交价”
        // - 默认 FOK，避免残单污染复制交易状态
        const result = await client.createAndPostMarketOrder(
          {
            tokenID: params.tokenId,
            side: params.side === 'BUY' ? ClobSide.BUY : ClobSide.SELL,
            amount: params.amount,
            price: params.price,
          },
          { tickSize, negRisk },
          orderType
        );

        // 同 createLimitOrder 的兼容性兜底，统一 success 判定口径。
        const success = result.success === true ||
          (result.success !== false &&
            ((result.orderID !== undefined && result.orderID !== '') ||
              (result.transactionsHashes !== undefined && result.transactionsHashes.length > 0)));

        return {
          success,
          orderId: result.orderID,
          orderIds: result.orderIDs,
          errorMsg: result.errorMsg,
          transactionHashes: result.transactionsHashes,
        };
      } catch (error) {
        return {
          success: false,
          errorMsg: `Market order failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    });
  }

  // ============================================================================
  // Order Management
  // ============================================================================

  async cancelOrder(orderId: string): Promise<OrderResult> {
    const client = await this.ensureInitialized();

    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      try {
        // 撤单操作保持“直接透传 + 统一错误包装”策略，便于上层统一处理。
        const result = await client.cancelOrder({ orderID: orderId });
        return { success: result.canceled ?? false, orderId };
      } catch (error) {
        throw new PolymarketError(
          ErrorCode.ORDER_FAILED,
          `Cancel failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  async cancelOrders(orderIds: string[]): Promise<OrderResult> {
    const client = await this.ensureInitialized();

    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      try {
        // 批量撤单用于快速清仓/风控止损；成功语义沿用 SDK 返回 canceled。
        const result = await client.cancelOrders(orderIds);
        return { success: result.canceled ?? false, orderIds };
      } catch (error) {
        throw new PolymarketError(
          ErrorCode.ORDER_FAILED,
          `Cancel orders failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  async cancelAllOrders(): Promise<OrderResult> {
    const client = await this.ensureInitialized();

    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      try {
        // 注意：这是账号级高风险操作，上层应避免在无筛选条件时误调用。
        const result = await client.cancelAll();
        return { success: result.canceled ?? false };
      } catch (error) {
        throw new PolymarketError(
          ErrorCode.ORDER_FAILED,
          `Cancel all failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  async getOpenOrders(marketId?: string): Promise<Order[]> {
    const client = await this.ensureInitialized();

    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      const orders = await client.getOpenOrders(marketId ? { market: marketId } : undefined);

      return orders.map((o: OpenOrder) => {
        // 字段归一化：把字符串数值统一转换为 number，减少上层重复 parse。
        const originalSize = Number(o.original_size) || 0;
        const filledSize = Number(o.size_matched) || 0;
        return {
          id: o.id,
          status: o.status,
          tokenId: o.asset_id,
          side: o.side.toUpperCase() as Side,
          price: Number(o.price) || 0,
          originalSize,
          filledSize,
          remainingSize: originalSize - filledSize,
          associateTrades: o.associate_trades || [],
          createdAt: o.created_at,
        };
      });
    });
  }

  async getTrades(marketId?: string): Promise<TradeInfo[]> {
    const client = await this.ensureInitialized();

    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      const trades = await client.getTrades(marketId ? { market: marketId } : undefined);

      // 交易记录用于事后分析/对账，不在此处做额外业务过滤。
      return trades.map((t: ClobTrade) => ({
        id: t.id,
        tokenId: t.asset_id,
        side: t.side as Side,
        price: Number(t.price) || 0,
        size: Number(t.size) || 0,
        fee: Number(t.fee_rate_bps) || 0,
        timestamp: Number(t.match_time) || Date.now(),
      }));
    });
  }

  async getOrderBook(tokenId: string): Promise<Orderbook> {
    const client = await this.ensureInitialized();
    // 本地 mock 盘口用于避免空数据触发上层逻辑分支（如自动滑点计算）。
    if (this.isLocalChain()) {
      return {
        hash: "mock-hash",
        asks: [{ price: "0.55", size: "1000" }],
        bids: [{ price: "0.45", size: "1000" }]
      };
    }
    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      return await client.getOrderBook(tokenId);
    });
  }

  // ============================================================================
  // Rewards
  // ============================================================================

  async isOrderScoring(orderId: string): Promise<boolean> {
    const client = await this.ensureInitialized();
    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      const result = await client.isOrderScoring({ order_id: orderId });
      return result.scoring;
    });
  }

  async areOrdersScoring(orderIds: string[]): Promise<Record<string, boolean>> {
    const client = await this.ensureInitialized();
    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      return await client.areOrdersScoring({ orderIds });
    });
  }

  async getEarningsForDay(date: string): Promise<UserEarning[]> {
    const client = await this.ensureInitialized();
    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      const earnings = await client.getEarningsForUserForDay(date);
      // 奖励字段重命名后输出，保持 SDK 对外字段稳定性。
      return earnings.map(e => ({
        date: e.date,
        conditionId: e.condition_id,
        assetAddress: e.asset_address,
        makerAddress: e.maker_address,
        earnings: e.earnings,
        assetRate: e.asset_rate,
      }));
    });
  }

  async getCurrentRewards(): Promise<MarketReward[]> {
    const client = await this.ensureInitialized();
    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      const rewards = await client.getCurrentRewards();
      // 当前奖励配置是 market 维度策略输入，常用于做市参数调优。
      return rewards.map(r => ({
        conditionId: r.condition_id,
        question: r.question,
        marketSlug: r.market_slug,
        eventSlug: r.event_slug,
        rewardsMaxSpread: r.rewards_max_spread,
        rewardsMinSize: r.rewards_min_size,
        tokens: r.tokens.map(t => ({
          tokenId: t.token_id,
          outcome: t.outcome,
          price: t.price,
        })),
        rewardsConfig: r.rewards_config.map(c => ({
          assetAddress: c.asset_address,
          startDate: c.start_date,
          endDate: c.end_date,
          ratePerDay: c.rate_per_day,
          totalRewards: c.total_rewards,
        })),
      }));
    });
  }

  // ============================================================================
  // Balance & Allowance
  // ============================================================================

  async getBalanceAllowance(
    assetType: 'COLLATERAL' | 'CONDITIONAL',
    tokenId?: string
  ): Promise<{ balance: string; allowance: string }> {
    const client = await this.ensureInitialized();
    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      // 返回 string 以避免大数精度丢失；数值比较应在调用侧显式转换。
      const result = await client.getBalanceAllowance({
        asset_type: assetType as any,
        token_id: tokenId,
      });
      return { balance: result.balance, allowance: result.allowance };
    });
  }

  async updateBalanceAllowance(
    assetType: 'COLLATERAL' | 'CONDITIONAL',
    tokenId?: string
  ): Promise<void> {
    const client = await this.ensureInitialized();
    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      // 触发链上授权更新，实际确认策略由 clob-client 内部处理。
      await client.updateBalanceAllowance({
        asset_type: assetType as any,
        token_id: tokenId,
      });
    });
  }

  // ============================================================================
  // Account Info
  // ============================================================================

  getAddress(): string {
    return this.wallet.address;
  }

  getWallet(): Wallet {
    return this.wallet;
  }

  getCredentials(): ApiCredentials | null {
    return this.credentials;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getClobClient(): ClobClient | null {
    return this.clobClient;
  }

  // ============================================================================
  // Approvals (Hardening)
  // ============================================================================

  /**
   * Verify and Approve Allowance for CLOB Exchange
   * Calculates 'max' allowance and approves if current < required.
   */
  async verifyAndApproveAllowance(
    assetType: 'COLLATERAL' | 'CONDITIONAL',
    tokenId?: string,
    minAmount: number = 1000000000 // Default check amount
  ): Promise<boolean> {
    const client = await this.ensureInitialized();
    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      try {
        console.log(`[TradingService] 🛡️ Checking allowance for ${assetType} ${tokenId || ''}...`);

        const { allowance } = await client.getBalanceAllowance({
          asset_type: assetType as any,
          token_id: tokenId
        });

        const currentAllowance = Number(allowance);

        // 授权充足则直接放行，避免重复触发链上授权交易。
        if (currentAllowance >= minAmount) {
          // console.log(`[TradingService] ✅ Allowance OK: ${currentAllowance}`);
          return true;
        }

        console.log(`[TradingService] ⚠️ Allowance Low (${currentAllowance} < ${minAmount}). Approving...`);

        const result = await client.updateBalanceAllowance({
          asset_type: assetType as any,
          token_id: tokenId
        });

        console.log(`[TradingService] ✅ Approved! Tx: ${result}`);
        // 注意：这里默认 clob-client 已处理必要的链上确认流程。
        // 若上游场景对“已上链确认”要求更严格，应在调用侧增加二次确认。
        return true;
      } catch (e) {
        console.error(`[TradingService] ❌ Failed to approve allowance:`, e);
        return false;
      }
    });
  }

}
