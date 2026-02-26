import { describe, expect, it, vi } from 'vitest';
import { AffiliateEngine } from './affiliate-engine';

type MockPrisma = {
    referral: {
        findUnique: ReturnType<typeof vi.fn>;
    };
    commissionLog: {
        findFirst: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
};

function createEngineMock(): {
    prisma: MockPrisma;
    tx: {
        referrer: { update: ReturnType<typeof vi.fn> };
        commissionLog: { create: ReturnType<typeof vi.fn> };
        sameLevelBonusSettlement: { create: ReturnType<typeof vi.fn> };
    };
    engine: AffiliateEngine;
} {
    const tx = {
        referrer: { update: vi.fn().mockResolvedValue({}) },
        commissionLog: { create: vi.fn().mockResolvedValue({}) },
        sameLevelBonusSettlement: { create: vi.fn().mockResolvedValue({}) },
    };

    const prisma: MockPrisma = {
        referral: {
            findUnique: vi.fn(),
        },
        commissionLog: {
            findFirst: vi.fn().mockResolvedValue(null),
        },
        $transaction: vi.fn().mockImplementation(async (callback: (txArg: typeof tx) => unknown) => callback(tx)),
    };

    const engine = new AffiliateEngine(prisma as unknown as ConstructorParameters<typeof AffiliateEngine>[0]);
    return { prisma, tx, engine };
}

describe('AffiliateEngine.distributeProfitFee', () => {
    it('skips all persistence when realized profit is not positive', async () => {
        const { prisma, engine } = createEngineMock();

        await engine.distributeProfitFee('0xabc0000000000000000000000000000000000001', 0, 'trade-1');

        expect(prisma.referral.findUnique).not.toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('skips fee distribution when trader has no referrer', async () => {
        const { prisma, engine } = createEngineMock();
        prisma.referral.findUnique.mockResolvedValue(null);

        await engine.distributeProfitFee('0xabc0000000000000000000000000000000000001', 100, 'trade-1');

        expect(prisma.referral.findUnique).toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('charges fixed 20% fee on realized profit', async () => {
        const { prisma, tx, engine } = createEngineMock();
        const traderWallet = '0xabc0000000000000000000000000000000000001';

        prisma.referral.findUnique.mockImplementation(async (args: { where: { refereeAddress: string } }) => {
            if (args.where.refereeAddress === traderWallet.toLowerCase()) {
                return {
                    id: 'referral-1',
                    referrerId: 'referrer-1',
                    referrer: {
                        id: 'referrer-1',
                        walletAddress: '0xabc0000000000000000000000000000000000002',
                    },
                };
            }
            return null;
        });

        await engine.distributeProfitFee(traderWallet, 125, 'trade-1');

        expect(tx.referrer.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'referrer-1' },
                data: {
                    totalEarned: { increment: 25 },
                    pendingPayout: { increment: 25 },
                },
            })
        );
        expect(tx.commissionLog.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    referrerId: 'referrer-1',
                    amount: 25,
                    type: 'PROFIT_FEE',
                    sourceTradeId: 'trade-1',
                    sourceUserId: traderWallet,
                }),
            })
        );
    });

    it('skips duplicate profit-fee settlement for same trade scope', async () => {
        const { prisma, engine } = createEngineMock();
        const traderWallet = '0xabc0000000000000000000000000000000000001';

        prisma.referral.findUnique.mockResolvedValue({
            id: 'referral-1',
            referrerId: 'referrer-1',
            referrer: {
                id: 'referrer-1',
                walletAddress: '0xabc0000000000000000000000000000000000002',
            },
        });
        prisma.commissionLog.findFirst.mockResolvedValue({
            id: 'existing-profit-fee',
        });

        await engine.distributeProfitFee(traderWallet, 125, 'trade-dup');

        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});
