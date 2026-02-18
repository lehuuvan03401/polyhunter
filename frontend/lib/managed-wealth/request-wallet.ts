import { NextRequest } from 'next/server';
import { ethers } from 'ethers';
import {
    buildManagedWalletAuthMessage,
    MANAGED_WALLET_AUTH_WINDOW_MS,
} from '@/lib/managed-wealth/wallet-auth-message';

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

type ResolveWalletContextOptions = {
    queryWallet?: string | null;
    bodyWallet?: string | null;
    requireHeader?: boolean;
    requireSignature?: boolean;
};

type ResolveWalletContextResult =
    | { ok: true; wallet: string }
    | { ok: false; status: number; error: string };

function parseWallet(raw: string | null | undefined, source: string): { wallet: string | null; error?: string } {
    if (!raw) return { wallet: null };
    const normalized = raw.trim();
    if (!EVM_ADDRESS_REGEX.test(normalized)) {
        return { wallet: null, error: `Invalid wallet address in ${source}` };
    }
    return { wallet: normalized.toLowerCase() };
}

export function resolveWalletContext(
    request: NextRequest,
    options: ResolveWalletContextOptions = {}
): ResolveWalletContextResult {
    const header = parseWallet(request.headers.get('x-wallet-address'), 'x-wallet-address header');
    if (header.error) {
        return { ok: false, status: 400, error: header.error };
    }

    const query = parseWallet(options.queryWallet, 'query param');
    if (query.error) {
        return { ok: false, status: 400, error: query.error };
    }

    const body = parseWallet(options.bodyWallet, 'request body');
    if (body.error) {
        return { ok: false, status: 400, error: body.error };
    }

    if (options.requireHeader && !header.wallet) {
        return { ok: false, status: 401, error: 'Missing wallet header x-wallet-address' };
    }

    const wallets = [header.wallet, query.wallet, body.wallet].filter((value): value is string => Boolean(value));
    if (wallets.length === 0) {
        return { ok: false, status: 400, error: 'Missing wallet address' };
    }

    if (new Set(wallets).size > 1) {
        return { ok: false, status: 400, error: 'Wallet mismatch between request header/query/body' };
    }

    const resolvedWallet = wallets[0];
    const shouldRequireSignature = options.requireSignature !== undefined
        ? options.requireSignature
        : process.env.MANAGED_WEALTH_REQUIRE_SIGNATURE === 'true';
    const bypassSignature = process.env.NEXT_PUBLIC_E2E_MOCK_AUTH === 'true';

    if (shouldRequireSignature && !bypassSignature) {
        const signature = request.headers.get('x-wallet-signature');
        const timestampRaw = request.headers.get('x-wallet-timestamp');

        if (!signature || !timestampRaw) {
            return {
                ok: false,
                status: 401,
                error: 'Missing wallet signature headers',
            };
        }

        const timestamp = Number(timestampRaw);
        if (!Number.isFinite(timestamp) || timestamp <= 0) {
            return {
                ok: false,
                status: 400,
                error: 'Invalid wallet signature timestamp',
            };
        }

        const now = Date.now();
        if (Math.abs(now - timestamp) > MANAGED_WALLET_AUTH_WINDOW_MS) {
            return {
                ok: false,
                status: 401,
                error: 'Wallet signature expired',
            };
        }

        const pathWithQuery = `${request.nextUrl.pathname}${request.nextUrl.search}`;
        const message = buildManagedWalletAuthMessage({
            walletAddress: resolvedWallet,
            method: request.method,
            pathWithQuery,
            timestamp,
        });

        try {
            const recovered = ethers.utils.verifyMessage(message, signature).toLowerCase();
            if (recovered !== resolvedWallet) {
                return {
                    ok: false,
                    status: 401,
                    error: 'Invalid wallet signature',
                };
            }
        } catch {
            return {
                ok: false,
                status: 401,
                error: 'Invalid wallet signature format',
            };
        }
    }

    return { ok: true, wallet: resolvedWallet };
}
