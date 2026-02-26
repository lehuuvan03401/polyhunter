import { describe, expect, it, vi } from 'vitest';
import {
    assertManagedPrincipalAvailability,
    getManagedPrincipalAvailability,
    ManagedPrincipalAvailabilityError,
    releaseManagedPrincipalReservation,
    reserveManagedPrincipal,
} from './principal-reservation';

function createDb(overrides?: Record<string, unknown>) {
    return {
        netDepositLedger: {
            aggregate: vi.fn()
                .mockResolvedValueOnce({ _sum: { mcnEquivalentAmount: 1200 } })
                .mockResolvedValueOnce({ _sum: { mcnEquivalentAmount: 100 } }),
        },
        managedPrincipalReservationLedger: {
            aggregate: vi.fn()
                .mockResolvedValueOnce({ _sum: { amount: 200 } })
                .mockResolvedValueOnce({ _sum: { amount: 50 } }),
            upsert: vi.fn().mockResolvedValue({}),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({}),
        },
        managedSubscription: {
            aggregate: vi.fn().mockResolvedValue({ _sum: { principal: 500 } }),
        },
        ...overrides,
    } as any;
}

describe('managed principal reservation', () => {
    it('calculates availability with active-subscription fallback over ledger sums', async () => {
        const db = createDb();

        const result = await getManagedPrincipalAvailability(db, '0xabc');

        expect(result.managedQualifiedBalance).toBe(1100);
        expect(result.reservedFromLedger).toBe(150);
        expect(result.reservedFromActiveSubscriptions).toBe(500);
        expect(result.reservedBalance).toBe(500);
        expect(result.availableBalance).toBe(600);
    });

    it('throws detailed availability error when requested principal exceeds available', async () => {
        const db = createDb();

        await expect(assertManagedPrincipalAvailability(db, '0xabc', 700)).rejects.toMatchObject({
            code: 'MANAGED_PRINCIPAL_RESERVATION_INSUFFICIENT',
            requestedPrincipal: 700,
        });
    });

    it('writes reserve ledger snapshot', async () => {
        const db = createDb();

        await reserveManagedPrincipal(db, {
            walletAddress: '0xabc',
            subscriptionId: 'sub-1',
            amount: 300,
            snapshot: {
                managedQualifiedBalance: 1100,
                reservedBalance: 500,
                reservedFromLedger: 150,
                reservedFromActiveSubscriptions: 500,
                availableBalance: 600,
            },
            note: 'TEST_RESERVE',
        });

        expect(db.managedPrincipalReservationLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                idempotencyKey: 'managed-reservation:reserve:sub-1',
            },
            create: expect.objectContaining({
                entryType: 'RESERVE',
                amount: 300,
                reservedBalanceAfter: 800,
                availableBalanceAfter: 300,
            }),
        }));
    });

    it('releases reservation when reserve exists and no prior release', async () => {
        const netAggregate = vi.fn()
            .mockResolvedValueOnce({ _sum: { mcnEquivalentAmount: 1200 } })
            .mockResolvedValueOnce({ _sum: { mcnEquivalentAmount: 100 } });
        const ledgerAggregate = vi.fn()
            .mockResolvedValueOnce({ _sum: { amount: 300 } })
            .mockResolvedValueOnce({ _sum: { amount: 50 } });

        const db = createDb({
            netDepositLedger: {
                aggregate: netAggregate,
            },
            managedPrincipalReservationLedger: {
                aggregate: ledgerAggregate,
                findFirst: vi.fn()
                    .mockResolvedValueOnce({ id: 'reserve-row' })
                    .mockResolvedValueOnce(null),
                create: vi.fn().mockResolvedValue({}),
            },
            managedSubscription: {
                aggregate: vi.fn().mockResolvedValue({ _sum: { principal: 250 } }),
            },
        });

        const result = await releaseManagedPrincipalReservation(db, {
            walletAddress: '0xabc',
            subscriptionId: 'sub-1',
            amount: 250,
            note: 'TEST_RELEASE',
        });

        expect(result.status).toBe('RELEASED');
        expect(db.managedPrincipalReservationLedger.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                entryType: 'RELEASE',
                amount: 250,
                idempotencyKey: 'managed-reservation:release:sub-1',
            }),
        }));
    });

    it('skips release when no reserve entry exists', async () => {
        const db = createDb({
            managedPrincipalReservationLedger: {
                aggregate: vi.fn(),
                findFirst: vi.fn().mockResolvedValue(null),
                create: vi.fn(),
            },
        });

        const result = await releaseManagedPrincipalReservation(db, {
            walletAddress: '0xabc',
            subscriptionId: 'sub-1',
            amount: 100,
        });

        expect(result.status).toBe('SKIPPED_NO_RESERVE');
        expect(db.managedPrincipalReservationLedger.create).not.toHaveBeenCalled();
    });

    it('exposes typed error class for route handling', () => {
        const error = new ManagedPrincipalAvailabilityError(900, {
            managedQualifiedBalance: 800,
            reservedBalance: 300,
            reservedFromLedger: 300,
            reservedFromActiveSubscriptions: 300,
            availableBalance: 500,
        });

        expect(error.code).toBe('MANAGED_PRINCIPAL_RESERVATION_INSUFFICIENT');
    });
});
