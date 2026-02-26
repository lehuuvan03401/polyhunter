import { describe, expect, it, vi } from 'vitest';
import {
    DEFAULT_PARTNER_MAX_SEATS,
    computeRefundDeadline,
    derivePartnerPrivileges,
    ensurePartnerProgramConfig,
    normalizeWalletAddress,
    parseMonthKey,
    toMonthKey,
} from './partner-program';

describe('partner program helpers', () => {
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
});
