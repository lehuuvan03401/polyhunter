/**
 * SmartMoneyService
 *
 * 聪明钱监控和自动跟单服务
 *
 * 核心功能：
 * 1. 监听指定地址的交易 - subscribeSmartMoneyTrades()
 * 2. 自动跟单 - startAutoCopyTrading()
 * 3. 聪明钱信息获取 - getSmartMoneyList(), getSmartMoneyInfo()
 *
 * ============================================================================
 * 设计决策
 * ============================================================================
 *
 * ## 监控方式
 * 使用 Activity WebSocket，延迟 < 100ms，实测验证有效。
 *
 * ## 下单方式
 * | 方式 | 使用场景 | 特点 |
 * |------|---------|------|
 * | FOK | 小额跟单 | 全部成交或取消 |
 * | FAK | 大额跟单 | 部分成交也接受 |
 *
 * ## 重要限制
 * ⚠️ Activity WebSocket 不会广播用户自己的交易！
 * 验证跟单结果请使用 TradingService.getTrades()
 */

import type { WalletService, WalletProfile } from './wallet-service.js';
import type { RealtimeServiceV2, ActivityTrade } from './realtime-service-v2.js';
import type { TradingService, OrderResult } from './trading-service.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Smart Money wallet information
 */
export interface SmartMoneyWallet {
  address: string;
  name?: string;
  pnl: number;
  volume: number;
  score: number;
  rank?: number;
  // Scientific metrics (optional - populated when available)
  profitFactor?: number;
  maxDrawdown?: number;
  volumeWeightedWinRate?: number;
  copyFriendliness?: number;
  dataQuality?: 'full' | 'limited' | 'insufficient';
}

/**
 * Smart Money trade from Activity WebSocket
 */
export interface SmartMoneyTrade {
  traderAddress: string;
  traderName?: string;
  conditionId?: string;
  marketSlug?: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  tokenId?: string;
  outcome?: string;
  txHash?: string;
  timestamp: number;
  isSmartMoney: boolean;
  smartMoneyInfo?: SmartMoneyWallet;
}

/**
 * Auto copy trading options
 */
export interface AutoCopyTradingOptions {
  /** Specific wallet addresses to follow */
  targetAddresses?: string[];
  /** Follow top N from leaderboard */
  topN?: number;

  /** Scale factor for size (0.1 = 10%) */
  sizeScale?: number;
  /** Maximum USDC per trade */
  maxSizePerTrade?: number;
  /** Maximum slippage (e.g., 0.03 = 3%) */
  maxSlippage?: number;
  /** Order type: FOK or FAK */
  orderType?: 'FOK' | 'FAK';
  /** Delay before executing (ms) */
  delay?: number;

  /** Minimum trade value to copy (USDC) */
  minTradeSize?: number;
  /** Only copy BUY or SELL trades */
  sideFilter?: 'BUY' | 'SELL';

  /** Dry run mode */
  dryRun?: boolean;

