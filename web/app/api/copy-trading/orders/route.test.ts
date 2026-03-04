import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const WALLET = '0x1111111111111111111111111111111111111111';

const {
    mockPrisma,
    mockResolveCopyTradingWalletContext,
} = vi.hoisted(() => ({
    mockPrisma: {
        copyTrade: {
            findMany: vi.fn(),
        },
    },
    mockResolveCopyTradingWalletContext: vi.fn(() => ({
        ok: true,
        wallet: WALLET,
    })),
}));

vi.mock('@/lib/prisma', () => ({
    prisma: mockPrisma,
}));

vi.mock('@/lib/copy-trading/request-wallet', () => ({
    resolveCopyTradingWalletContext: mockResolveCopyTradingWalletContext,
    resolveCopyTradingWriteWalletContext: mockResolveCopyTradingWalletContext,
}));

import { GET } from './route';

describe('GET /api/copy-trading/orders', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveCopyTradingWalletContext.mockReturnValue({
            ok: true,
            wallet: WALLET,
        });
    });

    it('clamps oversized limits and returns paginated orders', async () => {
        const detectedAt = new Date('2026-03-04T00:00:00.000Z');
        const trades = Array.from({ length: 201 }, (_, index) => ({
            id: `trade-${index}`,
            status: 'PENDING',
            txHash: null,
            originalTxHash: `0xleader-${index}`,
            originalSide: 'BUY',
            copySize: 5,
            copyPrice: 0.42,
            originalSize: 10,
            originalPrice: 0.4,
            marketSlug: 'example-market',
            tokenId: `token-${index}`,
            detectedAt,
            executedAt: null,
            errorMessage: null,
            config: {
                traderName: 'Leader',
                traderAddress: '0x2222222222222222222222222222222222222222',
            },
        }));
        mockPrisma.copyTrade.findMany.mockResolvedValue(trades);

        const req = new NextRequest(`http://localhost/api/copy-trading/orders?wallet=${WALLET}&limit=999`);
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(mockPrisma.copyTrade.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 201,
            })
        );
        expect(body.pagination).toEqual({
            limit: 200,
            nextCursor: 'trade-199',
            hasMore: true,
        });
        expect(body.orders).toHaveLength(200);
        expect(body.stats).toEqual({
            total: 200,
            pending: 200,
            open: 0,
            filled: 0,
            failed: 0,
        });
    });
});
