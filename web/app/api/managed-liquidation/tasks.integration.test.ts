import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

function createGetRequest(url: string) {
    return new NextRequest(url, {
        method: 'GET',
    });
}

function createPostRequest(url: string, body: unknown) {
    return new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

async function setupRoute(params?: {
    isAdmin?: boolean;
}) {
    const now = new Date('2026-02-26T15:00:00.000Z');

    const managedLiquidationTaskCount = vi.fn()
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(3);
    const managedLiquidationTaskGroupBy = vi.fn().mockResolvedValue([
        { status: 'PENDING', _count: { _all: 2 } },
        { status: 'RETRYING', _count: { _all: 1 } },
        { status: 'BLOCKED', _count: { _all: 1 } },
    ]);
    const managedLiquidationTaskFindMany = vi.fn().mockResolvedValue([
        {
            id: 'task-1',
            subscriptionId: 'sub-1',
            walletAddress: '0x1111111111111111111111111111111111111111',
            copyConfigId: 'cfg-1',
            tokenId: 'token-1',
            requestedShares: 12,
            avgEntryPrice: 0.44,
            indicativePrice: 0.41,
            notionalUsd: 4.92,
            status: 'PENDING',
            attemptCount: 1,
            lastAttemptAt: new Date('2026-02-26T14:50:00.000Z'),
            nextRetryAt: null,
            errorCode: 'PENDING_EXTERNAL_EXECUTION',
            errorMessage: 'Pending external executor',
            createdAt: new Date('2026-02-26T14:00:00.000Z'),
            updatedAt: new Date('2026-02-26T14:50:00.000Z'),
        },
    ]);
    const managedLiquidationTaskUpdateMany = vi.fn().mockResolvedValue({ count: 1 });

    vi.useFakeTimers();
    vi.setSystemTime(now);

    vi.resetModules();
    vi.doMock('@/lib/prisma', () => ({
        prisma: {
            managedLiquidationTask: {
                count: managedLiquidationTaskCount,
                groupBy: managedLiquidationTaskGroupBy,
                findMany: managedLiquidationTaskFindMany,
                updateMany: managedLiquidationTaskUpdateMany,
            },
        },
        isDatabaseEnabled: true,
    }));

    vi.doMock('@/lib/participation-program/partner-program', () => ({
        isAdminRequest: () => params?.isAdmin ?? true,
    }));

    const route = await import('@/app/api/managed-liquidation/tasks/route');

    return {
        get: route.GET,
        post: route.POST,
        mocks: {
            managedLiquidationTaskCount,
            managedLiquidationTaskGroupBy,
            managedLiquidationTaskFindMany,
            managedLiquidationTaskUpdateMany,
        },
    };
}

describe('Managed liquidation tasks route integration', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('rejects unauthorized requests', async () => {
        const { get } = await setupRoute({ isAdmin: false });
        const res = await get(createGetRequest('http://localhost/api/managed-liquidation/tasks'));
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
    });

    it('returns liquidation queue summary and tasks', async () => {
        const { get } = await setupRoute({ isAdmin: true });
        const res = await get(
            createGetRequest('http://localhost/api/managed-liquidation/tasks?statuses=PENDING,RETRYING&limit=50')
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.summary.totalCount).toBe(4);
        expect(body.summary.dueCount).toBe(3);
        expect(body.summary.byStatus.pending).toBe(2);
        expect(body.summary.byStatus.retrying).toBe(1);
        expect(body.summary.byStatus.blocked).toBe(1);
        expect(body.tasks).toHaveLength(1);
        expect(body.tasks[0].id).toBe('task-1');
        expect(body.tasks[0].isDue).toBe(true);
    });

    it('supports admin retry action', async () => {
        const { post, mocks } = await setupRoute({ isAdmin: true });
        const res = await post(
            createPostRequest('http://localhost/api/managed-liquidation/tasks', {
                action: 'retry',
                taskIds: ['task-1'],
                delaySeconds: 120,
                reason: 'manual retry',
            })
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.updatedCount).toBe(1);
        expect(body.tasks).toHaveLength(1);
        expect(body.tasks[0].id).toBe('task-1');
        expect(mocks.managedLiquidationTaskUpdateMany).toHaveBeenCalledTimes(1);
    });
});
