import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const WALLET = '0x1111111111111111111111111111111111111111';

const {
    mockPrisma,
    mockResolveCopyTradingWalletContext,
    tradeStateRef,
    userPositionStateRef,
    mockServerExecutionService,
    MockTradingService,
    MockCopyTradingExecutionService,
    mockPendingTradesCache,
} = vi.hoisted(() => {
    process.env.TRADING_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945382dbd4f0d2be3951ad3e2b7b6b08d4408a';
    process.env.CHAIN_ID = '31337';

    const wallet = '0x1111111111111111111111111111111111111111';
    const baseConfig = {
        slippageType: 'FIXED',
        maxSlippage: 2,
    };

    const tradeStateRef = {
        current: {
            id: 'trade-1',
            status: 'PENDING',
            expiresAt: null as Date | null,
            tokenId: 'token-1',
            originalSide: 'BUY',
            copySize: 25,
            originalPrice: 0.42,
            marketSlug: 'market-1',
            errorMessage: null as string | null,
            txHash: null as string | null,
            executedAt: null as Date | null,
            usedBotFloat: false,
            executedBy: null as string | null,
            realizedPnL: null as number | null,
            config: baseConfig,
        },
    };

    const cloneTrade = () => ({
        ...tradeStateRef.current,
        config: { ...tradeStateRef.current.config },
    });

    const userPositionStateRef = {
        current: {
            id: 'position-1',
            walletAddress: wallet,
            tokenId: 'token-1',
            balance: 100,
            avgEntryPrice: 0.4,
            totalCost: 40,
            updatedAt: new Date('2026-03-06T00:00:00.000Z'),
        } as {
            id: string;
            walletAddress: string;
            tokenId: string;
            balance: number;
            avgEntryPrice: number;
            totalCost: number;
            updatedAt: Date;
        } | null,
    };

    const clonePosition = () => (userPositionStateRef.current ? { ...userPositionStateRef.current } : null);

    const copyTrade = {
        findFirst: vi.fn(async () => cloneTrade()),
        update: vi.fn(async ({ data }: any) => {
            tradeStateRef.current = {
                ...tradeStateRef.current,
                ...data,
            };
            return cloneTrade();
        }),
    };

    const userPosition = {
        findUnique: vi.fn(async () => clonePosition()),
        update: vi.fn(async ({ data }: any) => {
            if (!userPositionStateRef.current) {
                throw new Error('Position not found');
            }
            userPositionStateRef.current = {
                ...userPositionStateRef.current,
                ...data,
            };
            return clonePosition();
        }),
        create: vi.fn(async ({ data }: any) => {
            userPositionStateRef.current = {
                id: 'position-created',
                updatedAt: new Date('2026-03-06T00:00:00.000Z'),
                ...data,
            };
            return clonePosition();
        }),
    };

    const mockPrisma = {
        copyTrade,
        userPosition,
        $transaction: vi.fn(async (callback: any) => callback({
            copyTrade,
            userPosition,
        })),
    };

    const mockPendingTradesCache = {
        clear: vi.fn(),
        getOrSet: vi.fn(),
    };

    const mockServerExecutionService = {
        resolveProxyAddress: vi.fn(async () => '0x9999999999999999999999999999999999999999'),
        checkProxyAllowance: vi.fn(async () => ({ allowed: true })),
        executeOrderWithProxy: vi.fn(async () => ({
            success: true,
            orderId: 'server-order-1',
            transactionHashes: ['0xserver'],
            tokenPushTxHash: '0xtokenpush',
            executedAmount: 20,
            executionPrice: 0.5,
            usedBotFloat: false,
        })),
    };

    const MockTradingService = vi.fn().mockImplementation(() => ({
        initialize: vi.fn(async () => undefined),
        getOrderBook: vi.fn(async () => ({
            asks: [{ price: 0.5, size: 500 }],
            bids: [{ price: 0.499, size: 500 }],
        })),
    }));

    const MockCopyTradingExecutionService = vi.fn().mockImplementation(() => mockServerExecutionService);

    return {
        mockPrisma,
        mockResolveCopyTradingWalletContext: vi.fn(() => ({
            ok: true,
            wallet,
        })),
        tradeStateRef,
        userPositionStateRef,
        mockServerExecutionService,
        MockTradingService,
        MockCopyTradingExecutionService,
        mockPendingTradesCache,
    };
});

