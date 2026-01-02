import { PolymarketSDK } from '@catalyst-team/poly-sdk';

let sdkInstance: PolymarketSDK | null = null;

/**
 * Get SDK instance (server-side only)
 * Requires POLYMARKET_PRIVATE_KEY environment variable
 */
export async function getSDK() {
    if (!sdkInstance) {
        const privateKey = process.env.POLYMARKET_PRIVATE_KEY;

        if (!privateKey) {
            throw new Error('POLYMARKET_PRIVATE_KEY not configured in environment variables');
        }

        try {
            sdkInstance = await PolymarketSDK.create({
                privateKey,
                chainId: 137, // Polygon Mainnet
            });

            console.log('✅ SDK initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize SDK:', error);
            throw error;
        }
    }

    return sdkInstance;
}

/**
 * Get read-only SDK instance (no private key needed)
 * Can be used for public data fetching
 */
export function getReadOnlySDK() {
    return new PolymarketSDK();
}

/**
 * Clean up SDK instance (call on server shutdown)
 */
export function cleanupSDK() {
    if (sdkInstance) {
        sdkInstance.stop();
        sdkInstance = null;
        console.log('🛑 SDK cleaned up');
    }
}
