import { MarketService } from './market-service.js';
import { UnifiedCache } from '../core/unified-cache.js';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

export interface TokenMetadata {
    marketSlug: string;
    conditionId: string;
    outcome: string;
    endDate?: string;
    volume?: number;
}

export class TokenMetadataService {
    private marketService: MarketService;
    private cache: UnifiedCache;
    private isPrewarming: boolean = false;
    private memoryMap: Map<string, TokenMetadata> = new Map();
    // Negative cache: tokens that failed to fetch are blocked from retrying for NEGATIVE_CACHE_TTL_MS
    private failedFetchMap: Map<string, number> = new Map();
    private static readonly NEGATIVE_CACHE_TTL_MS = 30_000; // 30 seconds
    // In-flight deduplication: avoid parallel duplicate fetches for the same tokenId
    private inflight: Map<string, Promise<TokenMetadata | null>> = new Map();

    constructor(marketService: MarketService, cache: UnifiedCache) {
        this.marketService = marketService;
        this.cache = cache;
    }

    /**
     * Pre-warms the cache by fetching all currently active markets from Polymarket
     * and mapping their `tokenId`s to basic metadata (slug, conditionId, outcome).
     * 
     * This fully decouples the execution loop from needing to perform synchronous
     * API calls during real-time event processing.
     */
    async prewarmCache(): Promise<void> {
        if (this.isPrewarming) {
            console.log(`[TokenMetadata] Pre-warm already in progress...`);
            return;
        }

        this.isPrewarming = true;
        console.log(`\n⏳ [TokenMetadata] Starting background pre-warm of active markets...`);
        const startTime = Date.now();
        let tokenCount = 0;
        let offset = 0;

        try {
            while (true) {
                // Fetch active markets per chunk from Gamma API directly to preserve raw JSON (tokens and volume arrays)
                const url = `${GAMMA_API_BASE}/markets?active=true&closed=false&limit=1000&offset=${offset}`;
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Gamma API failed: ${response.status} ${response.statusText}`);
                }

                const markets: any[] = await response.json();
                if (!Array.isArray(markets) || markets.length === 0) break;

                for (const market of markets) {
                    if (!market.tokens || market.tokens.length === 0) continue;

                    for (const token of market.tokens) {
                        const tokenId = token.tokenId || token.token_id;
                        if (!tokenId) continue;

                        const meta: TokenMetadata = {
                            marketSlug: market.market_slug || market.slug || 'unknown-market',
                            conditionId: market.condition_id || market.conditionId || '',
                            outcome: token.outcome,
                            endDate: market.end_date_iso || market.endDate,
                            volume: Number(market.volume || market.volume24hr || 0)
                        };

                        // Store in fast memory map
                        this.memoryMap.set(tokenId, meta);

                        // Also store in Redis/Unified Cache for cross-process access
                        await this.cache.set(`token_meta:${tokenId}`, meta, 60 * 60 * 24); // 24 hours
                        tokenCount++;
                    }
                }

                offset += 1000;

                // Small sleep to not crush the Gamma API during pagination
                await new Promise(r => setTimeout(r, 200));
            }

            console.log(`✅ [TokenMetadata] Pre-warmed cache with ${tokenCount} tokens in ${((Date.now() - startTime) / 1000).toFixed(2)}s\n`);
        } catch (error) {
            console.error(`❌ [TokenMetadata] Pre-warm failed:`, error);
        } finally {
            this.isPrewarming = false;
        }
    }

    /**
     * Retrieves token metadata synchronously if available in memory.
     * If not in memory but in Redis, it fetches it (async).
     * If entirely missing (e.g., brand new market just created), it fetches from Gamma API.
     */
    async getMetadata(tokenId: string): Promise<TokenMetadata | null> {
        // 1. Fast Memory Check (0ms latency for 99% of trades)
        if (this.memoryMap.has(tokenId)) {
            return this.memoryMap.get(tokenId)!;
        }

        // 2. Negative cache: don't retry recently-failed fetches
        const failedAt = this.failedFetchMap.get(tokenId);
        if (failedAt && Date.now() - failedAt < TokenMetadataService.NEGATIVE_CACHE_TTL_MS) {
            return null; // Silent: we already logged the error when it first failed
        }

        // 3. In-flight deduplication: if already fetching, wait for that promise
        if (this.inflight.has(tokenId)) {
            return this.inflight.get(tokenId)!;
        }

        // 4. Redis/Unified Cache Check
        const cached = await this.cache.get<TokenMetadata>(`token_meta:${tokenId}`);
        if (cached) {
            this.memoryMap.set(tokenId, cached); // Hydrate local memory
            return cached;
        }

        // 5. Fallback to API (Only happens for a token created *between* prewarm intervals)
        console.log(`⚠️ [TokenMetadata] Cache miss for ${tokenId}, fetching dynamically...`);
        const fetchPromise = this._fetchMetadataFromApi(tokenId);
        this.inflight.set(tokenId, fetchPromise);
        try {
            return await fetchPromise;
        } finally {
            this.inflight.delete(tokenId);
        }
    }

    private async _fetchMetadataFromApi(tokenId: string): Promise<TokenMetadata | null> {
        try {
            // Check Gamma API first for rich metadata
            const url = `${GAMMA_API_BASE}/markets?condition_id=${tokenId}`; // Actually conditionId mapping is complex, check token_id or use orderbook

            // Get Condition ID from Orderbook (CLOB)
            const book: any = await this.marketService.getTokenOrderbook(tokenId);
            const conditionId = book.market;
            if (!conditionId) throw new Error("No market ID in orderbook");

            const gammaUrl = `${GAMMA_API_BASE}/markets?condition_id=${conditionId}`;
            const resp = await fetch(gammaUrl);
            let meta: TokenMetadata | null = null;

            if (resp.ok) {
                const data = await resp.json();
                let market: any = null;
                if (Array.isArray(data) && data.length > 0) market = data[0];
                else if (data.slug) market = data;

                if (market) {
                    const targetToken = (market.tokens || []).find((t: any) => (t.tokenId || t.token_id) === tokenId);
                    if (targetToken) {
                        meta = {
                            marketSlug: market.slug || market.market_slug || 'unknown-market',
                            conditionId: conditionId,
                            outcome: targetToken.outcome || 'Yes',
                            endDate: market.endDate || market.end_date_iso,
                            volume: Number(market.volume || market.volumeNum || 0)
                        };
                    }
                }
            }

            if (!meta) {
                // Fallback to CLOB Market details
                const market: any = await this.marketService.getClobMarket(conditionId);
                if (!market) return null;

                const targetToken = market.tokens?.find((t: any) => t.tokenId === tokenId);
                if (!targetToken) return null;

                meta = {
                    marketSlug: market.marketSlug || 'unknown-market',
                    conditionId: market.conditionId,
                    outcome: targetToken.outcome || 'Yes',
                    endDate: market.endDateIso || market.endDate,
                    volume: Number(market.volume || market.volume24hr || 0)
                };
            }

            if (!meta) return null; // If meta is still null after all attempts

            // Save for later
            this.memoryMap.set(tokenId, meta);
            await this.cache.set(`token_meta:${tokenId}`, meta, 60 * 60 * 24);

            return meta;
        } catch (error) {
            console.error(`❌ [TokenMetadata] Failed to fetch metadata for ${tokenId}:`, error);
            // Record failure in negative cache to prevent retry storms
            this.failedFetchMap.set(tokenId, Date.now());
            // Fallback for missing simulated markets
            if (tokenId.startsWith('mock-')) {
                return {
                    marketSlug: 'unknown-simulated',
                    conditionId: '0x0',
                    outcome: 'Yes'
                };
            }
            return null;
        }
    }

    /**
     * Allows replacing external calls synchronously if data is guaranteed
     * to be pre-warmed.
     */
    getMetadataSync(tokenId: string): TokenMetadata | null {
        return this.memoryMap.get(tokenId) || null;
    }
}
