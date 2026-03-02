import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./managed-settlement-service', () => ({
    settleManagedProfitFeeIfNeeded: vi.fn(),
}));

import { finalizeManagedSettlementEntry } from './managed-settlement-entrypoint';
import { settleManagedProfitFeeIfNeeded } from './managed-settlement-service';

const mockedSettleManagedProfitFeeIfNeeded = vi.mocked(settleManagedProfitFeeIfNeeded);

describe('managed settlement entrypoint helper', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('skips profit-fee settlement for non-completed mutation states', async () => {
        const mutationResult = await finalizeManagedSettlementEntry({
            db: {
                managedSettlementExecution: {
                    upsert: vi.fn(),
                },
            } as never,
            distributor: vi.fn(),
            walletAddress: '0xuser',
            mutationResult: {
                status: 'SKIPPED_ALREADY_SETTLED',
                subscription: {
                    id: 'sub-1',
                },
            } as never,
        });

        expect(mutationResult.status).toBe('SKIPPED_ALREADY_SETTLED');
        expect(mockedSettleManagedProfitFeeIfNeeded).not.toHaveBeenCalled();
    });

    it('uses the shared managed-withdraw fee scope defaults for completed settlements', async () => {
        mockedSettleManagedProfitFeeIfNeeded.mockResolvedValueOnce({
            status: 'COMPLETED',
            tradeId: 'managed-withdraw:sub-1:settlement-1',
        });

        const distributor = vi.fn();
        const mutationResult = {
            status: 'COMPLETED' as const,
            subscription: {
                id: 'sub-1',
            },
            settlement: {
                id: 'settlement-1',
                grossPnl: 120,
            },
            guaranteeEligible: true,
        } as never;

        const result = await finalizeManagedSettlementEntry({
            db: {
                managedSettlementExecution: {
                    upsert: vi.fn(),
                },
            } as never,
            distributor,
            walletAddress: '0xuser',
            mutationResult,
        });

        expect(result).toEqual(mutationResult);
        expect(mockedSettleManagedProfitFeeIfNeeded).toHaveBeenCalledWith({
            db: expect.any(Object),
            distributor,
            walletAddress: '0xuser',
            subscriptionId: 'sub-1',
            settlementId: 'settlement-1',
            grossPnl: 120,
            scope: 'MANAGED_WITHDRAWAL',
            sourcePrefix: 'managed-withdraw',
        });
    });

    it('routes profit-fee failures through the shared error hook without failing the caller', async () => {
        const feeError = new Error('affiliate unavailable');
        mockedSettleManagedProfitFeeIfNeeded.mockRejectedValueOnce(feeError);

        const onProfitFeeError = vi.fn();
        const mutationResult = {
            status: 'COMPLETED' as const,
            subscription: {
                id: 'sub-1',
            },
            settlement: {
                id: 'settlement-1',
                grossPnl: 50,
            },
            guaranteeEligible: false,
        } as never;

        const result = await finalizeManagedSettlementEntry({
            db: {
                managedSettlementExecution: {
                    upsert: vi.fn(),
                },
            } as never,
            distributor: vi.fn(),
            walletAddress: '0xuser',
            mutationResult,
            onProfitFeeError,
        });

        expect(result).toEqual(mutationResult);
        expect(onProfitFeeError).toHaveBeenCalledWith(feeError);
    });
});
