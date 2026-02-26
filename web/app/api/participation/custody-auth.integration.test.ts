import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

function createJsonRequest(url: string, body: unknown) {
    return new NextRequest(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function setupCustodyAuthRoute() {
    vi.resetModules();

    vi.doMock('@/lib/prisma', () => ({
        prisma: {},
        isDatabaseEnabled: true,
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
        const { post } = await setupCustodyAuthRoute();

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
});
