import {
    PolymarketSDK,
    GammaApiClient,
    DataApiClient,
    RateLimiter,
    createUnifiedCache,
    type UnifiedCache,
} from '@catalyst-team/poly-sdk';

// Shared instances for server-side use
let rateLimiter: RateLimiter | null = null;
let cache: UnifiedCache | null = null;
let sdkInstance: PolymarketSDK | null = null;

// Initialize shared infrastructure
function getInfrastructure() {
    if (!rateLimiter) {
        rateLimiter = new RateLimiter();
    }
    if (!cache) {
        cache = createUnifiedCache();
    }
    return { rateLimiter, cache };
}

/**
 * Get SDK instance (full-featured, uses built-in services)
 * This is the recommended way to access all SDK functionality
 */
export function getReadOnlySDK(): PolymarketSDK {
    return new PolymarketSDK();
}

/**
 * Get SDK instance with trading capabilities
 * Requires POLYMARKET_PRIVATE_KEY environment variable
 */
export async function getSDK(): Promise<PolymarketSDK> {
    if (!sdkInstance) {
        const privateKey = process.env.POLYMARKET_PRIVATE_KEY;

        if (!privateKey) {
            throw new Error('POLYMARKET_PRIVATE_KEY not configured');
        }

        sdkInstance = await PolymarketSDK.create({
            privateKey,
            chainId: 137,
        });

        console.log('✅ SDK initialized with trading capabilities');
    }

    return sdkInstance;
}

/**
 * Get GammaApiClient for market listings
 * Uses SDK's GammaApiClient for Gamma Markets API
 */
export function getGammaClient(): GammaApiClient {
    const { rateLimiter, cache } = getInfrastructure();
    return new GammaApiClient(rateLimiter, cache);
}

/**
 * Get DataApiClient for data API
 * Uses SDK's DataApiClient for positions, trades, activity
 */
export function getDataApiClient(): DataApiClient {
    const { rateLimiter, cache } = getInfrastructure();
    return new DataApiClient(rateLimiter, cache);
}

/**
 * Clean up all SDK resources
 */
export function cleanup(): void {
    if (sdkInstance) {
        sdkInstance.stop();
        sdkInstance = null;
    }
    rateLimiter = null;
    cache = null;
    console.log('🛑 SDK resources cleaned up');
}

// Export types for convenience
export type { UnifiedCache };
