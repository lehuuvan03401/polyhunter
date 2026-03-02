'use client';

import { useCallback } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { buildManagedWalletAuthMessage, buildManagedWalletSessionMessage, MANAGED_WALLET_AUTH_WINDOW_MS } from '@/lib/managed-wealth/wallet-auth-message';

type WalletAuthHeadersParams = {
    walletAddress: string;
    method: string;
    pathWithQuery: string;
};

function shouldSignManagedWealthRequests(): boolean {
    if (process.env.NEXT_PUBLIC_E2E_MOCK_AUTH === 'true') return false;
    if (process.env.NEXT_PUBLIC_MANAGED_WEALTH_SIGN_REQUESTS === 'false') return false;
    return true;
}

function normalizePathWithQuery(pathWithQuery: string): string {
    if (pathWithQuery.startsWith('http://') || pathWithQuery.startsWith('https://')) {
        const url = new URL(pathWithQuery);
        return `${url.pathname}${url.search}`;
    }
    return pathWithQuery;
}

// ── Session signature cache ──────────────────────────────────────────────
// Cache session signatures per wallet to avoid repeated MetaMask popups.
// Session signatures are path-agnostic and valid for the full auth window.
// We refresh at 80% of the window to avoid edge-case expiry during a request.

type CachedSession = {
    signature: string;
    timestamp: number;
};

const sessionCache = new Map<string, CachedSession>();

const SESSION_REFRESH_MS = MANAGED_WALLET_AUTH_WINDOW_MS * 0.8; // refresh at 80% of window (4 min)

function getCachedSession(walletAddress: string): CachedSession | null {
    const key = walletAddress.toLowerCase();
    const cached = sessionCache.get(key);
    if (!cached) return null;
    const age = Date.now() - cached.timestamp;
    if (age > SESSION_REFRESH_MS) {
        sessionCache.delete(key);
        return null;
    }
    return cached;
}

function setCachedSession(walletAddress: string, session: CachedSession): void {
    sessionCache.set(walletAddress.toLowerCase(), session);
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useManagedWalletAuth() {
    const { wallets } = useWallets();

    const createWalletAuthHeaders = useCallback(async (params: WalletAuthHeadersParams) => {
        const normalizedWallet = params.walletAddress.toLowerCase();
        const headers: Record<string, string> = {
            'x-wallet-address': normalizedWallet,
        };

        if (!shouldSignManagedWealthRequests()) {
            return headers;
        }

        const method = params.method.toUpperCase();
        const isReadOnly = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

        // ── For read-only requests: use cached session signature ──
        if (isReadOnly) {
            const cached = getCachedSession(normalizedWallet);
            if (cached) {
                headers['x-wallet-signature'] = cached.signature;
                headers['x-wallet-timestamp'] = String(cached.timestamp);
                headers['x-wallet-auth-type'] = 'session';
                return headers;
            }
        }

        // ── Resolve wallet provider ──
        const wallet = wallets.find(
            (candidate) => candidate.address?.toLowerCase() === normalizedWallet
        ) || wallets[0];

        if (!wallet) {
            throw new Error('Wallet not connected');
        }

        const provider = await wallet.getEthereumProvider();
        const { ethers } = await import('ethers');
        const web3Provider = new ethers.providers.Web3Provider(provider);
        const signer = web3Provider.getSigner();
        const timestamp = Date.now();

        if (isReadOnly) {
            // Sign a session (path-agnostic) message and cache it
            const message = buildManagedWalletSessionMessage({
                walletAddress: normalizedWallet,
                timestamp,
            });
            const signature = await signer.signMessage(message);

            setCachedSession(normalizedWallet, { signature, timestamp });

            headers['x-wallet-signature'] = signature;
            headers['x-wallet-timestamp'] = String(timestamp);
            headers['x-wallet-auth-type'] = 'session';
        } else {
            // For mutating requests: sign per-request with path for replay protection
            const pathWithQuery = normalizePathWithQuery(params.pathWithQuery);
            const message = buildManagedWalletAuthMessage({
                walletAddress: normalizedWallet,
                method: params.method,
                pathWithQuery,
                timestamp,
            });
            const signature = await signer.signMessage(message);

            headers['x-wallet-signature'] = signature;
            headers['x-wallet-timestamp'] = String(timestamp);
        }

        return headers;
    }, [wallets]);

    return {
        createWalletAuthHeaders,
    };
}
