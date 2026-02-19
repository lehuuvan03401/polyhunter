/**
 * Market Service
 *
 * Provides market data and analysis:
 * - Market info and discovery
 * - Orderbook data and analysis
 * - K-Line aggregation from trade data
 * - Spread analysis
 * - Arbitrage detection
 */

import {
  ClobClient,
  Side as ClobSide,
  Chain,
  PriceHistoryInterval,
  type OrderBookSummary,
} from '@polymarket/clob-client';
import { Wallet } from 'ethers';
import { DataApiClient, Trade } from '../clients/data-api.js';
import { GammaApiClient, GammaMarket } from '../clients/gamma-api.js';
import type { UnifiedCache } from '../core/unified-cache.js';
import { CACHE_TTL } from '../core/unified-cache.js';
import { RateLimiter, ApiType } from '../core/rate-limiter.js';
import { PolymarketError, ErrorCode } from '../core/errors.js';
import type {
  UnifiedMarket,
  MarketToken as UnifiedMarketToken,
  ProcessedOrderbook,
  EffectivePrices,
  ArbitrageOpportunity,
  KLineInterval,
  KLineCandle,
  DualKLineData,
  SpreadDataPoint,
  RealtimeSpreadAnalysis,
  Side,
  Orderbook,
} from '../core/types.js';

// CLOB Host
const CLOB_HOST = 'https://clob.polymarket.com';

// Chain IDs
export const POLYGON_MAINNET = 137;

// ============================================================================
// Types
// ============================================================================

// Side and Orderbook are imported from core/types.ts
// Re-export for backward compatibility
export type { Side, Orderbook } from '../core/types.js';

export type PriceHistoryIntervalString = '1h' | '6h' | '1d' | '1w' | 'max';

export interface PriceHistoryParams {
  tokenId: string;
  interval?: PriceHistoryIntervalString;
  startTs?: number;
  endTs?: number;
  fidelity?: number;
}

export interface PricePoint {
  timestamp: number;
  price: number;
}

export interface MarketServiceConfig {
  /** Private key for CLOB client auth (optional, for authenticated endpoints) */
  privateKey?: string;
  /** Chain ID (default: Polygon mainnet 137) */
  chainId?: number;
}

// Internal type for CLOB market data
interface ClobMarket {
  condition_id: string;
  question_id?: string;
  market_slug: string;
  question: string;
  description?: string;
  tokens: Array<{
    token_id: string;
    outcome: string;
    price: number;
    winner?: boolean;
  }>;
  active: boolean;
  closed: boolean;
  accepting_orders: boolean;
  end_date_iso?: string | null;
  neg_risk?: boolean;
  minimum_order_size?: number;
  minimum_tick_size?: number;
  image?: string;
  icon?: string;
}

/**
 * CLOB Market type (from CLOB API)
 *
 * This represents the raw market data from the CLOB API.
 * For merged market data with volume/liquidity, use UnifiedMarket from core/types.ts.
 */
export interface Market {
  conditionId: string;
  questionId?: string;
  marketSlug: string;
  question: string;
  description?: string;
  tokens: MarketToken[];
  active: boolean;
  closed: boolean;
  acceptingOrders: boolean;
  endDateIso?: string | null;
  negRisk?: boolean;
  minimumOrderSize?: number;
  minimumTickSize?: number;
  image?: string;
  icon?: string;
}

/**
 * Token in a CLOB market
 * Same structure as MarketToken in core/types.ts
 */
export interface MarketToken {
  tokenId: string;
  outcome: string;
  price: number;
  winner?: boolean;
}

// ============================================================================
// MarketService Implementation
// ============================================================================

export class MarketService {
  private clobClient: ClobClient | null = null;
  private initialized = false;

  constructor(
    private gammaApi: GammaApiClient | undefined,
    private dataApi: DataApiClient | undefined,
    private rateLimiter: RateLimiter,
    private cache: UnifiedCache,
    private config?: MarketServiceConfig
  ) { }

  // ============================================================================
  // Initialization
  // ============================================================================

  private async ensureInitialized(): Promise<ClobClient> {
    if (!this.initialized || !this.clobClient) {
      const chainId = (this.config?.chainId || POLYGON_MAINNET) as Chain;

      if (this.config?.privateKey) {
        // 有私钥时走鉴权 client，兼容需要签名权限的扩展场景。
        const wallet = new Wallet(this.config.privateKey);
        this.clobClient = new ClobClient(CLOB_HOST, chainId, wallet);
      } else {
        // 纯行情读取可走匿名 client，减少密钥依赖与初始化复杂度。
        this.clobClient = new ClobClient(CLOB_HOST, chainId);
      }
      this.initialized = true;
    }
    return this.clobClient!;
  }

