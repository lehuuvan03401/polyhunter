import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const NOW_SEC = Math.floor(Date.now() / 1000);

const {
    mockPrisma,
    mockVerifyCopyTradingCronAuthorizationHeader,
    mockPolyClient,
} = vi.hoisted(() => ({
    mockPrisma: {
        copyTradingConfig: {
            findMany: vi.fn(),
            count: vi.fn(),
            groupBy: vi.fn(),
        },
        copyTrade: {
            findUnique: vi.fn(),
            create: vi.fn(),
            count: vi.fn(),
        },
    },
    mockVerifyCopyTradingCronAuthorizationHeader: vi.fn(() => true),
    mockPolyClient: {
        wallets: {
            getWalletActivity: vi.fn(),
        },
    },
}));

vi.mock('@/lib/prisma', () => ({
    prisma: mockPrisma,
}));

vi.mock('@/lib/polymarket', () => ({
    polyClient: mockPolyClient,
}));

vi.mock('@/lib/copy-trading/runtime-config', async () => {
    const actual = await vi.importActual<typeof import('@/lib/copy-trading/runtime-config')>('@/lib/copy-trading/runtime-config');
    return {
        ...actual,
        getCopyTradingCronSecret: vi.fn(() => 'test-secret'),
        verifyCopyTradingCronAuthorizationHeader: mockVerifyCopyTradingCronAuthorizationHeader,
    };
});

import { POST } from './route';

describe('POST /api/copy-trading/detect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockVerifyCopyTradingCronAuthorizationHeader.mockReturnValue(true);
        mockPrisma.copyTradingConfig.findMany.mockResolvedValue([
            {
                id: 'cfg-1',
                walletAddress: '0x2222222222222222222222222222222222222222',
                traderAddress: '0xtrader',
                mode: 'PERCENTAGE',
                sizeScale: 1,
                fixedAmount: null,
                maxSizePerTrade: 100,
                minSizePerTrade: null,
                sideFilter: null,
                minTriggerSize: null,
                maxOdds: null,
                direction: 'COPY',
                tradeSizeMode: 'SHARES',
                isActive: true,
            },
        ]);
        mockPolyClient.wallets.getWalletActivity.mockResolvedValue({
            activities: [
                {
                    type: 'TRADE',
                    timestamp: NOW_SEC,
                    side: 'BUY',
                    size: 10,
                    price: 0.4,
                    asset: 'token-1',
                    conditionId: 'condition-1',
                    outcome: 'Yes',
                    slug: 'market-1',
                    transactionHash: '0xabc',
                },
            ],
        });
        mockPrisma.copyTrade.findUnique.mockResolvedValue({ id: 'existing-trade' });
        mockPrisma.copyTrade.create.mockResolvedValue({ id: 'created-trade' });
    });

    it('rejects unauthorized cron requests', async () => {
        mockVerifyCopyTradingCronAuthorizationHeader.mockReturnValue(false);

        const req = new NextRequest('http://localhost/api/copy-trading/detect', {
            method: 'POST',
        });

        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
    });

    it('uses originalTxHash-based idempotency lookup before insert', async () => {
        const req = new NextRequest('http://localhost/api/copy-trading/detect', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer test-secret',
            },
        });

        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.copyTradesCreated).toBe(0);
        expect(mockPrisma.copyTrade.create).not.toHaveBeenCalled();
        expect(mockPrisma.copyTrade.findUnique).toHaveBeenCalledWith({
            where: {
                configId_originalTxHash: {
                    configId: 'cfg-1',
                    originalTxHash: '0xabc:token-1:BUY',
                },
            },
            select: { id: true },
        });
    });
});