vi.mock('@/lib/prisma', () => ({
    prisma: mockPrisma,
    isDatabaseEnabled: true,
}));

vi.mock('@/lib/services/guardrail-service', () => ({
    GuardrailService: {
        checkExecutionGuardrails: vi.fn(async () => ({ allowed: true })),
        recordGuardrailTrigger: vi.fn(),
    },
}));

vi.mock('@/config/speed-profile', () => ({
    getSpeedProfile: () => ({
        maxSpreadBps: 200,
        minDepthUsd: 10,
        minDepthRatio: 1.5,
        depthLevels: 3,
    }),
}));

vi.mock('@/lib/server-cache', () => ({
    createTTLCache: () => mockPendingTradesCache,
}));

vi.mock('@/lib/copy-trading/request-wallet', () => ({
    resolveCopyTradingWalletContext: mockResolveCopyTradingWalletContext,
}));

vi.mock('@/lib/contracts/abis', () => ({
    PROXY_FACTORY_ABI: [],
    EXECUTOR_ABI: [],
    ERC20_ABI: [],
    CONTRACT_ADDRESSES: {
        polygon: { usdc: '0xusdc', executor: '0xexecutor', ctfContract: '0xctf' },
        amoy: { usdc: '0xusdc', executor: '0xexecutor', ctfContract: '0xctf' },
        localhost: { usdc: '0xusdc', executor: '0xexecutor', ctfContract: '0xctf' },
    },
    USDC_DECIMALS: 6,
}));

vi.mock('@catalyst-team/poly-sdk', () => ({
    TradingService: MockTradingService,
    RateLimiter: vi.fn(),
    createUnifiedCache: vi.fn(() => ({})),
    CopyTradingExecutionService: MockCopyTradingExecutionService,
}));

vi.mock('ethers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('ethers')>();
    const mockProvider = vi.fn(() => ({
        getBlockNumber: vi.fn(async () => 1),
    }));
    const mockWallet = vi.fn().mockImplementation(() => ({
        address: '0x2222222222222222222222222222222222222222',
        getAddress: vi.fn(async () => '0x2222222222222222222222222222222222222222'),
    }));

    return {
        ...actual,
        ethers: {
            ...actual.ethers,
            providers: {
                ...actual.ethers.providers,
                JsonRpcProvider: mockProvider,
            },
            Wallet: mockWallet,
        },
    };
});

import { POST } from './route';

function buildRequest(body: Record<string, unknown> = {}) {
    return new NextRequest('http://localhost/api/copy-trading/execute', {
        method: 'POST',
        body: JSON.stringify({
            tradeId: 'trade-1',
            walletAddress: WALLET,
            status: 'skipped',
            errorMessage: 'User skipped',
            executeOnServer: false,
            ...body,
        }),
        headers: {
            'content-type': 'application/json',
            'x-wallet-address': WALLET,
        },
    });
}

