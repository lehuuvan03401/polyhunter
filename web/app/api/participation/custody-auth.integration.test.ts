import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

function createJsonRequest(url: string, method: 'POST' | 'DELETE', body: unknown, headers?: Record<string, string>) {
    return new NextRequest(url, {
        method,
        headers: { 'content-type': 'application/json', ...(headers ?? {}) },
        body: JSON.stringify(body),
    });
}

type SetupOptions = {
    mode?: 'MANAGED' | 'FREE' | null;
    activeAuthorization?: Record<string, unknown> | null;
    recentAuthorizations?: Array<Record<string, unknown>>;
    revokeCount?: number;
};

async function setupCustodyAuthRoute(options: SetupOptions = {}) {
    const {
        mode = null,
        activeAuthorization = null,
        recentAuthorizations = [],
        revokeCount = 1,
    } = options;

    vi.resetModules();

    const createdAuthorization = {
        id: 'auth-1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        mode: 'MANAGED',
        status: 'ACTIVE',
        grantedAt: new Date('2026-03-02T00:00:00.000Z'),
    };

    const transactionClient = {
        managedCustodyAuthorization: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            create: vi.fn().mockResolvedValue(createdAuthorization),
        },
    };

    const prismaMock = {
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
        managedCustodyAuthorization: {
            findFirst: vi.fn().mockResolvedValue(activeAuthorization),
            findMany: vi.fn().mockResolvedValue(recentAuthorizations),
            updateMany: vi.fn().mockResolvedValue({ count: revokeCount }),
        },
        $transaction: vi.fn().mockImplementation(async (handler: (tx: typeof transactionClient) => unknown) => handler(transactionClient)),
    };

    vi.doMock('@/lib/prisma', () => ({
        prisma: prismaMock,
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
        get: route.GET,
        post: route.POST,
        del: route.DELETE,
        prismaMock,
        createdAuthorization,
    };
}

describe('Custody auth integration', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('rejects non-managed mode authorization payload', async () => {
        const { post } = await setupCustodyAuthRoute({ mode: 'MANAGED' });

        const res = await post(
            createJsonRequest('http://localhost/api/participation/custody-auth', 'POST', {
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
        const { post } = await setupCustodyAuthRoute({ mode: 'FREE' });

        const res = await post(
            createJsonRequest(
                'http://localhost/api/participation/custody-auth',
                'POST',
                {
                    walletAddress: '0x1111111111111111111111111111111111111111',
                    mode: 'MANAGED',
                    consentStatement: 'I agree to managed custody authorization',
                },
                { 'x-wallet-signature': '0xsignature' }
            )
        );
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.code).toBe('MODE_BOUNDARY_VIOLATION');
    });

    it('rejects custody authorization when participation account is missing', async () => {
        const { post } = await setupCustodyAuthRoute({ mode: null });

        const res = await post(
            createJsonRequest(
                'http://localhost/api/participation/custody-auth',
                'POST',
                {
                    walletAddress: '0x1111111111111111111111111111111111111111',
                    mode: 'MANAGED',
                    consentStatement: 'I agree to managed custody authorization',
                },
                { 'x-wallet-signature': '0xsignature' }
            )
        );
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.code).toBe('MODE_BOUNDARY_VIOLATION');
    });

    it('creates custody authorization for managed participants', async () => {
        const { post, prismaMock, createdAuthorization } = await setupCustodyAuthRoute({ mode: 'MANAGED' });

        const res = await post(
            createJsonRequest(
                'http://localhost/api/participation/custody-auth',
                'POST',
                {
                    walletAddress: '0x1111111111111111111111111111111111111111',
                    mode: 'MANAGED',
                    consentStatement: 'I agree to managed custody authorization',
                },
                { 'x-wallet-signature': '0xsignature' }
            )
        );
        const body = await res.json();

        expect(res.status).toBe(201);
        expect(body.authorization.id).toBe(createdAuthorization.id);
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('returns active and recent custody authorizations', async () => {
        const activeAuthorization = {
            id: 'auth-active',
            status: 'ACTIVE',
            grantedAt: new Date('2026-03-02T00:00:00.000Z'),
        };
        const recentAuthorizations = [
            activeAuthorization,
            {
                id: 'auth-revoked',
                status: 'REVOKED',
                grantedAt: new Date('2026-03-01T00:00:00.000Z'),
                revokedAt: new Date('2026-03-01T12:00:00.000Z'),
            },
        ];

        const { get } = await setupCustodyAuthRoute({
            mode: 'MANAGED',
            activeAuthorization,
            recentAuthorizations,
        });

        const res = await get(new NextRequest('http://localhost/api/participation/custody-auth?wallet=0x1111111111111111111111111111111111111111'));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.activeAuthorization.id).toBe('auth-active');
        expect(body.recentAuthorizations).toHaveLength(2);
    });

    it('revokes active custody authorization', async () => {
        const { del } = await setupCustodyAuthRoute({ mode: 'MANAGED', revokeCount: 1 });

        const res = await del(
            createJsonRequest(
                'http://localhost/api/participation/custody-auth',
                'DELETE',
                {
                    walletAddress: '0x1111111111111111111111111111111111111111',
                    authorizationId: 'auth-1',
                },
                { 'x-wallet-signature': '0xsignature' }
            )
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.revoked).toBe(1);
    });

    it('returns 404 when no active custody authorization exists on revoke', async () => {
        const { del } = await setupCustodyAuthRoute({ mode: 'MANAGED', revokeCount: 0 });

        const res = await del(
            createJsonRequest(
                'http://localhost/api/participation/custody-auth',
                'DELETE',
                {
                    walletAddress: '0x1111111111111111111111111111111111111111',
                    authorizationId: 'auth-missing',
                },
                { 'x-wallet-signature': '0xsignature' }
            )
        );
        const body = await res.json();

        expect(res.status).toBe(404);
        expect(body.error).toBe('No active authorization found');
    });
});
