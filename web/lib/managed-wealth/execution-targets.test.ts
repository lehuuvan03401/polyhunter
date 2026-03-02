import { describe, expect, it, vi } from 'vitest';
import {
    normalizeManagedExecutionConfigIds,
    resolvePrimaryManagedExecutionConfigId,
    resolveManagedExecutionConfigIds,
} from './execution-targets';

describe('managed execution target helpers', () => {
    it('prefers active execution target config ids over the legacy fallback', () => {
        expect(normalizeManagedExecutionConfigIds({
            targets: [
                { copyConfigId: 'cfg-2', isActive: true },
                { copyConfigId: 'cfg-1', isActive: true },
                { copyConfigId: 'cfg-3', isActive: false },
            ],
            fallbackCopyConfigId: 'cfg-legacy',
        })).toEqual(['cfg-2', 'cfg-1']);
    });

    it('resolves the primary config id from explicit primary ordering', () => {
        expect(resolvePrimaryManagedExecutionConfigId({
            targets: [
                { copyConfigId: 'cfg-2', isActive: true, isPrimary: false, targetOrder: 1 },
                { copyConfigId: 'cfg-1', isActive: true, isPrimary: true, targetOrder: 2 },
            ],
            fallbackCopyConfigId: 'cfg-legacy',
        })).toBe('cfg-1');
    });

    it('loads active execution config ids from prisma-backed delegates', async () => {
        const managedSubscriptionExecutionTarget = {
            findMany: vi.fn().mockResolvedValue([
                {
                    copyConfigId: 'cfg-1',
                    allocationVersion: 2,
                    targetWeight: 0.6,
                    targetOrder: 0,
                    isPrimary: true,
                    isActive: true,
                },
                {
                    copyConfigId: 'cfg-2',
                    allocationVersion: 2,
                    targetWeight: 0.4,
                    targetOrder: 1,
                    isPrimary: false,
                    isActive: true,
                },
            ]),
        };

        const ids = await resolveManagedExecutionConfigIds(
            { managedSubscriptionExecutionTarget } as never,
            {
                subscriptionId: 'sub-1',
                fallbackCopyConfigId: 'cfg-legacy',
            }
        );

        expect(ids).toEqual(['cfg-1', 'cfg-2']);
        expect(managedSubscriptionExecutionTarget.findMany).toHaveBeenCalledWith({
            where: {
                subscriptionId: 'sub-1',
                isActive: true,
            },
            orderBy: [
                { isPrimary: 'desc' },
                { targetOrder: 'asc' },
                { createdAt: 'asc' },
            ],
            select: {
                copyConfigId: true,
                allocationVersion: true,
                targetWeight: true,
                targetOrder: true,
                isPrimary: true,
                isActive: true,
            },
        });
    });
});
