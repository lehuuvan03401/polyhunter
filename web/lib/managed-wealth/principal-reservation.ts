import type { PrismaClient } from '@prisma/client';

const ACTIVE_MANAGED_RESERVATION_STATUSES = ['PENDING', 'RUNNING', 'MATURED', 'LIQUIDATING'] as const;

type ReservationDb = Pick<
    PrismaClient,
    'netDepositLedger' | 'managedPrincipalReservationLedger' | 'managedSubscription'
>;

export type ManagedPrincipalAvailability = {
    managedQualifiedBalance: number;
    reservedBalance: number;
    reservedFromLedger: number;
    reservedFromActiveSubscriptions: number;
    availableBalance: number;
};

export class ManagedPrincipalAvailabilityError extends Error {
    code: string;
    details: ManagedPrincipalAvailability;
    requestedPrincipal: number;

    constructor(requestedPrincipal: number, details: ManagedPrincipalAvailability) {
        super('Managed principal reservation balance is insufficient');
        this.code = 'MANAGED_PRINCIPAL_RESERVATION_INSUFFICIENT';
        this.details = details;
        this.requestedPrincipal = requestedPrincipal;
    }
}

function round(value: number): number {
    return Number(value.toFixed(8));
}

export async function getManagedPrincipalAvailability(
    db: ReservationDb,
    walletAddress: string
): Promise<ManagedPrincipalAvailability> {
    const normalizedWallet = walletAddress.toLowerCase();

    const [depositAgg, withdrawAgg, reserveAgg, releaseAgg, activeSubscriptionAgg] = await Promise.all([
        db.netDepositLedger.aggregate({
            where: {
                walletAddress: normalizedWallet,
                direction: 'DEPOSIT',
            },
            _sum: {
                mcnEquivalentAmount: true,
            },
        }),
        db.netDepositLedger.aggregate({
            where: {
                walletAddress: normalizedWallet,
                direction: 'WITHDRAW',
            },
            _sum: {
                mcnEquivalentAmount: true,
            },
        }),
        db.managedPrincipalReservationLedger.aggregate({
            where: {
                walletAddress: normalizedWallet,
                entryType: 'RESERVE',
            },
            _sum: {
                amount: true,
            },
        }),
        db.managedPrincipalReservationLedger.aggregate({
            where: {
                walletAddress: normalizedWallet,
                entryType: 'RELEASE',
            },
            _sum: {
                amount: true,
            },
        }),
        db.managedSubscription.aggregate({
            where: {
                walletAddress: normalizedWallet,
                status: { in: [...ACTIVE_MANAGED_RESERVATION_STATUSES] },
            },
            _sum: {
                principal: true,
            },
        }),
    ]);

    const managedQualifiedBalance =
        Number(depositAgg._sum.mcnEquivalentAmount ?? 0) - Number(withdrawAgg._sum.mcnEquivalentAmount ?? 0);

    const reservedFromLedger =
        Number(reserveAgg._sum.amount ?? 0) - Number(releaseAgg._sum.amount ?? 0);

    const reservedFromActiveSubscriptions = Number(activeSubscriptionAgg._sum.principal ?? 0);

    const reservedBalance = Math.max(0, round(Math.max(reservedFromLedger, reservedFromActiveSubscriptions)));
    const availableBalance = round(managedQualifiedBalance - reservedBalance);

    return {
        managedQualifiedBalance: round(managedQualifiedBalance),
        reservedBalance,
        reservedFromLedger: round(reservedFromLedger),
        reservedFromActiveSubscriptions: round(reservedFromActiveSubscriptions),
        availableBalance,
    };
}

export async function assertManagedPrincipalAvailability(
    db: ReservationDb,
    walletAddress: string,
    requestedPrincipal: number
): Promise<ManagedPrincipalAvailability> {
    const availability = await getManagedPrincipalAvailability(db, walletAddress);
    if (availability.availableBalance + 1e-8 < requestedPrincipal) {
        throw new ManagedPrincipalAvailabilityError(requestedPrincipal, availability);
    }
    return availability;
}

export async function reserveManagedPrincipal(
    db: ReservationDb,
    input: {
        walletAddress: string;
        subscriptionId: string;
        amount: number;
        snapshot: ManagedPrincipalAvailability;
        note?: string;
    }
): Promise<void> {
    const normalizedWallet = input.walletAddress.toLowerCase();
    const amount = round(input.amount);
    const nextReserved = round(input.snapshot.reservedBalance + amount);
    const nextAvailable = round(input.snapshot.managedQualifiedBalance - nextReserved);

    await db.managedPrincipalReservationLedger.upsert({
        where: {
            idempotencyKey: `managed-reservation:reserve:${input.subscriptionId}`,
        },
        update: {
            walletAddress: normalizedWallet,
            subscriptionId: input.subscriptionId,
            entryType: 'RESERVE',
            amount,
            managedQualifiedBalance: input.snapshot.managedQualifiedBalance,
            reservedBalanceAfter: nextReserved,
            availableBalanceAfter: nextAvailable,
            note: input.note ?? 'MANAGED_SUBSCRIPTION_CREATED',
        },
        create: {
            walletAddress: normalizedWallet,
            subscriptionId: input.subscriptionId,
            entryType: 'RESERVE',
            amount,
            idempotencyKey: `managed-reservation:reserve:${input.subscriptionId}`,
            managedQualifiedBalance: input.snapshot.managedQualifiedBalance,
            reservedBalanceAfter: nextReserved,
            availableBalanceAfter: nextAvailable,
            note: input.note ?? 'MANAGED_SUBSCRIPTION_CREATED',
        },
    });
}

export async function releaseManagedPrincipalReservation(
    db: ReservationDb,
    input: {
        walletAddress: string;
        subscriptionId: string;
        amount: number;
        note?: string;
    }
): Promise<{ status: 'RELEASED' | 'SKIPPED_NO_RESERVE' | 'SKIPPED_ALREADY_RELEASED' }> {
    const normalizedWallet = input.walletAddress.toLowerCase();

    const reserveEntry = await db.managedPrincipalReservationLedger.findFirst({
        where: {
            subscriptionId: input.subscriptionId,
            entryType: 'RESERVE',
        },
        select: {
            id: true,
        },
    });

    if (!reserveEntry) {
        return {
            status: 'SKIPPED_NO_RESERVE',
        };
    }

    const existingRelease = await db.managedPrincipalReservationLedger.findFirst({
        where: {
            idempotencyKey: `managed-reservation:release:${input.subscriptionId}`,
        },
        select: {
            id: true,
        },
    });

    if (existingRelease) {
        return {
            status: 'SKIPPED_ALREADY_RELEASED',
        };
    }

    const availability = await getManagedPrincipalAvailability(db, normalizedWallet);
    const releaseAmount = round(Math.min(input.amount, availability.reservedBalance));
    const nextReserved = round(Math.max(0, availability.reservedBalance - releaseAmount));
    const nextAvailable = round(availability.managedQualifiedBalance - nextReserved);

    await db.managedPrincipalReservationLedger.create({
        data: {
            walletAddress: normalizedWallet,
            subscriptionId: input.subscriptionId,
            entryType: 'RELEASE',
            amount: releaseAmount,
            idempotencyKey: `managed-reservation:release:${input.subscriptionId}`,
            managedQualifiedBalance: availability.managedQualifiedBalance,
            reservedBalanceAfter: nextReserved,
            availableBalanceAfter: nextAvailable,
            note: input.note ?? 'MANAGED_SUBSCRIPTION_SETTLED',
        },
    });

    return {
        status: 'RELEASED',
    };
}
