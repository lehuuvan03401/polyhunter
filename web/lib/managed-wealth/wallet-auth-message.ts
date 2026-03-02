const MANAGED_WALLET_AUTH_PREFIX = 'Horus Managed Wealth Auth';
export const MANAGED_WALLET_AUTH_WINDOW_MS = 5 * 60 * 1000;

type ManagedWalletAuthMessageParams = {
    walletAddress: string;
    method: string;
    pathWithQuery: string;
    timestamp: number;
};

export function buildManagedWalletAuthMessage(params: ManagedWalletAuthMessageParams): string {
    return [
        MANAGED_WALLET_AUTH_PREFIX,
        `wallet:${params.walletAddress.toLowerCase()}`,
        `method:${params.method.toUpperCase()}`,
        `path:${params.pathWithQuery}`,
        `timestamp:${params.timestamp}`,
    ].join('\n');
}

type ManagedWalletSessionMessageParams = {
    walletAddress: string;
    timestamp: number;
};

/**
 * Build a path-agnostic session message for wallet ownership proof.
 * Used for GET requests to avoid repeated MetaMask signature prompts.
 */
export function buildManagedWalletSessionMessage(params: ManagedWalletSessionMessageParams): string {
    return [
        MANAGED_WALLET_AUTH_PREFIX,
        'type:session',
        `wallet:${params.walletAddress.toLowerCase()}`,
        `timestamp:${params.timestamp}`,
    ].join('\n');
}