describe('POST /api/copy-trading/execute', () => {
    beforeEach(() => {
        tradeStateRef.current = {
            id: 'trade-1',
            status: 'PENDING',
            expiresAt: null,
            tokenId: 'token-1',
            originalSide: 'BUY',
            copySize: 25,
            originalPrice: 0.42,
            marketSlug: 'market-1',
            errorMessage: null,
            txHash: null,
            executedAt: null,
            usedBotFloat: false,
            executedBy: null,
            realizedPnL: null,
            config: {
                slippageType: 'FIXED',
                maxSlippage: 2,
            },
        };
        userPositionStateRef.current = {
            id: 'position-1',
            walletAddress: WALLET,
            tokenId: 'token-1',
            balance: 100,
            avgEntryPrice: 0.4,
            totalCost: 40,
            updatedAt: new Date('2026-03-06T00:00:00.000Z'),
        };

        vi.clearAllMocks();
        mockResolveCopyTradingWalletContext.mockReturnValue({
            ok: true,
            wallet: WALLET,
        });
        mockServerExecutionService.resolveProxyAddress.mockResolvedValue('0x9999999999999999999999999999999999999999');
        mockServerExecutionService.checkProxyAllowance.mockResolvedValue({ allowed: true });
        mockServerExecutionService.executeOrderWithProxy.mockResolvedValue({
            success: true,
            orderId: 'server-order-1',
            transactionHashes: ['0xserver'],
            tokenPushTxHash: '0xtokenpush',
            executedAmount: 20,
            executionPrice: 0.5,
            usedBotFloat: false,
        });
    });

    it('records realized pnl and reduces the user position for manual executed sells', async () => {
        tradeStateRef.current = {
            ...tradeStateRef.current,
            originalSide: 'SELL',
            copySize: 30,
            originalPrice: 0.5,
        };

        const response = await POST(buildRequest({
            status: 'executed',
            txHash: '0xselltx',
            executedAmount: 45,
            executedPrice: 0.6,
            filledShares: 75,
        }));

        expect(response.status).toBe(200);
        expect(tradeStateRef.current.status).toBe('EXECUTED');
        expect(tradeStateRef.current.realizedPnL).toBe(15);
        expect(tradeStateRef.current.copySize).toBe(45);
        expect((tradeStateRef.current as any).copyPrice).toBe(0.6);
        expect(userPositionStateRef.current?.balance).toBe(25);
        expect(userPositionStateRef.current?.totalCost).toBe(10);
        expect(userPositionStateRef.current?.avgEntryPrice).toBe(0.4);
        expect(mockPendingTradesCache.clear).toHaveBeenCalled();
    });

    it('creates a user position for manual executed buys', async () => {
        userPositionStateRef.current = null;
        tradeStateRef.current = {
            ...tradeStateRef.current,
            originalSide: 'BUY',
            copySize: 20,
            originalPrice: 0.5,
        };

        const response = await POST(buildRequest({
            status: 'executed',
            txHash: '0xbuytx',
            executedAmount: 20,
            executedPrice: 0.5,
        }));

        expect(response.status).toBe(200);
        expect(tradeStateRef.current.status).toBe('EXECUTED');
        expect(tradeStateRef.current.realizedPnL).toBeNull();
        expect(tradeStateRef.current.copySize).toBe(20);
        expect((tradeStateRef.current as any).copyPrice).toBe(0.5);
        expect(userPositionStateRef.current?.balance).toBe(40);
        expect(userPositionStateRef.current?.totalCost).toBe(20);
        expect(userPositionStateRef.current?.avgEntryPrice).toBe(0.5);
    });

    it('records the user position when server-side execution succeeds', async () => {
        userPositionStateRef.current = null;
        tradeStateRef.current = {
            ...tradeStateRef.current,
            originalSide: 'BUY',
            copySize: 20,
            originalPrice: 0.5,
        };

        const response = await POST(buildRequest({
            executeOnServer: true,
            orderMode: 'market',
            status: undefined,
            errorMessage: undefined,
        }));

        expect(response.status).toBe(200);
        expect(tradeStateRef.current.status).toBe('EXECUTED');
        expect(tradeStateRef.current.txHash).toBe('0xserver');
        expect(tradeStateRef.current.copySize).toBe(20);
        expect((tradeStateRef.current as any).copyPrice).toBe(0.5);
        expect(userPositionStateRef.current?.balance).toBe(40);
        expect(userPositionStateRef.current?.totalCost).toBe(20);
        expect(mockServerExecutionService.executeOrderWithProxy).toHaveBeenCalledTimes(1);
    });
});
