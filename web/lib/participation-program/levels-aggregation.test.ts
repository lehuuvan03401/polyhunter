import { describe, expect, it, vi } from 'vitest';
import { buildParticipationLevelProgress } from './levels';

describe('buildParticipationLevelProgress net-deposit aggregation', () => {
    it('aggregates deposit-withdraw and descendant team totals', async () => {
        const walletA = '0xabc0000000000000000000000000000000000001';
        const walletB = '0xabc0000000000000000000000000000000000002';

        const prisma = {
            referrer: {
                findMany: vi.fn().mockResolvedValue([
                    { id: 'referrer-a', walletAddress: walletA },
                ]),
            },
            teamClosure: {
                findMany: vi.fn().mockResolvedValue([
                    {
                        ancestorId: 'referrer-a',
                        descendant: {
                            walletAddress: walletB,
                        },
                    },
                ]),
            },
            netDepositLedger: {
                groupBy: vi.fn().mockResolvedValue([
                    {
                        walletAddress: walletA,
                        direction: 'DEPOSIT',
                        _sum: {
                            usdAmount: 200,
                            mcnEquivalentAmount: 200,
                        },
                    },
                    {
                        walletAddress: walletA,
                        direction: 'WITHDRAW',
                        _sum: {
                            usdAmount: 50,
                            mcnEquivalentAmount: 50,
                        },
                    },
                    {
                        walletAddress: walletB,
                        direction: 'DEPOSIT',
                        _sum: {
                            usdAmount: 500,
                            mcnEquivalentAmount: 500,
                        },
                    },
                ]),
            },
        };

        const rows = await buildParticipationLevelProgress(
            prisma as unknown as Parameters<typeof buildParticipationLevelProgress>[0],
            [walletA, walletB]
        );

        const rowA = rows.find((row) => row.walletAddress === walletA)!;
        const rowB = rows.find((row) => row.walletAddress === walletB)!;

        expect(rowA.selfNetDepositUsd).toBe(150);
        expect(rowA.teamNetDepositUsd).toBe(650);
        expect(rowA.directTeamWalletCount).toBe(1);

        expect(rowB.selfNetDepositUsd).toBe(500);
        expect(rowB.teamNetDepositUsd).toBe(500);
        expect(rowB.directTeamWalletCount).toBe(0);
    });

    it('supports negative net deposits after withdrawals', async () => {
        const wallet = '0xabc0000000000000000000000000000000000003';

        const prisma = {
            referrer: {
                findMany: vi.fn().mockResolvedValue([]),
            },
            teamClosure: {
                findMany: vi.fn().mockResolvedValue([]),
            },
            netDepositLedger: {
                groupBy: vi.fn().mockResolvedValue([
                    {
                        walletAddress: wallet,
                        direction: 'DEPOSIT',
                        _sum: {
                            usdAmount: 100,
                            mcnEquivalentAmount: 100,
                        },
                    },
                    {
                        walletAddress: wallet,
                        direction: 'WITHDRAW',
                        _sum: {
                            usdAmount: 220,
                            mcnEquivalentAmount: 220,
                        },
                    },
                ]),
            },
        };

        const [row] = await buildParticipationLevelProgress(
            prisma as unknown as Parameters<typeof buildParticipationLevelProgress>[0],
            [wallet]
        );

        expect(row.selfNetDepositUsd).toBe(-120);
        expect(row.teamNetDepositUsd).toBe(-120);
    });
});