  // ============================================================================
  // CLOB Market Data Methods
  // ============================================================================

  /**
   * Get market from CLOB by condition ID
   */
  async getClobMarket(conditionId: string): Promise<Market> {
    const cacheKey = `clob:market:${conditionId}`;
    return this.cache.getOrSet(cacheKey, CACHE_TTL.MARKET_INFO, async () => {
      // 先走缓存再请求，降低热门市场页面重复打开时的 API 负载。
      const client = await this.ensureInitialized();

      let attempt = 0;
      while (true) {
        try {
          return await this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            const market = await client.getMarket(conditionId);
            return this.normalizeClobMarket(market as ClobMarket);
          });
        } catch (err: any) {
          // Retry on Network Error (up to 3 times)
          // 只对网络抖动错误重试，业务错误直接抛出给上层处理。
          const isNetworkError = err?.message?.includes('Network Error') || err?.message?.includes('ECONNRESET') || err?.code === 'ECONNRESET';
          if (attempt < 3 && isNetworkError) {
            attempt++;
            console.warn(`[CLOB] Network Error fetching market ${conditionId}. Retrying (${attempt}/3)...`);
            await new Promise(r => setTimeout(r, 500 * attempt));
            continue;
          }
          throw err;
        }
      }
    });
  }

  /**
   * Get multiple markets from CLOB
   */
  async getClobMarkets(nextCursor?: string): Promise<{ markets: Market[]; nextCursor: string }> {
    const client = await this.ensureInitialized();
    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      const result = await client.getMarkets(nextCursor);
      return {
        markets: (result.data as ClobMarket[]).map(m => this.normalizeClobMarket(m)),
        nextCursor: result.next_cursor,
      };
    });
  }

  /**
   * Get orderbook for a single token
   */
  async getTokenOrderbook(tokenId: string): Promise<Orderbook> {
    const client = await this.ensureInitialized();
    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      const book = await client.getOrderBook(tokenId) as OrderBookSummary;

      if (!book) {
        throw new Error(`[MarketService] getOrderBook returned null for ${tokenId}`);
      }

      const bids = (book.bids || [])
        .map((l: { price: string; size: string }) => ({
          price: parseFloat(l.price),
          size: parseFloat(l.size),
        }))
        .sort((a, b) => b.price - a.price);

      const asks = (book.asks || [])
        .map((l: { price: string; size: string }) => ({
          price: parseFloat(l.price),
          size: parseFloat(l.size),
        }))
        .sort((a, b) => a.price - b.price);

      return {
        tokenId: book.asset_id,
        assetId: book.asset_id, // Backward compatibility
        bids,
        asks,
        timestamp: parseInt(book.timestamp || '0', 10) || Date.now(),
        market: book.market,
        hash: book.hash,
      };
    });
  }

  /**
   * Get orderbooks for multiple tokens
   */
  async getTokenOrderbooks(
    params: Array<{ tokenId: string; side: Side }>
  ): Promise<Map<string, Orderbook>> {
    const client = await this.ensureInitialized();
    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      const bookParams = params.map(p => ({
        token_id: p.tokenId,
        // Side 语义统一映射到 clob-client 枚举，避免上层枚举耦合。
        side: p.side === 'BUY' ? ClobSide.BUY : ClobSide.SELL,
      }));
      const books = await client.getOrderBooks(bookParams);
      const result = new Map<string, Orderbook>();

      if (!books || !Array.isArray(books)) {
        console.warn(`[MarketService] getOrderBooks returned invalid data: ${typeof books}`);
        return result;
      }

      for (const book of books) {
        const bids = (book.bids || [])
          .map((l: { price: string; size: string }) => ({
            price: parseFloat(l.price),
            size: parseFloat(l.size),
          }))
          .sort((a, b) => b.price - a.price);

        const asks = (book.asks || [])
          .map((l: { price: string; size: string }) => ({
            price: parseFloat(l.price),
            size: parseFloat(l.size),
          }))
          .sort((a, b) => a.price - b.price);

        result.set(book.asset_id, {
          tokenId: book.asset_id,
          assetId: book.asset_id, // Backward compatibility
          bids,
          asks,
          timestamp: parseInt(book.timestamp || '0', 10) || Date.now(),
          market: book.market,
          hash: book.hash,
        });
      }

      return result;
    });
  }

  /**
   * Get processed orderbook with arbitrage analysis for a market
   */
  async getProcessedOrderbook(conditionId: string): Promise<ProcessedOrderbook> {
    // 交易可执行性以 CLOB 为准：这里直接从 CLOB 拿 token 与盘口，
    // 避免 Gamma 元数据延迟导致的价格/流动性偏差。
    const market = await this.getClobMarket(conditionId);
    let yesToken = market.tokens.find(t => t.outcome === 'Yes');
    let noToken = market.tokens.find(t => t.outcome === 'No');

    // 兼容非标准二元市场（例如 outcome 命名不是 Yes/No）：
    // 当无法按 outcome 定位时，退化为前两个 token。
    if ((!yesToken || !noToken) && market.tokens.length >= 2) {
      yesToken = market.tokens[0];
      noToken = market.tokens[1];
    }

    if (!yesToken || !noToken) {
      throw new PolymarketError(ErrorCode.INVALID_RESPONSE, 'Missing tokens in market');
    }

    const [yesBook, noBook] = await Promise.all([
      this.getTokenOrderbook(yesToken.tokenId),
      this.getTokenOrderbook(noToken.tokenId),
    ]);

    return this.processOrderbooks(yesBook, noBook, yesToken.tokenId, noToken.tokenId);
  }

  /**
   * Get price history for a token
   */
  async getPricesHistory(params: PriceHistoryParams): Promise<PricePoint[]> {
    const client = await this.ensureInitialized();
    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      const intervalMap: Record<PriceHistoryIntervalString, PriceHistoryInterval> = {
        '1h': PriceHistoryInterval.ONE_HOUR,
        '6h': PriceHistoryInterval.SIX_HOURS,
        '1d': PriceHistoryInterval.ONE_DAY,
        '1w': PriceHistoryInterval.ONE_WEEK,
        'max': PriceHistoryInterval.MAX,
      };

      const history = await client.getPricesHistory({
        market: params.tokenId,
        interval: params.interval ? intervalMap[params.interval] : undefined,
        startTs: params.startTs,
        endTs: params.endTs,
        fidelity: params.fidelity,
      });

      const historyArray = Array.isArray(history)
        ? history
        : (history as { history?: Array<{ t: number; p: number }> })?.history || [];

      // 兼容不同 SDK/接口返回结构（数组或 {history: []}）。
      return historyArray.map((pt: { t: number; p: number }) => ({
        timestamp: pt.t,
        price: pt.p,
      }));
    });
  }

  /**
   * Get midpoint price for a token
   */
  async getMidpoint(tokenId: string): Promise<number> {
    const client = await this.ensureInitialized();
    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      const midpoint = await client.getMidpoint(tokenId);
      return Number(midpoint);
    });
  }

  /**
   * Get spread for a token
   */
  async getSpread(tokenId: string): Promise<number> {
    const client = await this.ensureInitialized();
    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      const spread = await client.getSpread(tokenId);
      return Number(spread);
    });
  }

  /**
   * Get last trade price for a token
   */
  async getLastTradePrice(tokenId: string): Promise<number> {
    const client = await this.ensureInitialized();
    return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
      const price = await client.getLastTradePrice(tokenId);
      return Number(price);
    });
  }

  // ============================================================================
  // Unified Market Access
  // ============================================================================

  /**
   * Get market by slug or condition ID
   */
  async getMarket(identifier: string): Promise<UnifiedMarket> {
    // conditionId 可能是 0x... 或纯数字字符串，两者都走条件 ID 分支。
    const isConditionId = identifier.startsWith('0x') || /^\d+$/.test(identifier);

    if (isConditionId) {
      return this.getMarketByConditionId(identifier);
    } else {
      return this.getMarketBySlug(identifier);
    }
  }

  private async getMarketBySlug(slug: string): Promise<UnifiedMarket> {
    if (!this.gammaApi) {
      throw new PolymarketError(ErrorCode.INVALID_CONFIG, 'GammaApiClient is required for slug-based lookups');
    }
    const gammaMarket = await this.gammaApi.getMarketBySlug(slug);
    if (!gammaMarket) {
      throw new PolymarketError(ErrorCode.MARKET_NOT_FOUND, `Market not found: ${slug}`);
    }

    try {
      const clobMarket = await this.getClobMarket(gammaMarket.conditionId);
      return this.mergeMarkets(gammaMarket, clobMarket);
    } catch {
      return this.fromGammaMarket(gammaMarket);
    }
  }

  private async getMarketByConditionId(conditionId: string): Promise<UnifiedMarket> {
    // 融合策略：
    // - CLOB：交易权威源（token、盘口、可交易状态）
    // - Gamma：展示权威源（slug、描述、统计指标）
    // 两者都成功时优先 merge；失败时按可用源降级。
    let clobMarket: Market | null = null;
    let gammaMarket: GammaMarket | null = null;

    // Try CLOB first (authoritative for trading data)
    try {
      clobMarket = await this.getClobMarket(conditionId);
    } catch {
      // CLOB failed, continue to try Gamma
    }

    // Always try Gamma for accurate slug and metadata (if available)
    if (this.gammaApi) {
      try {
        gammaMarket = await this.gammaApi.getMarketByConditionId(conditionId);
      } catch {
        // Gamma failed
      }
    }

    // Merge if both available (preferred)
    if (gammaMarket && clobMarket) {
      return this.mergeMarkets(gammaMarket, clobMarket);
    }

    // Gamma only - still useful for metadata
    if (gammaMarket) {
      return this.fromGammaMarket(gammaMarket);
    }

    // 仅 CLOB 可用时，slug 可能过期（历史重命名场景），做一次保守修正。
    if (clobMarket) {
      const market = this.fromClobMarket(clobMarket);
      // Check if slug looks stale (doesn't match question keywords)
      const questionWords = clobMarket.question.toLowerCase().split(/\s+/).slice(0, 3);
      const slugWords = clobMarket.marketSlug.toLowerCase().split('-');
      const hasMatchingWord = questionWords.some(qw =>
        slugWords.some(sw => sw.includes(qw) || qw.includes(sw))
      );
      if (!hasMatchingWord && clobMarket.marketSlug.length > 0) {
        // Slug appears stale, use conditionId as fallback identifier
        market.slug = `market-${conditionId.slice(0, 10)}`;
      }
      return market;
    }

    throw new PolymarketError(ErrorCode.MARKET_NOT_FOUND, `Market not found: ${conditionId}`);
  }

  // ===== K-Line Aggregation =====

  /**
   * Get K-Line candles for a market (single token)
   */
  async getKLines(
    conditionId: string,
    interval: KLineInterval,
    options?: { limit?: number; tokenId?: string; outcomeIndex?: number }
  ): Promise<KLineCandle[]> {
    if (!this.dataApi) {
      throw new PolymarketError(ErrorCode.INVALID_CONFIG, 'DataApiClient is required for K-Line data');
    }
    const trades = await this.dataApi.getTradesByMarket(conditionId, options?.limit || 1000);

    // 可按 tokenId/outcomeIndex 筛分，支持多结果市场的单 outcome 分析。
    let filteredTrades = trades;
    if (options?.tokenId) {
      filteredTrades = trades.filter((t) => t.asset === options.tokenId);
    } else if (options?.outcomeIndex !== undefined) {
      filteredTrades = trades.filter((t) => t.outcomeIndex === options.outcomeIndex);
    }

    return this.aggregateToKLines(filteredTrades, interval);
  }

  /**
   * Get dual K-Lines (YES + NO tokens)
   */
  async getDualKLines(
    conditionId: string,
    interval: KLineInterval,
    options?: { limit?: number }
  ): Promise<DualKLineData> {
    if (!this.dataApi) {
      throw new PolymarketError(ErrorCode.INVALID_CONFIG, 'DataApiClient is required for K-Line data');
    }
    const market = await this.getMarket(conditionId);
    const trades = await this.dataApi.getTradesByMarket(conditionId, options?.limit || 1000);

    // Separate trades by outcome
    const yesTrades = trades.filter((t) => t.outcomeIndex === 0 || t.outcome === 'Yes');
    const noTrades = trades.filter((t) => t.outcomeIndex === 1 || t.outcome === 'No');

    const yesCandles = this.aggregateToKLines(yesTrades, interval);
    const noCandles = this.aggregateToKLines(noTrades, interval);

    // Get current orderbook for real-time spread analysis
    let currentOrderbook: ProcessedOrderbook | undefined;
    let realtimeSpread: RealtimeSpreadAnalysis | undefined;
    try {
      currentOrderbook = await this.getProcessedOrderbook(conditionId);
      realtimeSpread = this.calculateRealtimeSpread(currentOrderbook);
    } catch {
      // Orderbook not available
    }

    // Calculate historical spread from trade close prices (for backtesting)
    const spreadAnalysis = this.analyzeHistoricalSpread(yesCandles, noCandles);

    return {
      conditionId,
      interval,
      market,
      yes: yesCandles,
      no: noCandles,
      spreadAnalysis,      // Historical (trade-based)
      realtimeSpread,      // Real-time (orderbook-based)
      currentOrderbook,
    };
  }

  /**
   * Aggregate trades into K-Line candles
   */
  private aggregateToKLines(trades: Trade[], interval: KLineInterval): KLineCandle[] {
    const intervalMs = getIntervalMs(interval);
    const buckets = new Map<number, Trade[]>();

    // Group trades into time buckets
    for (const trade of trades) {
      const bucketTime = Math.floor(trade.timestamp / intervalMs) * intervalMs;
      const bucket = buckets.get(bucketTime) || [];
      bucket.push(trade);
      buckets.set(bucketTime, bucket);
    }

    // Convert buckets to candles
    const candles: KLineCandle[] = [];
    for (const [timestamp, bucketTrades] of buckets) {
      if (bucketTrades.length === 0) continue;

      // Sort by timestamp for correct open/close
      bucketTrades.sort((a, b) => a.timestamp - b.timestamp);

      const prices = bucketTrades.map((t) => t.price);
      const buyTrades = bucketTrades.filter((t) => t.side === 'BUY');
      const sellTrades = bucketTrades.filter((t) => t.side === 'SELL');

      candles.push({
        timestamp,
        open: bucketTrades[0].price,
        high: Math.max(...prices),
        low: Math.min(...prices),
        close: bucketTrades[bucketTrades.length - 1].price,
        volume: bucketTrades.reduce((sum, t) => sum + t.size * t.price, 0),
        tradeCount: bucketTrades.length,
        buyVolume: buyTrades.reduce((sum, t) => sum + t.size * t.price, 0),
        sellVolume: sellTrades.reduce((sum, t) => sum + t.size * t.price, 0),
      });
    }

    return candles.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Analyze historical spread from trade close prices (for backtesting)
   *
   * This uses trade close prices, not orderbook bid/ask.
   * Useful for:
   * - Historical analysis / backtesting
   * - Understanding past price movements
   * - Identifying patterns when orderbook data unavailable
   */
  private analyzeHistoricalSpread(
    yesCandles: KLineCandle[],
    noCandles: KLineCandle[]
  ): SpreadDataPoint[] {
    const yesMap = new Map(yesCandles.map((c) => [c.timestamp, c]));
    const noMap = new Map(noCandles.map((c) => [c.timestamp, c]));

    const allTimestamps = [...new Set([...yesMap.keys(), ...noMap.keys()])].sort();

    let lastYes = 0.5;
    let lastNo = 0.5;
    const analysis: SpreadDataPoint[] = [];

    for (const ts of allTimestamps) {
      const yesCandle = yesMap.get(ts);
      const noCandle = noMap.get(ts);

      // 某一侧缺 candle 时沿用上一个 close，保证双边时间轴可连续对齐。
      if (yesCandle) lastYes = yesCandle.close;
      if (noCandle) lastNo = noCandle.close;

      const priceSum = lastYes + lastNo;
      const priceSpread = priceSum - 1;

      // 历史信号仅基于成交价偏离（indicative），不代表可即时成交套利。
      // 实际执行仍需结合盘口深度与滑点（见 calculateRealtimeSpread/processOrderbooks）。
      let arbOpportunity: 'LONG' | 'SHORT' | '' = '';
      if (priceSpread < -0.005) arbOpportunity = 'LONG';   // Sum < 0.995
      else if (priceSpread > 0.005) arbOpportunity = 'SHORT'; // Sum > 1.005

      analysis.push({
        timestamp: ts,
        yesPrice: lastYes,
        noPrice: lastNo,
        priceSum,
        priceSpread,
        arbOpportunity,
      });
    }

    return analysis;
  }

  /**
   * Calculate real-time spread from orderbook (for live trading)
   *
   * This uses orderbook bid/ask prices for accurate arbitrage detection.
   * Useful for:
   * - Real-time arbitrage execution
   * - Live trading decisions
   * - Accurate profit calculations
   */
  private calculateRealtimeSpread(orderbook: ProcessedOrderbook): RealtimeSpreadAnalysis {
    const { yes, no, summary } = orderbook;

    // 实时机会判定直接使用 processOrderbooks 产出的可执行收益口径。
    let arbOpportunity: 'LONG' | 'SHORT' | '' = '';
    let arbProfitPercent = 0;

    if (summary.longArbProfit > 0.001) {  // > 0.1% threshold
      arbOpportunity = 'LONG';
      arbProfitPercent = summary.longArbProfit * 100;
    } else if (summary.shortArbProfit > 0.001) {  // > 0.1% threshold
      arbOpportunity = 'SHORT';
      arbProfitPercent = summary.shortArbProfit * 100;
    }

    return {
      timestamp: Date.now(),
      // 盘口快照（可用于执行前风控）
      yesBid: yes.bid,
      yesAsk: yes.ask,
      noBid: no.bid,
      noAsk: no.ask,
      // spread 指标（YES+NO 相对 1 的偏离）
      askSum: summary.askSum,
      bidSum: summary.bidSum,
      askSpread: summary.askSum - 1,
      bidSpread: summary.bidSum - 1,
      // 套利指标（已考虑镜像路径）
      longArbProfit: summary.longArbProfit,
      shortArbProfit: summary.shortArbProfit,
      arbOpportunity,
      arbProfitPercent,
    };
  }

  /**
   * Get real-time spread analysis only (without K-lines)
   * Use this for quick arbitrage checks
   */
  async getRealtimeSpread(conditionId: string): Promise<RealtimeSpreadAnalysis> {
    const orderbook = await this.getProcessedOrderbook(conditionId);
    return this.calculateRealtimeSpread(orderbook);
  }

  // ===== Orderbook Analysis =====

  /**
   * Get processed orderbook with analytics (alias for getProcessedOrderbook)
   */
  async getOrderbook(conditionId: string): Promise<ProcessedOrderbook> {
    return this.getProcessedOrderbook(conditionId);
  }

  /**
   * Detect arbitrage opportunity
   *
   * 使用有效价格（考虑镜像订单）计算套利机会
   * 详细原理见: docs/01-polymarket-orderbook-arbitrage.md
   */
  async detectArbitrage(conditionId: string, threshold = 0.005): Promise<ArbitrageOpportunity | null> {
    const orderbook = await this.getOrderbook(conditionId);
    const { effectivePrices } = orderbook.summary;

    if (orderbook.summary.longArbProfit > threshold) {
      return {
        type: 'long',
        profit: orderbook.summary.longArbProfit,
        // 使用有效价格描述实际操作
        action: `Buy YES @ ${effectivePrices.effectiveBuyYes.toFixed(4)} + NO @ ${effectivePrices.effectiveBuyNo.toFixed(4)}, Merge for $1`,
        expectedProfit: orderbook.summary.longArbProfit,
      };
    }

    if (orderbook.summary.shortArbProfit > threshold) {
      return {
        type: 'short',
        profit: orderbook.summary.shortArbProfit,
        // 使用有效价格描述实际操作
        action: `Split $1, Sell YES @ ${effectivePrices.effectiveSellYes.toFixed(4)} + NO @ ${effectivePrices.effectiveSellNo.toFixed(4)}`,
        expectedProfit: orderbook.summary.shortArbProfit,
      };
    }

    return null;
  }

  // ===== Market Discovery =====

  /**
   * Get trending markets
   */
  async getTrendingMarkets(limit = 20): Promise<GammaMarket[]> {
    if (!this.gammaApi) {
      throw new PolymarketError(ErrorCode.INVALID_CONFIG, 'GammaApiClient is required for trending markets');
    }
    return this.gammaApi.getTrendingMarkets(limit);
  }

  /**
   * Search markets
   */
  async searchMarkets(params: {
    active?: boolean;
    closed?: boolean;
    limit?: number;
    offset?: number;
    order?: string;
  }): Promise<GammaMarket[]> {
    if (!this.gammaApi) {
      throw new PolymarketError(ErrorCode.INVALID_CONFIG, 'GammaApiClient is required for market search');
    }
    return this.gammaApi.getMarkets(params);
  }

  // ===== Market Signal Detection =====

  /**
   * Detect market signals (volume surge, depth imbalance, whale trades)
   */
  async detectMarketSignals(conditionId: string): Promise<
    Array<{
      type: 'volume_surge' | 'depth_imbalance' | 'whale_trade' | 'momentum';
      severity: 'low' | 'medium' | 'high';
      details: Record<string, unknown>;
    }>
  > {
    const signals: Array<{
      type: 'volume_surge' | 'depth_imbalance' | 'whale_trade' | 'momentum';
      severity: 'low' | 'medium' | 'high';
      details: Record<string, unknown>;
    }> = [];

    if (!this.dataApi) {
      throw new PolymarketError(ErrorCode.INVALID_CONFIG, 'DataApiClient is required for signal detection');
    }
    // 组合信号来源：
    // - market: 宏观量能指标
    // - orderbook: 即时深度结构
    // - trades: 最近成交行为
    const market = await this.getMarket(conditionId);
    const orderbook = await this.getOrderbook(conditionId);
    const trades = await this.dataApi.getTradesByMarket(conditionId, 100);

    // Volume surge：24h 交易量相对历史均值突增（market.volume 近似按 7 天均值拆分）。
    if (market.volume24hr && market.volume > 0) {
      const avgDaily = market.volume / 7; // Approximate
      const ratio = market.volume24hr / avgDaily;
      if (ratio > 2) {
        signals.push({
          type: 'volume_surge',
          severity: ratio > 5 ? 'high' : ratio > 3 ? 'medium' : 'low',
          details: { volume24hr: market.volume24hr, avgDaily, ratio },
        });
      }
    }

    // Depth imbalance：盘口买卖深度明显失衡，常用于判断短时买压/卖压。
    if (orderbook.summary.imbalanceRatio > 1.5 || orderbook.summary.imbalanceRatio < 0.67) {
      const ratio = orderbook.summary.imbalanceRatio;
      signals.push({
        type: 'depth_imbalance',
        severity: ratio > 3 || ratio < 0.33 ? 'high' : 'medium',
        details: {
          imbalanceRatio: ratio,
          bidDepth: orderbook.summary.totalBidDepth,
          askDepth: orderbook.summary.totalAskDepth,
          direction: ratio > 1 ? 'BUY_PRESSURE' : 'SELL_PRESSURE',
        },
      });
    }

    // Whale trade：大额成交提示潜在信息流或流动性冲击（仅取最近 3 条避免信号泛滥）。
    const recentLargeTrades = trades.filter((t) => t.size * t.price > 1000);
    for (const trade of recentLargeTrades.slice(0, 3)) {
      const value = trade.size * trade.price;
      signals.push({
        type: 'whale_trade',
        severity: value > 10000 ? 'high' : value > 5000 ? 'medium' : 'low',
        details: {
          size: trade.size,
          price: trade.price,
          usdValue: value,
          side: trade.side,
          outcome: trade.outcome,
        },
      });
    }

    return signals;
  }

  // ===== Helper Methods =====

  private normalizeClobMarket(m: ClobMarket): Market {
    // 统一命名风格：把 CLOB snake_case 映射为 SDK camelCase 输出。
    return {
      conditionId: m.condition_id,
      questionId: m.question_id,
      marketSlug: m.market_slug,
      question: m.question,
      description: m.description,
      tokens: (m.tokens || []).map(t => ({
        tokenId: t.token_id,
        outcome: t.outcome,
        price: t.price,
        winner: t.winner,
      })),
      active: m.active,
      closed: m.closed,
      acceptingOrders: m.accepting_orders,
      endDateIso: m.end_date_iso,
      negRisk: m.neg_risk,
      minimumOrderSize: m.minimum_order_size,
      minimumTickSize: m.minimum_tick_size,
      image: m.image,
      icon: m.icon,
    };
  }

  private processOrderbooks(
    yesBook: Orderbook,
    noBook: Orderbook,
    yesTokenId?: string,
    noTokenId?: string
  ): ProcessedOrderbook {
    const yesBestBid = yesBook.bids[0]?.price || 0;
    const yesBestAsk = yesBook.asks[0]?.price || 1;
    const noBestBid = noBook.bids[0]?.price || 0;
    const noBestAsk = noBook.asks[0]?.price || 1;

    const yesBidDepth = yesBook.bids.reduce((sum, l) => sum + l.price * l.size, 0);
    const yesAskDepth = yesBook.asks.reduce((sum, l) => sum + l.price * l.size, 0);
    const noBidDepth = noBook.bids.reduce((sum, l) => sum + l.price * l.size, 0);
    const noAskDepth = noBook.asks.reduce((sum, l) => sum + l.price * l.size, 0);

    const askSum = yesBestAsk + noBestAsk;
    const bidSum = yesBestBid + noBestBid;

    // 有效价格（考虑镜像订单）：
    // Polymarket 二元盘存在镜像关系：
    // - 买 YES @ p 等价于卖 NO @ (1-p)
    // - 买 NO  @ p 等价于卖 YES @ (1-p)
    // 因此真实可执行成本/收入应取两条路径中的最优值。
    const effectivePrices: EffectivePrices = {
      effectiveBuyYes: Math.min(yesBestAsk, 1 - noBestBid),
      effectiveBuyNo: Math.min(noBestAsk, 1 - yesBestBid),
      effectiveSellYes: Math.max(yesBestBid, 1 - noBestAsk),
      effectiveSellNo: Math.max(noBestBid, 1 - yesBestAsk),
    };

    // 套利解释：
    // - longArbProfit > 0: 买入 YES+NO 成本 < 1，可合并兑付 $1 获利
    // - shortArbProfit > 0: 拆分 $1 后卖出 YES+NO 收入 > 1，可反向套利
    const effectiveLongCost = effectivePrices.effectiveBuyYes + effectivePrices.effectiveBuyNo;
    const effectiveShortRevenue = effectivePrices.effectiveSellYes + effectivePrices.effectiveSellNo;

    const longArbProfit = 1 - effectiveLongCost;
    const shortArbProfit = effectiveShortRevenue - 1;

    const yesSpread = yesBestAsk - yesBestBid;

    return {
      yes: {
        bid: yesBestBid,
        ask: yesBestAsk,
        bidSize: yesBook.bids[0]?.size || 0,
        askSize: yesBook.asks[0]?.size || 0,
        bidDepth: yesBidDepth,
        askDepth: yesAskDepth,
        spread: yesSpread,
        tokenId: yesTokenId,
      },
      no: {
        bid: noBestBid,
        ask: noBestAsk,
        bidSize: noBook.bids[0]?.size || 0,
        askSize: noBook.asks[0]?.size || 0,
        bidDepth: noBidDepth,
        askDepth: noAskDepth,
        spread: noBestAsk - noBestBid,
        tokenId: noTokenId,
      },
      summary: {
        askSum,
        bidSum,
        effectivePrices,
        effectiveLongCost,
        effectiveShortRevenue,
        longArbProfit,
        shortArbProfit,
        totalBidDepth: yesBidDepth + noBidDepth,
        totalAskDepth: yesAskDepth + noAskDepth,
        imbalanceRatio: (yesBidDepth + noBidDepth) / (yesAskDepth + noAskDepth + 0.001),
        yesSpread,
      },
    };
  }

  private mergeMarkets(gamma: GammaMarket, clob: Market): UnifiedMarket {
    // tokenId 必须以 CLOB 为准，价格优先用 CLOB；
    // 当 CLOB 价格为空时回退到 Gamma，保证 UI/API 不出现空价格。
    const tokens: UnifiedMarketToken[] = clob.tokens.map((t, index) => ({
      tokenId: t.tokenId,
      outcome: t.outcome,
      price: t.price || gamma.outcomePrices[index] || 0.5,
      winner: t.winner,
    }));

    return {
      conditionId: clob.conditionId,
      slug: gamma.slug,
      question: clob.question,
      description: clob.description || gamma.description,
      tokens,
      volume: gamma.volume,
      volume24hr: gamma.volume24hr,
      liquidity: gamma.liquidity,
      spread: gamma.spread,
      oneDayPriceChange: gamma.oneDayPriceChange,
      oneWeekPriceChange: gamma.oneWeekPriceChange,
      active: clob.active,
      closed: clob.closed,
      acceptingOrders: clob.acceptingOrders,
      endDate: clob.endDateIso ? new Date(clob.endDateIso) : new Date(),
      source: 'merged',
    };
  }

  private fromGammaMarket(gamma: GammaMarket): UnifiedMarket {
    // Gamma 回退路径下 tokenId 不可用（置空），仅保证展示层可读性。
    const tokens: UnifiedMarketToken[] = [
      { tokenId: '', outcome: 'Yes', price: gamma.outcomePrices[0] || 0.5 },
      { tokenId: '', outcome: 'No', price: gamma.outcomePrices[1] || 0.5 },
    ];

    return {
      conditionId: gamma.conditionId,
      slug: gamma.slug,
      question: gamma.question,
      description: gamma.description,
      tokens,
      volume: gamma.volume,
      volume24hr: gamma.volume24hr,
      liquidity: gamma.liquidity,
      spread: gamma.spread,
      oneDayPriceChange: gamma.oneDayPriceChange,
      oneWeekPriceChange: gamma.oneWeekPriceChange,
      active: gamma.active,
      closed: gamma.closed,
      acceptingOrders: !gamma.closed,
      endDate: gamma.endDate,
      source: 'gamma',
    };
  }

  private fromClobMarket(clob: Market): UnifiedMarket {
    // 仅 CLOB 路径缺少 volume/liquidity 等统计字段，填默认值以维持类型完整。
    const tokens: UnifiedMarketToken[] = clob.tokens.map(t => ({
      tokenId: t.tokenId,
      outcome: t.outcome,
      price: t.price,
      winner: t.winner,
    }));

    return {
      conditionId: clob.conditionId,
      slug: clob.marketSlug,
      question: clob.question,
      description: clob.description,
      tokens,
      volume: 0,
      volume24hr: undefined,
      liquidity: 0,
      spread: undefined,
      active: clob.active,
      closed: clob.closed,
      acceptingOrders: clob.acceptingOrders,
      endDate: clob.endDateIso ? new Date(clob.endDateIso) : new Date(),
      source: 'clob',
    };
  }
}

// ===== Utility Functions =====

export function getIntervalMs(interval: KLineInterval): number {
  // 统一 K 线周期到毫秒，供聚合桶切分与对齐。
  const map: Record<KLineInterval, number> = {
    '30s': 30 * 1000,
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  };
  return map[interval];
}
