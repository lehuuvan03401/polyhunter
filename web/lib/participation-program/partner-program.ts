import type { PrismaClient } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { ethers } from 'ethers';
import {
    buildManagedWalletAuthMessage,
    buildManagedWalletSessionMessage,
    MANAGED_WALLET_AUTH_WINDOW_MS,
} from '@/lib/managed-wealth/wallet-auth-message';

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

export function getMonthRange(monthKey: string): { monthStart: Date; monthEnd: Date } {
    const monthStart = parseMonthKey(monthKey);
    const monthEnd = new Date(
        Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)
    );
    return { monthStart, monthEnd };
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
    walletAddresses: string[],
    options?: {
        monthKey?: string;
    }
): Promise<Map<string, number>> {
    const wallets = Array.from(
        new Set(walletAddresses.map((wallet) => wallet.toLowerCase().trim()).filter(Boolean))
    );
    const map = new Map<string, number>();

    if (wallets.length === 0) {
        return map;
    }

    const scoreWhere: {
        walletAddress: { in: string[] };
        snapshotDate?: { gte: Date; lt: Date };
    } = {
        walletAddress: { in: wallets },
    };

    if (options?.monthKey) {
        const { monthStart, monthEnd } = getMonthRange(options.monthKey);
        scoreWhere.snapshotDate = {
            gte: monthStart,
            lt: monthEnd,
        };
    }

    const latestSnapshots = await prisma.dailyLevelSnapshot.findMany({
        where: scoreWhere,
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
    scoreActiveManagedUsd: number;
};

type PartnerSeatScoreComparable = Pick<
    RankedPartnerSeat,
    'walletAddress' | 'joinedAt' | 'scoreNetDepositUsd' | 'scoreActiveManagedUsd'
>;

export function comparePartnerSeatRankingOrder(
    a: PartnerSeatScoreComparable,
    b: PartnerSeatScoreComparable
): number {
    if (b.scoreNetDepositUsd !== a.scoreNetDepositUsd) {
        return b.scoreNetDepositUsd - a.scoreNetDepositUsd;
    }
    if (b.scoreActiveManagedUsd !== a.scoreActiveManagedUsd) {
        return b.scoreActiveManagedUsd - a.scoreActiveManagedUsd;
    }
    if (a.joinedAt.getTime() !== b.joinedAt.getTime()) {
        return a.joinedAt.getTime() - b.joinedAt.getTime();
    }
    return a.walletAddress.localeCompare(b.walletAddress);
}

export function comparePartnerSeatEliminationOrder(
    a: PartnerSeatScoreComparable,
    b: PartnerSeatScoreComparable
): number {
    return -comparePartnerSeatRankingOrder(a, b);
}

export function pickEliminationCandidates<T extends PartnerSeatScoreComparable>(
    ranking: T[],
    eliminateCount: number
): T[] {
    if (eliminateCount <= 0 || ranking.length === 0) {
        return [];
    }
    return [...ranking]
        .sort(comparePartnerSeatEliminationOrder)
        .slice(0, Math.min(eliminateCount, ranking.length));
}

export function resolvePartnerSeatFeeUsd(params: {
    configuredSeatFeeUsd: number;
    requestedSeatFeeUsd?: number;
}):
    | {
          ok: true;
          seatFeeUsd: number;
      }
    | {
          ok: false;
          code: 'SEAT_FEE_MISMATCH';
          expectedSeatFeeUsd: number;
          providedSeatFeeUsd: number;
      } {
    const { configuredSeatFeeUsd, requestedSeatFeeUsd } = params;
    if (requestedSeatFeeUsd === undefined) {
        return {
            ok: true,
            seatFeeUsd: configuredSeatFeeUsd,
        };
    }

    const sameFee = Math.abs(requestedSeatFeeUsd - configuredSeatFeeUsd) < 1e-6;
    if (!sameFee) {
        return {
            ok: false,
            code: 'SEAT_FEE_MISMATCH',
            expectedSeatFeeUsd: configuredSeatFeeUsd,
            providedSeatFeeUsd: requestedSeatFeeUsd,
        };
    }

    return {
        ok: true,
        seatFeeUsd: configuredSeatFeeUsd,
    };
}

export async function buildPartnerSeatRanking(
    prisma: PrismaClient,
    seats: PartnerSeatForRanking[],
    options?: {
        monthKey?: string;
    }
): Promise<RankedPartnerSeat[]> {
    if (seats.length === 0) {
        return [];
    }

    const scoreMap = await getSeatScoreMap(
        prisma,
        seats.map((seat) => seat.walletAddress),
        { monthKey: options?.monthKey }
    );

    // Get active managed equity for tie-breaking
    const activeManagedMap = new Map<string, number>();
    const activeSubscriptions = await prisma.managedSubscription.findMany({
        where: {
            walletAddress: { in: Array.from(scoreMap.keys()) },
            status: { in: ['RUNNING', 'PENDING'] }
        },
        select: {
            walletAddress: true,
            currentEquity: true,
            principal: true
        }
    });

    for (const sub of activeSubscriptions) {
        const wallet = sub.walletAddress.toLowerCase();
        const current = activeManagedMap.get(wallet) || 0;
        const val = sub.currentEquity ?? sub.principal;
        activeManagedMap.set(wallet, current + val);
    }

    return seats
        .map((seat) => ({
            ...seat,
            scoreNetDepositUsd: Number(scoreMap.get(seat.walletAddress.toLowerCase()) ?? 0),
            scoreActiveManagedUsd: Number(activeManagedMap.get(seat.walletAddress.toLowerCase()) ?? 0),
        }))
        .sort(comparePartnerSeatRankingOrder)
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

type AdminRequestLike = Pick<Request, 'headers' | 'method' | 'url'> & {
    nextUrl?: {
        pathname: string;
        search: string;
    };
};

function shouldRequireAdminSignature(): boolean {
    const configured = process.env.PARTNER_ADMIN_REQUIRE_SIGNATURE;
    if (configured === 'true') return true;
    if (configured === 'false') return false;
    if (process.env.NODE_ENV === 'development') return false;
    return true;
}

function getRequestPathWithQuery(request: AdminRequestLike): string {
    if (request.nextUrl) {
        return `${request.nextUrl.pathname}${request.nextUrl.search}`;
    }
    try {
        const parsed = new URL(request.url);
        return `${parsed.pathname}${parsed.search}`;
    } catch {
        return '/';
    }
}

function verifyAdminRequestSignature(request: AdminRequestLike, walletAddress: string): boolean {
    if (process.env.NEXT_PUBLIC_E2E_MOCK_AUTH === 'true') {
        return true;
    }

    const signature =
        request.headers.get('x-admin-signature') ?? request.headers.get('x-wallet-signature');
    const timestampRaw =
        request.headers.get('x-admin-timestamp') ?? request.headers.get('x-wallet-timestamp');
    const authType =
        request.headers.get('x-admin-auth-type') ?? request.headers.get('x-wallet-auth-type');

    if (!signature || !timestampRaw) {
        return false;
    }

    const timestamp = Number(timestampRaw);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return false;
    }

    if (Math.abs(Date.now() - timestamp) > MANAGED_WALLET_AUTH_WINDOW_MS) {
        return false;
    }

    const message = authType === 'session'
        ? buildManagedWalletSessionMessage({
            walletAddress,
            timestamp,
        })
        : buildManagedWalletAuthMessage({
            walletAddress,
            method: request.method,
            pathWithQuery: getRequestPathWithQuery(request),
            timestamp,
        });

    try {
        const recovered = ethers.utils.verifyMessage(message, signature).toLowerCase();
        return recovered === walletAddress;
    } catch {
        return false;
    }
}

export function isAdminRequest(request: NextRequest | AdminRequestLike): boolean {
    const adminWallets = resolveAdminWallets();
    if (process.env.NODE_ENV === 'development' && adminWallets.length === 0) {
        console.warn('[PartnerProgram] Admin auth bypassed in development mode');
        return true;
    }

    const adminWalletRaw =
        request.headers.get('x-admin-wallet') ?? request.headers.get('x-wallet-address');
    if (!adminWalletRaw) return false;
    const adminWallet = normalizeWalletAddress(adminWalletRaw);
    if (!adminWallet) return false;

    if (!adminWallets.includes(adminWallet)) {
        return false;
    }

    if (!shouldRequireAdminSignature()) {
        return true;
    }

    return verifyAdminRequestSignature(request, adminWallet);
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
