import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

function createGetRequest(url: string) {
    return new NextRequest(url, {
        method: 'GET',
    });
}

function createParams(id: string) {
    return {
        params: Promise.resolve({ id }),
    };
}

function createSchemaMissingError(code: 'P2021' | 'P2022') {
    return Object.assign(new Error('schema missing'), { code });
}

describe('Managed product detail route integration', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('degrades allocation snapshots when the allocation table is not available', async () => {
        vi.resetModules();

        const managedProductFindFirst = vi.fn().mockResolvedValue({
            id: 'product-1',
            slug: 'balanced-alpha-vault',
            strategyProfile: 'CONSERVATIVE',
            terms: [],
            agents: [],
            subscriptions: [],
        });
        const managedSubscriptionCount = vi.fn()
            .mockResolvedValueOnce(3)
            .mockResolvedValueOnce(2);
        const managedSubscriptionAllocationFindMany = vi.fn().mockRejectedValue(
            createSchemaMissingError('P2021')
        );
        const managedNavSnapshotFindMany = vi.fn().mockResolvedValue([]);

        vi.doMock('@/lib/prisma', () => ({
            prisma: {
                managedProduct: {
                    findFirst: managedProductFindFirst,
                },
                managedSubscription: {
                    count: managedSubscriptionCount,
                },
                managedSubscriptionAllocation: {
                    findMany: managedSubscriptionAllocationFindMany,
                },
                managedNavSnapshot: {
                    findMany: managedNavSnapshotFindMany,
                },
            },
            isDatabaseEnabled: true,
        }));

        const route = await import('@/app/api/managed-products/[id]/route');
        const res = await route.GET(
            createGetRequest('http://localhost/api/managed-products/balanced-alpha-vault'),
            createParams('balanced-alpha-vault')
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.stats.subscriptionCount).toBe(3);
        expect(body.stats.runningSubscriptionCount).toBe(2);
        expect(body.allocationSnapshots).toEqual([]);
    });

    it('returns 503 when core managed wealth tables are missing', async () => {
        vi.resetModules();

        vi.doMock('@/lib/prisma', () => ({
            prisma: {
                managedProduct: {
                    findFirst: vi.fn().mockRejectedValue(createSchemaMissingError('P2021')),
                },
            },
            isDatabaseEnabled: true,
        }));

        const route = await import('@/app/api/managed-products/[id]/route');
        const res = await route.GET(
            createGetRequest('http://localhost/api/managed-products/balanced-alpha-vault'),
            createParams('balanced-alpha-vault')
        );
        const body = await res.json();

        expect(res.status).toBe(503);
        expect(body.error).toBe('Managed wealth tables are not initialized');
    });
});
