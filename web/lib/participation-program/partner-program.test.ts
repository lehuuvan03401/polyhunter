import { NextRequest } from 'next/server';
import { ethers } from 'ethers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildManagedWalletAuthMessage } from '@/lib/managed-wealth/wallet-auth-message';
import {
    DEFAULT_PARTNER_MAX_SEATS,
    comparePartnerSeatEliminationOrder,
    computeRefundDeadline,
    derivePartnerPrivileges,
    ensurePartnerProgramConfig,
    isAdminRequest,
    normalizeWalletAddress,
    parseMonthKey,
    pickEliminationCandidates,
    resolvePartnerSeatFeeUsd,
    toMonthKey,
    buildPartnerSeatRanking,
} from './partner-program';

describe('partner program helpers', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('formats month key in UTC', () => {
        const date = new Date('2026-02-25T12:34:56.000Z');
        expect(toMonthKey(date)).toBe('2026-02');
    });

    it('parses valid month key', () => {
        const parsed = parseMonthKey('2026-02');
        expect(parsed.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    });

    it('rejects invalid month key format', () => {
        expect(() => parseMonthKey('2026-2')).toThrow();
    });

    it('computes refund deadline as 7 calendar days', () => {
        const eliminatedAt = new Date('2026-02-01T00:00:00.000Z');
        const deadline = computeRefundDeadline(eliminatedAt);
        expect(deadline.toISOString()).toBe('2026-02-08T00:00:00.000Z');
    });

    it('normalizes valid wallet and rejects invalid wallet', () => {
        expect(normalizeWalletAddress('0xAbC1230000000000000000000000000000000000')).toBe(
            '0xabc1230000000000000000000000000000000000'
        );
        expect(normalizeWalletAddress('abc')).toBeNull();
    });

    it('derives partner privileges from active seat', () => {
        expect(
            derivePartnerPrivileges({
                status: 'ACTIVE',
                privilegeLevel: 'V5',
                backendAccess: true,
            })
        ).toEqual({
            isPartner: true,
            partnerLevel: 'V5',
            backendAccess: true,
            partnerConsoleAccess: true,
        });
    });

    it('returns no privileges for non-active seat', () => {
        expect(
            derivePartnerPrivileges({
                status: 'ELIMINATED',
                privilegeLevel: 'V5',
                backendAccess: true,
            })
        ).toEqual({
            isPartner: false,
            partnerLevel: null,
            backendAccess: false,
            partnerConsoleAccess: false,
        });
    });

    it('normalizes partner config seat cap to immutable value', async () => {
        const upsert = vi.fn().mockResolvedValue({
            id: 'GLOBAL',
            maxSeats: DEFAULT_PARTNER_MAX_SEATS,
            refillPriceUsd: 0,
        });
        const prismaMock = {
            partnerProgramConfig: {
                upsert,
            },
        };

        await ensurePartnerProgramConfig(prismaMock as any);

        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'GLOBAL' },
                update: { maxSeats: DEFAULT_PARTNER_MAX_SEATS },
                create: expect.objectContaining({
                    id: 'GLOBAL',
                    maxSeats: DEFAULT_PARTNER_MAX_SEATS,
                }),
            })
        );
    });

    it('uses configured refill fee and rejects caller-provided mismatched seat fee', () => {
        expect(
            resolvePartnerSeatFeeUsd({
                configuredSeatFeeUsd: 1200,
            })
        ).toEqual({
            ok: true,
            seatFeeUsd: 1200,
        });

        expect(
            resolvePartnerSeatFeeUsd({
                configuredSeatFeeUsd: 1200,
                requestedSeatFeeUsd: 1000,
            })
        ).toEqual({
            ok: false,
            code: 'SEAT_FEE_MISMATCH',
            expectedSeatFeeUsd: 1200,
            providedSeatFeeUsd: 1000,
        });
    });

    it('selects elimination candidates using the inverse of ranking tie-breakers', () => {
        const ranking = [
            {
                id: 'seat-best',
                walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                joinedAt: new Date('2026-01-01T00:00:00.000Z'),
                scoreNetDepositUsd: 100,
                scoreActiveManagedUsd: 500,
            },
            {
                id: 'seat-worse-managed',
                walletAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                joinedAt: new Date('2026-01-01T00:00:00.000Z'),
                scoreNetDepositUsd: 100,
                scoreActiveManagedUsd: 100,
            },
            {
                id: 'seat-worst-net',
                walletAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
                joinedAt: new Date('2026-01-01T00:00:00.000Z'),
                scoreNetDepositUsd: 10,
                scoreActiveManagedUsd: 0,
            },
        ];

        const candidates = pickEliminationCandidates(ranking, 2);
        expect(candidates.map((row) => row.id)).toEqual(['seat-worst-net', 'seat-worse-managed']);
        expect(comparePartnerSeatEliminationOrder(candidates[0], candidates[1])).toBeLessThan(0);
    });

    it('rejects unsigned admin request when signature is required', () => {
        const signer = ethers.Wallet.createRandom();
        vi.stubEnv('ADMIN_WALLETS', signer.address.toLowerCase());
        vi.stubEnv('PARTNER_ADMIN_REQUIRE_SIGNATURE', 'true');

        const request = new NextRequest('http://localhost/api/partners/config', {
            method: 'POST',
            headers: {
                'x-admin-wallet': signer.address.toLowerCase(),
            },
        });

        expect(isAdminRequest(request)).toBe(false);
    });

    it('accepts signed admin request when signature is required', async () => {
        const signer = ethers.Wallet.createRandom();
        const walletAddress = signer.address.toLowerCase();
        const timestamp = Date.now();
        const path = '/api/partners/config';
        vi.stubEnv('ADMIN_WALLETS', walletAddress);
        vi.stubEnv('PARTNER_ADMIN_REQUIRE_SIGNATURE', 'true');

        const signature = await signer.signMessage(
            buildManagedWalletAuthMessage({
                walletAddress,
                method: 'POST',
                pathWithQuery: path,
                timestamp,
            })
        );

        const request = new NextRequest(`http://localhost${path}`, {
            method: 'POST',
            headers: {
                'x-admin-wallet': walletAddress,
                'x-wallet-signature': signature,
                'x-wallet-timestamp': String(timestamp),
            },
        });

        expect(isAdminRequest(request)).toBe(true);
    });

    describe('buildPartnerSeatRanking', () => {
        it('sorts by scoreNetDepositUsd, then scoreActiveManagedUsd, then joinedAt', async () => {
            const seats = [
                { id: '1', walletAddress: '0xaaa', seatFeeUsd: 100, joinedAt: new Date('2026-01-01T00:00:00Z') },
                { id: '2', walletAddress: '0xbbb', seatFeeUsd: 100, joinedAt: new Date('2026-01-02T00:00:00Z') }, // Same deposit, same managed, later join
                { id: '3', walletAddress: '0xccc', seatFeeUsd: 100, joinedAt: new Date('2026-01-01T00:00:00Z') }, // Same deposit, higher managed
                { id: '4', walletAddress: '0xddd', seatFeeUsd: 100, joinedAt: new Date('2026-01-01T00:00:00Z') }, // Highest deposit
            ];

            const prismaMock = {
                dailyLevelSnapshot: {
                    findMany: vi.fn().mockResolvedValue([
                        { walletAddress: '0xaaa', teamNetDepositUsd: 100, selfNetDepositUsd: 0 },
                        { walletAddress: '0xbbb', teamNetDepositUsd: 100, selfNetDepositUsd: 0 },
                        { walletAddress: '0xccc', teamNetDepositUsd: 100, selfNetDepositUsd: 0 },
                        { walletAddress: '0xddd', teamNetDepositUsd: 500, selfNetDepositUsd: 0 },
                    ]),
                },
                managedSubscription: {
                    findMany: vi.fn().mockResolvedValue([
                        { walletAddress: '0xaaa', currentEquity: 50, principal: 50 },
                        { walletAddress: '0xbbb', currentEquity: 50, principal: 50 },
                        { walletAddress: '0xccc', currentEquity: 200, principal: 200 },
                        { walletAddress: '0xddd', currentEquity: 0, principal: 0 },
                    ]),
                },
            };

            const ranked = await buildPartnerSeatRanking(prismaMock as any, seats);

            expect(ranked.length).toBe(4);

            // 1st: 0xddd (Highest deposit = 500)
            expect(ranked[0].walletAddress).toBe('0xddd');
            expect(ranked[0].scoreNetDepositUsd).toBe(500);
            expect(ranked[0].scoreActiveManagedUsd).toBe(0);
            expect(ranked[0].rank).toBe(1);

            // 2nd: 0xccc (Deposit = 100, Highest managed = 200)
            expect(ranked[1].walletAddress).toBe('0xccc');
            expect(ranked[1].scoreNetDepositUsd).toBe(100);
            expect(ranked[1].scoreActiveManagedUsd).toBe(200);
            expect(ranked[1].rank).toBe(2);

            // 3rd: 0xaaa (Deposit = 100, Managed = 50, Earlier join)
            expect(ranked[2].walletAddress).toBe('0xaaa');
            expect(ranked[2].scoreNetDepositUsd).toBe(100);
            expect(ranked[2].scoreActiveManagedUsd).toBe(50);
            expect(ranked[2].rank).toBe(3);

            // 4th: 0xbbb (Deposit = 100, Managed = 50, Later join)
            expect(ranked[3].walletAddress).toBe('0xbbb');
            expect(ranked[3].scoreNetDepositUsd).toBe(100);
            expect(ranked[3].scoreActiveManagedUsd).toBe(50);
            expect(ranked[3].rank).toBe(4);
        });
        
        it('returns empty array if no seats provided', async () => {
            const prismaMock = {
                dailyLevelSnapshot: {
                    findMany: vi.fn(),
                },
                managedSubscription: {
                    findMany: vi.fn(),
                },
            };
            
            const ranked = await buildPartnerSeatRanking(prismaMock as any, []);
            expect(ranked).toEqual([]);
            expect(prismaMock.dailyLevelSnapshot.findMany).not.toHaveBeenCalled();
            expect(prismaMock.managedSubscription.findMany).not.toHaveBeenCalled();
        });

        it('uses month-bounded snapshots when monthKey is provided', async () => {
            const seats = [
                {
                    id: '1',
                    walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                    seatFeeUsd: 100,
                    joinedAt: new Date('2026-01-01T00:00:00.000Z'),
                },
            ];
            const findSnapshots = vi.fn().mockResolvedValue([
                {
                    walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                    teamNetDepositUsd: 300,
                    selfNetDepositUsd: 0,
                },
            ]);
            const prismaMock = {
                dailyLevelSnapshot: {
                    findMany: findSnapshots,
                },
                managedSubscription: {
                    findMany: vi.fn().mockResolvedValue([]),
                },
            };

            const ranked = await buildPartnerSeatRanking(prismaMock as any, seats, {
                monthKey: '2026-02',
            });

            expect(ranked[0].scoreNetDepositUsd).toBe(300);
            const query = findSnapshots.mock.calls[0][0];
            expect(query.where.snapshotDate.gte.toISOString()).toBe('2026-02-01T00:00:00.000Z');
            expect(query.where.snapshotDate.lt.toISOString()).toBe('2026-03-01T00:00:00.000Z');
        });
    });
});
