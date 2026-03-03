import { describe, expect, it } from 'vitest';
import { getWalletContextErrorCode } from './request-wallet';

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
});
