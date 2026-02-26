import { describe, expect, it, vi } from 'vitest';
import { settleManagedProfitFeeIfNeeded } from './managed-settlement-service';

type TestInput = Parameters<typeof settleManagedProfitFeeIfNeeded>[0];

function createInput(overrides?: Partial<TestInput>) {
    const upsertMock = vi.fn().mockResolvedValue({ commissionStatus: 'PENDING' });
    const updateMock = vi.fn().mockResolvedValue({});
    const updateManyMock = vi.fn().mockResolvedValue({ count: 1 });
    const distributorMock = vi.fn().mockResolvedValue(undefined);

    const input: TestInput = {
        db: {
            managedSettlementExecution: {
                upsert: upsertMock,
                update: updateMock,
                updateMany: updateManyMock,
            },
        } as unknown as TestInput['db'],
        distributor: distributorMock,
        walletAddress: '0x1111111111111111111111111111111111111111',
        subscriptionId: 'sub-1',
        settlementId: 'settlement-1',
        grossPnl: 100,
        scope: 'MANAGED_WITHDRAWAL',
        sourcePrefix: 'managed-withdraw',
        ...overrides,
    };

    return {
        input,
        mocks: {
            upsertMock,
            updateMock,
            updateManyMock,
            distributorMock,
        },
    };
}

describe('settleManagedProfitFeeIfNeeded', () => {
    it('skips non-profitable settlements and marks execution as SKIPPED', async () => {
        const { input, mocks } = createInput({ grossPnl: 0 });

        const result = await settleManagedProfitFeeIfNeeded(input);

        expect(result.status).toBe('SKIPPED_NON_PROFIT');
        expect(mocks.distributorMock).not.toHaveBeenCalled();
        expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                commissionStatus: 'SKIPPED',
                commissionSkippedReason: 'NON_PROFITABLE',
            }),
        }));
    });

    it('skips when execution is already finalized', async () => {
        const { input, mocks } = createInput();
        mocks.upsertMock.mockResolvedValue({ commissionStatus: 'COMPLETED' });

        const result = await settleManagedProfitFeeIfNeeded(input);

        expect(result.status).toBe('SKIPPED_ALREADY_FINALIZED');
        expect(mocks.distributorMock).not.toHaveBeenCalled();
        expect(mocks.updateManyMock).not.toHaveBeenCalled();
    });

    it('skips when another worker already claimed processing', async () => {
        const { input, mocks } = createInput();
        mocks.updateManyMock.mockResolvedValue({ count: 0 });

        const result = await settleManagedProfitFeeIfNeeded(input);

        expect(result.status).toBe('SKIPPED_ALREADY_PROCESSING');
        expect(mocks.distributorMock).not.toHaveBeenCalled();
    });

    it('completes commission distribution after successful claim', async () => {
        const { input, mocks } = createInput();

        const result = await settleManagedProfitFeeIfNeeded(input);

        expect(result.status).toBe('COMPLETED');
        expect(mocks.distributorMock).toHaveBeenCalledWith(
            input.walletAddress,
            input.grossPnl,
            `managed-withdraw:${input.subscriptionId}:${input.settlementId}`,
            { scope: 'MANAGED_WITHDRAWAL' }
        );
        expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                commissionStatus: 'COMPLETED',
            }),
        }));
    });

    it('marks execution FAILED when distributor throws', async () => {
        const { input, mocks } = createInput();
        const distributionError = new Error('network down');
        input.distributor = vi.fn().mockRejectedValue(distributionError);

        await expect(settleManagedProfitFeeIfNeeded(input)).rejects.toThrow('network down');

        expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                commissionStatus: 'FAILED',
                commissionError: 'network down',
            }),
        }));
    });
});
