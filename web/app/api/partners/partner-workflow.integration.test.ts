import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

type PartnerSeatRow = {
    id: string;
    walletAddress: string;
    status: 'ACTIVE' | 'ELIMINATED' | 'REFUND_PENDING' | 'REFUNDED';
    joinedAt: Date;
    seatFeeUsd: number;
    privilegeLevel: string;
    backendAccess: boolean;
    eliminatedAt: Date | null;
    refundedAt: Date | null;
};

type PartnerMonthlyRankRow = {
    seatId: string;
    monthKey: string;
    rank: number;
    scoreNetDepositUsd: number;
    snapshotAt: Date;
};

type PartnerEliminationRow = {
    id: string;
    seatId: string;
    monthKey: string;
    rankAtElimination: number;
    scoreNetDepositUsd: number;
    reason?: string | null;
    eliminatedAt: Date;
    refundDeadlineAt: Date;
};

type PartnerRefundRow = {
    id: string;
    seatId: string;
    eliminationId: string;
    amountUsd: number;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    requestedAt: Date;
    completedAt: Date | null;
    txHash: string | null;
    errorMessage: string | null;
};

type PartnerState = {
    seats: Map<string, PartnerSeatRow>;
    monthlyRanks: Map<string, PartnerMonthlyRankRow>;
    eliminations: Map<string, PartnerEliminationRow>;
    refunds: Map<string, PartnerRefundRow>;
    scores: Map<string, number>;
};

type RankedSeat = {
    id: string;
    walletAddress: string;
    seatFeeUsd: number;
    joinedAt: Date;
    rank: number;
    scoreNetDepositUsd: number;
};

const MONTH_KEY = '2026-02';