  /** Callbacks */
  onTrade?: (trade: SmartMoneyTrade, result: OrderResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Auto copy trading statistics
 */
export interface AutoCopyTradingStats {
  startTime: number;
  tradesDetected: number;
  tradesExecuted: number;
  tradesSkipped: number;
  tradesFailed: number;
  totalUsdcSpent: number;
}

/**
 * Auto copy trading subscription
 */
export interface AutoCopyTradingSubscription {
  id: string;
  targetAddresses: string[];
  startTime: number;
  isActive: boolean;
  stats: AutoCopyTradingStats;
  stop: () => void;
  getStats: () => AutoCopyTradingStats;
}

/**
 * Service configuration
 */
export interface SmartMoneyServiceConfig {
  /** Minimum PnL to be considered Smart Money (default: $1000) */
  minPnl?: number;
  /** Cache TTL (default: 300000 = 5 min) */
  cacheTtl?: number;
}

// ============================================================================
// SmartMoneyService
// ============================================================================

export class SmartMoneyService {
  private walletService: WalletService;
  private realtimeService: RealtimeServiceV2;
  private tradingService: TradingService;
  private config: Required<SmartMoneyServiceConfig>;

  private smartMoneyCache: Map<string, SmartMoneyWallet> = new Map();
  private smartMoneySet: Set<string> = new Set();
  private cacheTimestamp: number = 0;

  private activeSubscription: { unsubscribe: () => void } | null = null;
  private tradeHandlers: Set<(trade: SmartMoneyTrade) => void> = new Set();

  constructor(
    walletService: WalletService,
    realtimeService: RealtimeServiceV2,
    tradingService: TradingService,
    config: SmartMoneyServiceConfig = {}
  ) {
    this.walletService = walletService;
    this.realtimeService = realtimeService;
    this.tradingService = tradingService;

    this.config = {
      minPnl: config.minPnl ?? 1000,
      cacheTtl: config.cacheTtl ?? 300000,
    };
  }

  // ============================================================================
  // Smart Money Info
  // ============================================================================

  /**
   * Get list of Smart Money wallets from leaderboard with pagination
   */
  async getSmartMoneyList(optionsOrLimit: number | { page?: number; limit?: number } = 100): Promise<SmartMoneyWallet[]> {
    // Backward compatibility for when it was just a number
    const options = typeof optionsOrLimit === 'number'
      ? { page: 1, limit: optionsOrLimit }
      : { page: 1, limit: 100, ...optionsOrLimit };

    const { page = 1, limit = 20 } = options;
    const startIndex = (page - 1) * limit;
    const targetEndIndex = page * limit;

    // If we have enough cached data, return directly
    const cachedList = Array.from(this.smartMoneyCache.values());
    if (this.isCacheValid() && cachedList.length >= targetEndIndex) {
      return cachedList.slice(startIndex, targetEndIndex);
    }

    // 拉取策略：
    // 最终返回前会经过多轮过滤（PnL/活跃度/资料完整性），
    // 因此候选池必须放大，否则分页后段会频繁“数量不足”。
    // 这里用 3x 的经验系数做吞吐与准确率折中。
    const candidatesToFetch = Math.max(targetEndIndex * 3, 50);
    console.log(`[SmartMoney] Fetching ${candidatesToFetch} candidates from leaderboard for page ${page} (target index: ${targetEndIndex})`);

    const leaderboardPage = await this.walletService.getLeaderboard(0, candidatesToFetch);
    const entries = leaderboardPage.entries;
    console.log(`[SmartMoney] Got ${entries.length} entries from leaderboard`);

    const candidates = [];

    // 第一层过滤：基础盈利门槛（minPnl）。
    for (const trader of entries) {
      if (trader.pnl >= this.config.minPnl) {
        candidates.push(trader);
      }
    }
    console.log(`[SmartMoney] ${candidates.length} candidates after PnL filter (min: ${this.config.minPnl})`);

    const smartMoneyList: SmartMoneyWallet[] = [];

    // Clear cache if we are starting fresh (page 1) or cache expired,
    // BUT if we are just fetching the next page and cache is valid, we should append/check existing.
    // To keep it simple and consistent: We use the cache as the single source of truth.
    // We iterate through candidates and add valid ones to cache.

    // If cache is invalid, clear it
    if (!this.isCacheValid()) {
      console.log('[SmartMoney] Cache invalid or expired, clearing.');
      this.smartMoneyCache.clear();
      this.smartMoneySet.clear();
      this.cacheTimestamp = Date.now();
    }

    // 第二层过滤：活跃度校验（持仓/最近交易），并计算跟单评分。
    let processedCount = 0;
    const CHUNK_SIZE = 5;

    // We iterate until we have enough items in our cache (targetEndIndex) OR we run out of candidates
    const currentCacheSize = this.smartMoneyCache.size;
    const neededSize = targetEndIndex;
    console.log(`[SmartMoney] Current cache size: ${currentCacheSize}, Need: ${neededSize}`);

    if (currentCacheSize < neededSize) {
      while (this.smartMoneyCache.size < neededSize && processedCount < candidates.length) {
        const chunk = candidates.slice(processedCount, processedCount + CHUNK_SIZE);
        processedCount += chunk.length;

        // Skip candidates already in cache
        const newCandidates = chunk.filter(c => !this.smartMoneySet.has(c.address.toLowerCase()));

        if (newCandidates.length === 0) continue;

        const results = await Promise.all(newCandidates.map(async (trader) => {
          try {
            const profile = await this.walletService.getWalletProfile(trader.address);
            // 活跃判定：有持仓 或 最近 7 天有活动。
            const hasPositions = profile.positionCount > 0;
            const isRecent = Date.now() - profile.lastActiveAt.getTime() < 7 * 24 * 60 * 60 * 1000;

            if (hasPositions || isRecent) {
              // 评分口径（总分 100）：
              // - PnL 40 分（以 50k 为基准上限）
              // - Volume 30 分（以 500k 为基准上限）
              // - 持仓活跃 20 分
              // - 近期活跃 10 分
              // 该评分更偏向“可复制性”而非单纯绝对收益。
              const pnlScore = Math.min(40, Math.max(0, (trader.pnl / 50000) * 40));
              const volumeScore = Math.min(30, Math.max(0, (trader.volume / 500000) * 30));
              const activityScore = hasPositions ? 20 : 0;
              const recencyScore = isRecent ? 10 : 0;

              return {
                address: trader.address.toLowerCase(),
                name: trader.userName,
                pnl: trader.pnl,
                volume: trader.volume,
                score: Math.round(pnlScore + volumeScore + activityScore + recencyScore),
                rank: trader.rank,
                dataQuality: 'limited' as const, // SDK doesn't have trade-level data
              };
            }
          } catch (e) {
            console.warn(`Failed to verify profile for ${trader.address}:`, e);
          }
          return null;
        }));

        for (const wallet of results) {
          if (wallet) {
            this.smartMoneyCache.set(wallet.address, wallet);
            this.smartMoneySet.add(wallet.address);
          }
        }
      }
    }

    console.log(`[SmartMoney] Finished processing. Total valid: ${this.smartMoneyCache.size}`);
    return Array.from(this.smartMoneyCache.values()).slice(startIndex, targetEndIndex);
  }

  /**
   * Check if an address is Smart Money
   */
  async isSmartMoney(address: string): Promise<boolean> {
    const normalized = address.toLowerCase();
    if (this.isCacheValid()) {
      return this.smartMoneySet.has(normalized);
    }
    await this.getSmartMoneyList();
    return this.smartMoneySet.has(normalized);
  }

  /**
   * Get Smart Money info for an address
   */
  async getSmartMoneyInfo(address: string): Promise<SmartMoneyWallet | null> {
    const normalized = address.toLowerCase();
    if (this.isCacheValid() && this.smartMoneyCache.has(normalized)) {
      return this.smartMoneyCache.get(normalized)!;
    }
    await this.getSmartMoneyList();
    return this.smartMoneyCache.get(normalized) || null;
  }

  // ============================================================================
  // Trade Subscription - 监听交易
  // ============================================================================

  /**
   * Subscribe to trades from specific addresses
   *
   * @example
   * ```typescript
   * const sub = smartMoneyService.subscribeSmartMoneyTrades(
   *   (trade) => {
   *     console.log(`${trade.traderName} ${trade.side} ${trade.size} @ ${trade.price}`);
   *   },
   *   { filterAddresses: ['0x1234...', '0x5678...'] }
   * );
   *
   * // Stop listening
   * sub.unsubscribe();
   * ```
   */
  subscribeSmartMoneyTrades(
    onTrade: (trade: SmartMoneyTrade) => void,
    options: {
      filterAddresses?: string[];
      minSize?: number;
      smartMoneyOnly?: boolean;
    } = {}
  ): { id: string; unsubscribe: () => void } {
    this.tradeHandlers.add(onTrade);

    // Ensure cache is populated
    this.getSmartMoneyList().catch(() => { });

    // Start subscription if not active
    if (!this.activeSubscription) {
      this.activeSubscription = this.realtimeService.subscribeAllActivity({
        onTrade: (activityTrade: ActivityTrade) => {
          this.handleActivityTrade(activityTrade, options);
        },
        onError: (error) => {
          console.error('[SmartMoneyService] Subscription error:', error);
        },
      });
    }

    return {
      id: `smart_money_${Date.now()}`,
      unsubscribe: () => {
        this.tradeHandlers.delete(onTrade);
        if (this.tradeHandlers.size === 0 && this.activeSubscription) {
          this.activeSubscription.unsubscribe();
          this.activeSubscription = null;
        }
      },
    };
  }

  private async handleActivityTrade(
    trade: ActivityTrade,
    options: { filterAddresses?: string[]; minSize?: number; smartMoneyOnly?: boolean }
  ): Promise<void> {
    const rawAddress = trade.trader?.address;
    if (!rawAddress) return;

    const traderAddress = rawAddress.toLowerCase();

    // Address filter
    if (options.filterAddresses && options.filterAddresses.length > 0) {
      const normalized = options.filterAddresses.map(a => a.toLowerCase());
      if (!normalized.includes(traderAddress)) return;
    }

    // Size filter
    if (options.minSize && trade.size < options.minSize) return;

    // Smart Money filter
    // 注意：这里依赖本地缓存，不会每笔 trade 都走远程查询，
    // 目的是把实时路径控制在内存判断，避免订阅回调阻塞。
    const isSmartMoney = this.smartMoneySet.has(traderAddress);
    if (options.smartMoneyOnly && !isSmartMoney) return;

    const smartMoneyTrade: SmartMoneyTrade = {
      traderAddress,
      traderName: trade.trader?.name,
      conditionId: trade.conditionId,
      marketSlug: trade.marketSlug,
      side: trade.side,
      size: trade.size,
      price: trade.price,
      tokenId: trade.asset,
      outcome: trade.outcome,
      txHash: trade.transactionHash,
      timestamp: trade.timestamp,
      isSmartMoney,
      smartMoneyInfo: this.smartMoneyCache.get(traderAddress),
    };

    for (const handler of this.tradeHandlers) {
      try {
        handler(smartMoneyTrade);
      } catch (error) {
        console.error('[SmartMoneyService] Handler error:', error);
      }
    }
  }

  // ============================================================================
  // Auto Copy Trading - 自动跟单
  // ============================================================================

  /**
   * Start auto copy trading - 自动跟单
   *
   * @example
   * ```typescript
   * const sub = await smartMoneyService.startAutoCopyTrading({
   *   targetAddresses: ['0x1234...'],
   *   // 或者跟踪排行榜前N名
   *   topN: 10,
   *
   *   sizeScale: 0.1,        // 10%
   *   maxSizePerTrade: 50,   // $50
   *   maxSlippage: 0.03,     // 3%
   *   orderType: 'FOK',
   *
   *   dryRun: true,          // 测试模式
   *
   *   onTrade: (trade, result) => console.log(result),
   * });
   *
   * // 停止
   * sub.stop();
   * ```
   */
  async startAutoCopyTrading(options: AutoCopyTradingOptions): Promise<AutoCopyTradingSubscription> {
    const startTime = Date.now();

    // 1) 构建跟单目标集合：
    // 支持“显式地址”与“排行榜 TopN”混合，最后去重后统一执行。
    let targetAddresses: string[] = [];

    if (options.targetAddresses?.length) {
      targetAddresses = options.targetAddresses.map(a => a.toLowerCase());
    }

    if (options.topN && options.topN > 0) {
      const smartMoneyList = await this.getSmartMoneyList(options.topN);
      const topAddresses = smartMoneyList.map(w => w.address);
      targetAddresses = [...new Set([...targetAddresses, ...topAddresses])];
    }

    if (targetAddresses.length === 0) {
      throw new Error('No target addresses. Use targetAddresses or topN.');
    }

    // 2) 运行期统计：用于观测命中率、执行率和资金消耗。
    const stats: AutoCopyTradingStats = {
      startTime,
      tradesDetected: 0,
      tradesExecuted: 0,
      tradesSkipped: 0,
      tradesFailed: 0,
      totalUsdcSpent: 0,
    };

    // 3) 参数归一化：避免每次回调中重复处理可选参数。
    const sizeScale = options.sizeScale ?? 0.1;
    const maxSizePerTrade = options.maxSizePerTrade ?? 50;
    const maxSlippage = options.maxSlippage ?? 0.03;
    const orderType = options.orderType ?? 'FOK';
    const minTradeSize = options.minTradeSize ?? 10;
    const sideFilter = options.sideFilter;
    const delay = options.delay ?? 0;
    const dryRun = options.dryRun ?? false;

    // 4) 订阅实时交易流并执行“过滤 -> 尺寸计算 -> 下单”流水线。
    const subscription = this.subscribeSmartMoneyTrades(
      async (trade: SmartMoneyTrade) => {
        stats.tradesDetected++;

        try {
          // Check target
          if (!targetAddresses.includes(trade.traderAddress.toLowerCase())) {
            return;
          }

          // Filters:
          // - 最小成交额过滤，避免噪声单
          // - 买卖方向过滤，支持只跟 BUY/SELL
          const tradeValue = trade.size * trade.price;
          if (tradeValue < minTradeSize) {
            stats.tradesSkipped++;
            return;
          }

          if (sideFilter && trade.side !== sideFilter) {
            stats.tradesSkipped++;
            return;
          }

          // 跟单尺寸模型：
          // - 先按原单 sizeScale 缩放
          // - 再受 maxSizePerTrade 上限约束
          // 这样可同时兼顾“跟随比例”和“单笔风险上限”。
          let copySize = trade.size * sizeScale;
          let copyValue = copySize * trade.price;

          // Enforce max size
          if (copyValue > maxSizePerTrade) {
            copySize = maxSizePerTrade / trade.price;
            copyValue = maxSizePerTrade;
          }

          // Polymarket minimum order is $1
          const MIN_ORDER_SIZE = 1;
          if (copyValue < MIN_ORDER_SIZE) {
            stats.tradesSkipped++;
            return;
          }

          // Delay
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          // Token
          const tokenId = trade.tokenId;
          if (!tokenId) {
            stats.tradesSkipped++;
            return;
          }

          // 保护价（滑点）：
          // - BUY 上浮，防止追单时成交不了
          // - SELL 下调，防止卖单挂空
          // 这里与 TradingService 的 market order 保护价语义保持一致。
          const slippagePrice = trade.side === 'BUY'
            ? trade.price * (1 + maxSlippage)
            : trade.price * (1 - maxSlippage);

          const usdcAmount = copyValue; // Already calculated above

          // Execute
          let result: OrderResult;

          if (dryRun) {
            result = { success: true, orderId: `dry_run_${Date.now()}` };
            console.log('[DRY RUN]', {
              trader: trade.traderAddress.slice(0, 10),
              side: trade.side,
              market: trade.marketSlug,
              copy: { size: copySize.toFixed(2), usdc: usdcAmount.toFixed(2) },
            });
          } else {
            result = await this.tradingService.createMarketOrder({
              tokenId,
              side: trade.side,
              amount: usdcAmount,
              price: slippagePrice,
              orderType,
            });
          }

          if (result.success) {
            stats.tradesExecuted++;
            stats.totalUsdcSpent += usdcAmount;
          } else {
            stats.tradesFailed++;
          }

          options.onTrade?.(trade, result);
        } catch (error) {
          stats.tradesFailed++;
          options.onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      },
      { filterAddresses: targetAddresses, minSize: minTradeSize }
    );

    return {
      id: subscription.id,
      targetAddresses,
      startTime,
      isActive: true,
      stats,
      stop: () => subscription.unsubscribe(),
      getStats: () => ({ ...stats }),
    };
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private isCacheValid(): boolean {
    return Date.now() - this.cacheTimestamp < this.config.cacheTtl && this.smartMoneyCache.size > 0;
  }

  disconnect(): void {
    if (this.activeSubscription) {
      this.activeSubscription.unsubscribe();
      this.activeSubscription = null;
    }
    this.tradeHandlers.clear();
    this.smartMoneyCache.clear();
    this.smartMoneySet.clear();
  }
}
