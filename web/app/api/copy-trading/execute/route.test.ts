import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const WALLET = '0x1111111111111111111111111111111111111111';

const {
    mockPrisma,
    mockResolveCopyTradingWalletContext,
    tradeStateRef,
} = vi.hoisted(() => {
    const baseConfig = {
        slippageType: 'FIXED',
        maxSlippage: 2,
    };

    const tradeStateRef = {
        current: {
            id: 'trade-1',
            status: 'PENDING',
            lockedAt: null as Date | null,
            lockedBy: null as string | null,
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
            config: baseConfig,
        },
    };

    const cloneTrade = () => ({
        ...tradeStateRef.current,
        config: { ...tradeStateRef.current.config },
    });

    const copyTrade = {
        findFirst: vi.fn(async () => cloneTrade()),
        findUnique: vi.fn(async () => cloneTrade()),
        updateMany: vi.fn(async ({ where, data }: any) => {
            const state = tradeStateRef.current;

            if (where?.status === 'PENDING') {
                if (state.status === 'PENDING' && !state.lockedBy) {
                    tradeStateRef.current = {
                        ...state,
                        ...data,
                    };
                    return { count: 1 };
                }
                return { count: 0 };
            }

            if (where?.lockedBy) {
                if (state.lockedBy === where.lockedBy) {
                    tradeStateRef.current = {
                        ...state,
                        ...data,
                    };
                    return { count: 1 };
                }
                return { count: 0 };
            }

            return { count: 0 };
        }),
    };

    return {
        mockPrisma: {
            copyTrade,
        },
        mockResolveCopyTradingWalletContext: vi.fn(() => ({
            ok: true,
            wallet: WALLET,
        })),
        tradeStateRef,
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

vi.mock('@/lib/copy-trading/request-wallet', () => ({
    resolveCopyTradingWalletContext: mockResolveCopyTradingWalletContext,
}));

import { POST } from './route';

function buildRequest() {
    return new NextRequest('http://localhost/api/copy-trading/execute', {
        method: 'POST',
        body: JSON.stringify({
            tradeId: 'trade-1',
            walletAddress: WALLET,
            status: 'skipped',
            errorMessage: 'User skipped',
            executeOnServer: false,
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
            lockedAt: null,
            lockedBy: null,
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
            config: {
                slippageType: 'FIXED',
                maxSlippage: 2,
            },
        };
        vi.clearAllMocks();
        mockResolveCopyTradingWalletContext.mockReturnValue({
            ok: true,
            wallet: WALLET,
        });
    });

    it('allows only one claimant when two requests race for the same pending trade', async () => {
        const [first, second] = await Promise.all([
            POST(buildRequest()),
            POST(buildRequest()),
        ]);

        const firstBody = await first.json();
        const secondBody = await second.json();

        const statuses = [first.status, second.status].sort((a, b) => a - b);
        expect(statuses).toEqual([200, 409]);

        const bodies = [firstBody, secondBody];
        expect(bodies.some((body) => body.success === true)).toBe(true);
        expect(bodies.some((body) => body.error === 'Trade is already claimed or not pending')).toBe(true);

        expect(tradeStateRef.current.status).toBe('SKIPPED');
        expect(tradeStateRef.current.lockedBy).toBeNull();
        expect(tradeStateRef.current.lockedAt).toBeNull();
    });
});
