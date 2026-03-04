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
            groupBy: vi.fn(),
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

describe('GET /api/copy-trading/trades', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveCopyTradingWalletContext.mockReturnValue({
            ok: true,
            wallet: WALLET,
        });
    });

    it('clamps oversized limits and returns pagination metadata', async () => {
        const trades = Array.from({ length: 201 }, (_, index) => ({
            id: `trade-${index}`,
            status: 'PENDING',
        }));
        mockPrisma.copyTrade.findMany.mockResolvedValue(trades);
        mockPrisma.copyTrade.groupBy.mockResolvedValue([]);

        const req = new NextRequest(`http://localhost/api/copy-trading/trades?wallet=${WALLET}&limit=999`);
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
        expect(body.trades).toHaveLength(200);
    });
});
