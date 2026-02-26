import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

function createJsonRequest(url: string, body: unknown) {
    return new NextRequest(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function setupRouteWithFreeModeAccount() {
    vi.resetModules();

    vi.doMock('@/lib/prisma', () => ({
        prisma: {
            participationAccount: {
                findUnique: vi.fn().mockResolvedValue({
                    status: 'ACTIVE',
                    preferredMode: 'FREE',
                    isRegistrationComplete: true,
                }),
            },
        },
        isDatabaseEnabled: true,
    }));

    vi.doMock('@/lib/managed-wealth/request-wallet', () => ({
        resolveWalletContext: () => ({
            ok: true,
            wallet: '0x1111111111111111111111111111111111111111',
        }),
    }));

    const route = await import('@/app/api/managed-subscriptions/route');
    return {
        post: route.POST,
    };
}

describe('Managed subscriptions mode boundary integration', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('rejects managed subscription for FREE mode participation account', async () => {
        const { post } = await setupRouteWithFreeModeAccount();

        const res = await post(
            createJsonRequest('http://localhost/api/managed-subscriptions', {
                walletAddress: '0x1111111111111111111111111111111111111111',
                productId: 'prod-1',
                termId: 'term-1',
                principal: 600,
                acceptedTerms: true,
            })
        );
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.code).toBe('MODE_BOUNDARY_VIOLATION');
    });
});
