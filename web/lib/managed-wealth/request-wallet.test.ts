import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { ethers } from 'ethers';
import { buildManagedWalletSessionMessage } from './wallet-auth-message';
import { getWalletContextErrorCode, resolveWalletContext } from './request-wallet';

describe('getWalletContextErrorCode', () => {
    it('maps known header/signature errors to stable wallet codes', () => {
        expect(getWalletContextErrorCode('Missing wallet header x-wallet-address')).toBe('WALLET_HEADER_REQUIRED');
        expect(getWalletContextErrorCode('Missing wallet signature headers')).toBe('WALLET_SIGNATURE_REQUIRED');
        expect(getWalletContextErrorCode('Wallet signature expired')).toBe('WALLET_SIGNATURE_EXPIRED');
    });

    it('maps wallet-format validation errors to WALLET_ADDRESS_INVALID', () => {
        expect(getWalletContextErrorCode('Invalid wallet address in query param')).toBe('WALLET_ADDRESS_INVALID');
        expect(getWalletContextErrorCode('Invalid wallet address in request body')).toBe('WALLET_ADDRESS_INVALID');
    });

    it('maps unknown errors to fallback code', () => {
        expect(getWalletContextErrorCode('Unexpected wallet guard failure')).toBe('WALLET_CONTEXT_INVALID');
    });

    it('maps session-scope signature rejection to a stable code', () => {
        expect(getWalletContextErrorCode('Session wallet signature is not allowed for this request')).toBe('WALLET_SIGNATURE_SCOPE_INVALID');
    });
});

describe('resolveWalletContext', () => {
    it('rejects session signatures when the caller requires request-scoped signatures', async () => {
        const wallet = ethers.Wallet.createRandom();
        const timestamp = Date.now();
        const message = buildManagedWalletSessionMessage({
            walletAddress: wallet.address,
            timestamp,
        });
        const signature = await wallet.signMessage(message);

        const request = new NextRequest('http://localhost/api/copy-trading/execute', {
            method: 'POST',
            headers: {
                'x-wallet-address': wallet.address,
                'x-wallet-signature': signature,
                'x-wallet-timestamp': String(timestamp),
                'x-wallet-auth-type': 'session',
            },
        });

        const result = resolveWalletContext(request, {
            requireHeader: true,
            requireSignature: true,
            allowSessionAuth: false,
        });

        expect(result).toEqual({
            ok: false,
            status: 401,
            error: 'Session wallet signature is not allowed for this request',
        });
    });
});
