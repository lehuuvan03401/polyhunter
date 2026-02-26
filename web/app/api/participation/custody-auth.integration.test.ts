import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

function createJsonRequest(url: string, body: unknown) {
    return new NextRequest(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function setupCustodyAuthRoute(mode: 'MANAGED' | 'FREE' | null = null) {
    vi.resetModules();

    vi.doMock('@/lib/prisma', () => ({
        prisma: {
            participationAccount: {
                findUnique: vi.fn().mockResolvedValue(
                    mode
                        ? {
                            id: 'account-1',
                            preferredMode: mode,
                        }
                        : null
                ),
            },
            $transaction: vi.fn(),
        },
        isDatabaseEnabled: true,
    }));
    vi.doMock('@/lib/managed-wealth/request-wallet', () => ({
        resolveWalletContext: () => ({
            ok: true,
            wallet: '0x1111111111111111111111111111111111111111',
        }),
    }));

    const route = await import('@/app/api/participation/custody-auth/route');
    return {
        post: route.POST,
    };
}

describe('Custody auth integration', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('rejects non-managed mode authorization payload', async () => {
        const { post } = await setupCustodyAuthRoute('MANAGED');

        const res = await post(
            createJsonRequest('http://localhost/api/participation/custody-auth', {
                walletAddress: '0x1111111111111111111111111111111111111111',
                mode: 'FREE',
                consentStatement: 'I agree to managed custody authorization',
            })
        );
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toBe('Invalid input');
    });

    it('rejects custody authorization when account mode is not MANAGED', async () => {
        const { post } = await setupCustodyAuthRoute('FREE');

        const res = await post(
            new NextRequest('http://localhost/api/participation/custody-auth', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-wallet-signature': '0xsignature',
                },
                body: JSON.stringify({
                    walletAddress: '0x1111111111111111111111111111111111111111',
                    mode: 'MANAGED',
                    consentStatement: 'I agree to managed custody authorization',
                }),
            })
        );
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.code).toBe('MODE_BOUNDARY_VIOLATION');
    });

    it('rejects custody authorization when participation account is missing', async () => {
        const { post } = await setupCustodyAuthRoute(null);

        const res = await post(
            new NextRequest('http://localhost/api/participation/custody-auth', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-wallet-signature': '0xsignature',
                },
                body: JSON.stringify({
                    walletAddress: '0x1111111111111111111111111111111111111111',
                    mode: 'MANAGED',
                    consentStatement: 'I agree to managed custody authorization',
                }),
            })
        );
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.code).toBe('MODE_BOUNDARY_VIOLATION');
    });
});
