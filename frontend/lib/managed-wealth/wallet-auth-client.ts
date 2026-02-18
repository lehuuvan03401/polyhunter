'use client';

import { useCallback } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { buildManagedWalletAuthMessage } from '@/lib/managed-wealth/wallet-auth-message';

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

        return headers;
    }, [wallets]);

    return {
        createWalletAuthHeaders,
    };
}
