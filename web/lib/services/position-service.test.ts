import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockTx } = vi.hoisted(() => {
    const mockTx = {
        userPosition: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        $executeRaw: vi.fn(),
    };

    const mockPrisma = {
        $transaction: vi.fn(async (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)),
    };

    return {
        mockPrisma,
        mockTx,
    };
});

vi.mock('../prisma.js', () => ({
    prisma: mockPrisma,
}));

import { PositionService } from './position-service';

describe('PositionService.recordSell', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reduces remaining total cost proportionally after a partial sell', async () => {
        mockTx.userPosition.findUnique.mockResolvedValue({
            walletAddress: 'wallet-1',
            tokenId: 'token-1',
            balance: 100,
            totalCost: 40,
            avgEntryPrice: 0.4,
        });
        mockTx.userPosition.update.mockResolvedValue({});

        const service = new PositionService(mockPrisma as any);
        const result = await service.recordSell({
            walletAddress: 'wallet-1',
            tokenId: 'token-1',
            side: 'SELL',
            amount: 25,
            price: 0.6,
            totalValue: 15,
        });

        expect(result).toEqual({
            realized: true,
            profit: 5,
            profitPercent: 0.5,
        });
        expect(mockTx.userPosition.update).toHaveBeenCalledWith({
            where: {
                walletAddress_tokenId: {
                    walletAddress: 'wallet-1',
                    tokenId: 'token-1',
                },
            },
            data: {
                balance: 75,
                totalCost: 30,
                avgEntryPrice: 0.4,
                updatedAt: expect.any(Date),
            },
        });
        expect(mockTx.$executeRaw).not.toHaveBeenCalled();
    });

    it('clears total cost and average entry price after a full sell', async () => {
        mockTx.userPosition.findUnique.mockResolvedValue({
            walletAddress: 'wallet-1',
            tokenId: 'token-1',
            balance: 100,
            totalCost: 40,
            avgEntryPrice: 0.4,
        });
        mockTx.userPosition.update.mockResolvedValue({});

        const service = new PositionService(mockPrisma as any);
        const result = await service.recordSell({
            walletAddress: 'wallet-1',
            tokenId: 'token-1',
            side: 'SELL',
            amount: 100,
            price: 0.7,
            totalValue: 70,
        });

        expect(result).toEqual({
            realized: true,
            profit: 30,
            profitPercent: 0.75,
        });
        expect(mockTx.userPosition.update).toHaveBeenCalledWith({
            where: {
                walletAddress_tokenId: {
                    walletAddress: 'wallet-1',
                    tokenId: 'token-1',
                },
            },
            data: {
                balance: 0,
                totalCost: 0,
                avgEntryPrice: 0,
                updatedAt: expect.any(Date),
            },
        });
    });
});
