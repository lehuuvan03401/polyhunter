import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

function createCancelRequest(subscriptionId: string, body: unknown = {}) {
    return new NextRequest(
        `http://localhost/api/managed-subscriptions/${subscriptionId}/cancel`,
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        }
    );
}

// Minimal prisma mock for the cancel route
function makePrismaMock(overrides: {
    subscription?: Record<string, unknown> | null;
    releaseShouldThrow?: boolean;
}) {
    const { subscription = null, releaseShouldThrow = false } = overrides;

    const releaseMock = releaseShouldThrow
        ? vi.fn().mockRejectedValue(new Error('Release failed'))
        : vi.fn().mockResolvedValue({ id: 'ledger-1' });

    const updateMock = vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        ...(subscription ?? {}),
        ...data,
    }));

    const txMock = {
        managedSubscription: {
            findUnique: vi.fn().mockResolvedValue(subscription),
            update: updateMock,
        },
        managedPrincipalReservationLedger: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'ledger-1' }),
        },
    };

    return {
        prisma: {
            isDatabaseEnabled: true,
            $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
            managedSubscription: { findUnique: vi.fn() },
        },
        isDatabaseEnabled: true,
        releaseMock,
        updateMock,
        txMock,
    };
}

describe('POST /api/managed-subscriptions/[id]/cancel integration', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns 404 when subscription does not exist', async () => {
        vi.resetModules();
        const { prisma, isDatabaseEnabled } = makePrismaMock({ subscription: null });

        vi.doMock('@/lib/prisma', () => ({ prisma, isDatabaseEnabled }));
        vi.doMock('@/lib/managed-wealth/principal-reservation', () => ({
            releaseManagedPrincipalReservation: vi.fn(),
        }));

        const { POST } = await import(
            '@/app/api/managed-subscriptions/[id]/cancel/route'
        );

        const res = await POST(createCancelRequest('sub-not-found'), {
            params: Promise.resolve({ id: 'sub-not-found' }),
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toMatch(/not found/i);
    });

    it('returns 400 when subscription is not PENDING', async () => {
        vi.resetModules();
        const runningSubscription = {
            id: 'sub-running',
            status: 'RUNNING',
            walletAddress: '0x1111',
            principal: 1000,
            settlement: null,
        };
        const { prisma, isDatabaseEnabled } = makePrismaMock({ subscription: runningSubscription });

        vi.doMock('@/lib/prisma', () => ({ prisma, isDatabaseEnabled }));
        vi.doMock('@/lib/managed-wealth/principal-reservation', () => ({
            releaseManagedPrincipalReservation: vi.fn(),
        }));

        const { POST } = await import(
            '@/app/api/managed-subscriptions/[id]/cancel/route'
        );

        const res = await POST(createCancelRequest('sub-running'), {
            params: Promise.resolve({ id: 'sub-running' }),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/PENDING/i);
    });

    it('cancels a PENDING subscription and releases principal reservation', async () => {
        vi.resetModules();
        const pendingSubscription = {
            id: 'sub-pending',
            status: 'PENDING',
            walletAddress: '0x2222',
            principal: 500,
            settlement: null,
        };
        const { prisma, isDatabaseEnabled, releaseMock } = makePrismaMock({
            subscription: pendingSubscription,
        });

        const releaseFn = releaseMock;
        vi.doMock('@/lib/prisma', () => ({ prisma, isDatabaseEnabled }));
        vi.doMock('@/lib/managed-wealth/principal-reservation', () => ({
            releaseManagedPrincipalReservation: releaseFn,
        }));

        const { POST } = await import(
            '@/app/api/managed-subscriptions/[id]/cancel/route'
        );

        const res = await POST(
            createCancelRequest('sub-pending', { reason: 'admin_test' }),
            { params: Promise.resolve({ id: 'sub-pending' }) }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.subscription.status).toBe('CANCELLED');
        expect(releaseFn).toHaveBeenCalledOnce();
        expect(releaseFn).toHaveBeenCalledWith(
            expect.anything(), // tx
            expect.objectContaining({
                subscriptionId: 'sub-pending',
                walletAddress: '0x2222',
                amount: 500,
            })
        );
    });

    it('returns 503 when database is disabled', async () => {
        vi.resetModules();
        vi.doMock('@/lib/prisma', () => ({
            prisma: {},
            isDatabaseEnabled: false,
        }));
        vi.doMock('@/lib/managed-wealth/principal-reservation', () => ({
            releaseManagedPrincipalReservation: vi.fn(),
        }));

        const { POST } = await import(
            '@/app/api/managed-subscriptions/[id]/cancel/route'
        );

        const res = await POST(createCancelRequest('sub-any'), {
            params: Promise.resolve({ id: 'sub-any' }),
        });

        expect(res.status).toBe(503);
    });
});
