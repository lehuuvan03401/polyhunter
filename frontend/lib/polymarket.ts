import { PolymarketSDK } from '@catalyst-team/poly-sdk';

/**
 * Singleton instance of the Polymarket SDK for the frontend.
 * 
 * Note: This instance is read-only by default (no private key).
 * For trading operations, we would ideally prompt the user for a wallet connection
 * or a private key (stored locally/sessions), or proxy through a secure backend method.
 */
export const polyClient = new PolymarketSDK({
    // Add any public config here
    // cache: ...
});

// Initialize the SDK (connects WebSocket, etc. if needed)
// We might want to do this lazily or in a useEffect for client-side
if (typeof window !== 'undefined') {
    // Client-side initialization if needed
    // polyClient.start(); 
}

/**
 * Server-side helper to get SDK instance
 */
export async function getPolyServerClient() {
    const sdk = new PolymarketSDK({
        // Optional: Load private key from env for server-side operations if needed
        // privateKey: process.env.POLYMARKET_PRIVATE_KEY 
    });
    return sdk;
}