function createJsonRequest(url: string, body: unknown) {
    return new NextRequest(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function createPartnerState(): PartnerState {
    const seats: PartnerSeatRow[] = [
        {
            id: 'seat-1',
            walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            status: 'ACTIVE',
            joinedAt: new Date('2026-01-01T00:00:00.000Z'),
            seatFeeUsd: 800,
            privilegeLevel: 'V5',
            backendAccess: true,
            eliminatedAt: null,
            refundedAt: null,
        },
        {
            id: 'seat-2',
            walletAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            status: 'ACTIVE',
            joinedAt: new Date('2026-01-02T00:00:00.000Z'),
            seatFeeUsd: 900,
            privilegeLevel: 'V5',
            backendAccess: true,
            eliminatedAt: null,
            refundedAt: null,
        },
        {
            id: 'seat-3',
            walletAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
            status: 'ACTIVE',
            joinedAt: new Date('2026-01-03T00:00:00.000Z'),
            seatFeeUsd: 1000,
            privilegeLevel: 'V5',
            backendAccess: true,
            eliminatedAt: null,
            refundedAt: null,
        },
    ];

    return {
        seats: new Map(seats.map((seat) => [seat.id, seat])),
        monthlyRanks: new Map(),
        eliminations: new Map(),
        refunds: new Map(),
        scores: new Map([
            ['seat-1', 1200],
            ['seat-2', 400],
            ['seat-3', 100],
        ]),
    };
}

function createPartnerPrismaMock(state: PartnerState) {
    const partnerSeat = {
        findMany: async ({ where }: { where?: { status?: string } }) => {
            const all = Array.from(state.seats.values());
            if (!where?.status) return all;
            return all.filter((seat) => seat.status === where.status);
        },
        update: async ({
            where,
            data,
        }: {
            where: { id: string };
            data: Partial<PartnerSeatRow>;
        }) => {
            const existing = state.seats.get(where.id);
            if (!existing) throw new Error('SEAT_NOT_FOUND');
            const next = { ...existing, ...data };
            state.seats.set(where.id, next);
            return next;
        },
    };

    const partnerMonthlyRank = {
        upsert: async ({
            where,
            update,
            create,
        }: {
            where: { seatId_monthKey: { seatId: string; monthKey: string } };
            update: Partial<PartnerMonthlyRankRow>;
            create: PartnerMonthlyRankRow;
        }) => {
            const key = `${where.seatId_monthKey.seatId}:${where.seatId_monthKey.monthKey}`;
            const existing = state.monthlyRanks.get(key);
            const next = existing ? { ...existing, ...update } : create;
            state.monthlyRanks.set(key, next);
            return next;
        },
    };

    const partnerElimination = {
        count: async ({ where }: { where: { monthKey: string } }) =>
            Array.from(state.eliminations.values()).filter((row) => row.monthKey === where.monthKey).length,
        upsert: async ({
            where,
            update,
            create,
        }: {
            where: { seatId_monthKey: { seatId: string; monthKey: string } };
            update: Partial<PartnerEliminationRow>;
            create: Omit<PartnerEliminationRow, 'id'>;
        }) => {
            const key = `${where.seatId_monthKey.seatId}:${where.seatId_monthKey.monthKey}`;
            const existing = state.eliminations.get(key);
            const next = existing
                ? { ...existing, ...update }
                : { ...create, id: `elim-${where.seatId_monthKey.seatId}-${where.seatId_monthKey.monthKey}` };
            state.eliminations.set(key, next);
            return next;
        },
    };

    const partnerRefund = {
        upsert: async ({
            where,
            update,
            create,
        }: {
            where: { eliminationId: string };
            update: Partial<PartnerRefundRow>;
            create: Omit<PartnerRefundRow, 'id' | 'requestedAt' | 'completedAt' | 'txHash' | 'errorMessage'>;
        }) => {
            const existing = Array.from(state.refunds.values()).find(
                (row) => row.eliminationId === where.eliminationId
            );
            if (existing) {
                const next = { ...existing, ...update };
                state.refunds.set(existing.id, next);
                return next;
            }

            const created: PartnerRefundRow = {
                id: `refund-${where.eliminationId}`,
                requestedAt: new Date('2026-02-28T00:00:00.000Z'),
                completedAt: null,
                txHash: null,
                errorMessage: null,
                ...create,
            };
            state.refunds.set(created.id, created);
            return created;
        },
        findUnique: async ({ where }: { where: { id: string } }) => state.refunds.get(where.id) ?? null,
        findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
            const found = state.refunds.get(where.id);
            if (!found) throw new Error('REFUND_NOT_FOUND');
            return found;
        },
        update: async ({
            where,
            data,
        }: {
            where: { id: string };
            data: Partial<PartnerRefundRow>;
        }) => {
            const existing = state.refunds.get(where.id);
            if (!existing) throw new Error('REFUND_NOT_FOUND');
            const next = { ...existing, ...data };
            state.refunds.set(where.id, next);
            return next;
        },
    };

    const prismaMock = {
        partnerSeat,
        partnerMonthlyRank,
        partnerElimination,
        partnerRefund,
        $transaction: async (callback: (tx: any) => Promise<any>) => callback(prismaMock),
    };

    return prismaMock;
}

async function setupPartnerRoutes() {
    const state = createPartnerState();
    const prismaMock = createPartnerPrismaMock(state);

    vi.resetModules();
    vi.doMock('@/lib/prisma', () => ({
        prisma: prismaMock,
        isDatabaseEnabled: true,
    }));
    vi.doMock('@/lib/participation-program/partner-program', () => ({
        MONTHLY_ELIMINATION_COUNT: 2,
        isAdminRequest: () => true,
        toMonthKey: () => MONTH_KEY,
        parseMonthKey: (monthKey: string) => {
            if (!/^\d{4}-\d{2}$/.test(monthKey)) {
                throw new Error(`Invalid month key: ${monthKey}`);
            }
            return new Date(`${monthKey}-01T00:00:00.000Z`);
        },
        computeRefundDeadline: (eliminatedAt: Date) =>
            new Date(eliminatedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
        buildPartnerSeatRanking: async (_prisma: unknown, seats: Array<{ id: string; walletAddress: string; seatFeeUsd: number; joinedAt: Date }>): Promise<RankedSeat[]> =>
            seats
                .map((seat) => ({
                    ...seat,
                    scoreNetDepositUsd: state.scores.get(seat.id) ?? 0,
                }))
                .sort((a, b) => b.scoreNetDepositUsd - a.scoreNetDepositUsd)
                .map((seat, index) => ({
                    ...seat,
                    rank: index + 1,
                })),
    }));

    const eliminationRoute = await import('@/app/api/partners/cycle/eliminate/route');
    const refundsRoute = await import('@/app/api/partners/refunds/route');

    return {
        state,
        eliminate: eliminationRoute.POST,
        updateRefund: refundsRoute.POST,
    };
}

describe('Partner elimination/refund integration workflow', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('processes elimination and refund completion with status guards', async () => {
        const { state, eliminate, updateRefund } = await setupPartnerRoutes();

        const eliminationRes = await eliminate(
            createJsonRequest('http://localhost/api/partners/cycle/eliminate', {
                monthKey: MONTH_KEY,
                dryRun: false,
                reason: 'Monthly bottom seats',
            })
        );
        const eliminationBody = await eliminationRes.json();

        expect(eliminationRes.status).toBe(200);
        expect(eliminationBody.eliminated).toBe(2);
        expect(state.eliminations.size).toBe(2);
        expect(state.refunds.size).toBe(2);
        expect(Array.from(state.seats.values()).filter((seat) => seat.status === 'ELIMINATED')).toHaveLength(2);

        const duplicateCycleRes = await eliminate(
            createJsonRequest('http://localhost/api/partners/cycle/eliminate', {
                monthKey: MONTH_KEY,
                dryRun: false,
            })
        );
        expect(duplicateCycleRes.status).toBe(409);

        const firstRefund = Array.from(state.refunds.values())[0];
        const completeRefundRes = await updateRefund(
            createJsonRequest('http://localhost/api/partners/refunds', {
                refundId: firstRefund.id,
                action: 'COMPLETE',
                txHash: '0xabc123',
            })
        );
        const completeBody = await completeRefundRes.json();

        expect(completeRefundRes.status).toBe(200);
        expect(completeBody.refund.status).toBe('COMPLETED');
        expect(state.seats.get(firstRefund.seatId)?.status).toBe('REFUNDED');

        const failCompletedRefundRes = await updateRefund(
            createJsonRequest('http://localhost/api/partners/refunds', {
                refundId: firstRefund.id,
                action: 'FAIL',
                errorMessage: 'should reject',
            })
        );
        expect(failCompletedRefundRes.status).toBe(409);
    });
});
