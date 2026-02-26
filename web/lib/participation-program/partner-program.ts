import type { PrismaClient } from '@prisma/client';
import type { NextRequest } from 'next/server';

export const DEFAULT_PARTNER_MAX_SEATS = 100;
export const MONTHLY_ELIMINATION_COUNT = 10;
export const REFUND_SLA_DAYS = 7;
export const DEFAULT_PARTNER_PRIVILEGE_LEVEL = 'V5';

const MONTH_KEY_REGEX = /^\d{4}-\d{2}$/;
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function toMonthKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

export function parseMonthKey(input: string): Date {
    if (!MONTH_KEY_REGEX.test(input)) {
        throw new Error(`Invalid month key: ${input}`);
    }
    const [yearRaw, monthRaw] = input.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error(`Invalid month key: ${input}`);
    }
    return new Date(Date.UTC(year, month - 1, 1));
}

export function computeRefundDeadline(eliminatedAt: Date): Date {
    return new Date(eliminatedAt.getTime() + REFUND_SLA_DAYS * 24 * 60 * 60 * 1000);
}

export async function ensurePartnerProgramConfig(prisma: PrismaClient) {
    return prisma.partnerProgramConfig.upsert({
        where: { id: 'GLOBAL' },
        update: {
            // Policy invariant: global partner seats are permanently capped at 100.
            maxSeats: DEFAULT_PARTNER_MAX_SEATS,
        },
        create: {
            id: 'GLOBAL',
            maxSeats: DEFAULT_PARTNER_MAX_SEATS,
            refillPriceUsd: 0,
        },
    });
}

export async function getActiveSeatCount(prisma: PrismaClient): Promise<number> {
    return prisma.partnerSeat.count({
        where: { status: 'ACTIVE' },
    });
}

export async function getSeatScoreMap(
    prisma: PrismaClient,
    walletAddresses: string[]
): Promise<Map<string, number>> {
    const wallets = Array.from(
        new Set(walletAddresses.map((wallet) => wallet.toLowerCase().trim()).filter(Boolean))
    );
    const map = new Map<string, number>();

    if (wallets.length === 0) {
        return map;
    }

    const latestSnapshots = await prisma.dailyLevelSnapshot.findMany({
        where: { walletAddress: { in: wallets } },
        orderBy: [{ walletAddress: 'asc' }, { snapshotDate: 'desc' }],
        distinct: ['walletAddress'],
        select: {
            walletAddress: true,
            teamNetDepositUsd: true,
            selfNetDepositUsd: true,
        },
    });

    for (const wallet of wallets) {
        map.set(wallet, 0);
    }

    for (const snapshot of latestSnapshots) {
        const score = Number(
            (snapshot.teamNetDepositUsd + snapshot.selfNetDepositUsd * 0.000001).toFixed(8)
        );
        map.set(snapshot.walletAddress.toLowerCase(), score);
    }

    return map;
}

export type PartnerSeatForRanking = {
    id: string;
    walletAddress: string;
    seatFeeUsd: number;
    joinedAt: Date;
};

export type RankedPartnerSeat = PartnerSeatForRanking & {
    rank: number;
    scoreNetDepositUsd: number;
};

export async function buildPartnerSeatRanking(
    prisma: PrismaClient,
    seats: PartnerSeatForRanking[]
): Promise<RankedPartnerSeat[]> {
    if (seats.length === 0) {
        return [];
    }

    const scoreMap = await getSeatScoreMap(
        prisma,
        seats.map((seat) => seat.walletAddress)
    );

    return seats
        .map((seat) => ({
            ...seat,
            scoreNetDepositUsd: Number(scoreMap.get(seat.walletAddress.toLowerCase()) ?? 0),
        }))
        .sort((a, b) => {
            if (b.scoreNetDepositUsd !== a.scoreNetDepositUsd) {
                return b.scoreNetDepositUsd - a.scoreNetDepositUsd;
            }
            if (a.joinedAt.getTime() !== b.joinedAt.getTime()) {
                return a.joinedAt.getTime() - b.joinedAt.getTime();
            }
            return a.walletAddress.localeCompare(b.walletAddress);
        })
        .map((seat, index) => ({
            ...seat,
            rank: index + 1,
        }));
}

export function resolveAdminWallets(): string[] {
    return (process.env.ADMIN_WALLETS || '')
        .split(',')
        .map((wallet) => wallet.toLowerCase().trim())
        .filter(Boolean);
}

export function isAdminRequest(request: NextRequest): boolean {
    const adminWallets = resolveAdminWallets();
    const adminWallet = request.headers.get('x-admin-wallet');
    if (process.env.NODE_ENV === 'development' && adminWallets.length === 0) {
        console.warn('[PartnerProgram] Admin auth bypassed in development mode');
        return true;
    }
    if (!adminWallet) return false;
    return adminWallets.includes(adminWallet.toLowerCase());
}

export function normalizeWalletAddress(input: string): string | null {
    const wallet = input.trim();
    if (!EVM_ADDRESS_REGEX.test(wallet)) {
        return null;
    }
    return wallet.toLowerCase();
}

type SeatLike = {
    status: string;
    privilegeLevel: string;
    backendAccess: boolean;
};

export function derivePartnerPrivileges(seat: SeatLike | null | undefined) {
    if (!seat || seat.status !== 'ACTIVE') {
        return {
            isPartner: false,
            partnerLevel: null,
            backendAccess: false,
            partnerConsoleAccess: false,
        };
    }

    return {
        isPartner: true,
        partnerLevel: seat.privilegeLevel,
        backendAccess: seat.backendAccess,
        partnerConsoleAccess: seat.backendAccess,
    };
}
