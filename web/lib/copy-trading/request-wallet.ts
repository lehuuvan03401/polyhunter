import { NextRequest } from 'next/server';
import { resolveWalletContext } from '@/lib/managed-wealth/request-wallet';
import {
    isCopyTradingSignatureRequired,
} from '@/lib/copy-trading/runtime-config';

type ResolveCopyTradingWalletOptions = {
    queryWallet?: string | null;
    bodyWallet?: string | null;
    requireHeader?: boolean;
};

function shouldRequireSignature(): boolean {
    return isCopyTradingSignatureRequired();
}

export function resolveCopyTradingWalletContext(
    request: NextRequest,
    options: ResolveCopyTradingWalletOptions = {}
) {
    return resolveWalletContext(request, {
        queryWallet: options.queryWallet,
        bodyWallet: options.bodyWallet,
        requireHeader: options.requireHeader ?? false,
        requireSignature: shouldRequireSignature(),
        allowSessionAuth: true,
    });
}

export function resolveCopyTradingWriteWalletContext(
    request: NextRequest,
    options: Omit<ResolveCopyTradingWalletOptions, 'requireHeader'> = {}
) {
    return resolveWalletContext(request, {
        queryWallet: options.queryWallet,
        bodyWallet: options.bodyWallet,
        requireHeader: true,
        requireSignature: shouldRequireSignature(),
        allowSessionAuth: false,
    });
}

export function getWalletAuthHeaders(walletAddress: string) {
    return {
        'x-wallet-address': walletAddress.toLowerCase(),
    };
}
