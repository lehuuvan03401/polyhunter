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
}));

import { GET } from './route';

describe('GET /api/copy-trading/history', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveCopyTradingWalletContext.mockReturnValue({
            ok: true,
            wallet: WALLET,
        });
    });

    it('clamps oversized limits and forwards cursor to Prisma', async () => {
        const detectedAt = new Date('2026-03-04T00:00:00.000Z');
        mockPrisma.copyTrade.findMany.mockResolvedValue([
            {
                id: 'trade-1',
                txHash: '0xabc',
                detectedAt,
                originalSide: 'BUY',
                outcome: 'YES',
                marketSlug: 'example-market',
                tokenId: 'token-1',
                copySize: 12,
                copyPrice: 0.55,
                originalPrice: 0.5,
            },
        ]);

        const req = new NextRequest(`http://localhost/api/copy-trading/history?wallet=${WALLET}&limit=999&cursor=trade-10`);
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(mockPrisma.copyTrade.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                cursor: { id: 'trade-10' },
                skip: 1,
                take: 200,
            })
        );
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
            transactionHash: '0xabc',
            side: 'BUY',
            outcome: 'YES',
            size: 12,
            price: 0.55,
            simulated: true,
        });
    });
});
