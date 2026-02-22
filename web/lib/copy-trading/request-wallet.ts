import { NextRequest } from 'next/server';
import { resolveWalletContext } from '@/lib/managed-wealth/request-wallet';

type ResolveCopyTradingWalletOptions = {
    queryWallet?: string | null;
    bodyWallet?: string | null;
    requireHeader?: boolean;
};

function shouldRequireSignature(): boolean {
    return process.env.COPY_TRADING_REQUIRE_SIGNATURE === 'true'
        || process.env.MANAGED_WEALTH_REQUIRE_SIGNATURE === 'true';
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
    });
}

export function getWalletAuthHeaders(walletAddress: string) {
    return {
        'x-wallet-address': walletAddress.toLowerCase(),
    };
}
