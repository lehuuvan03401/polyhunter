import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

type PartnerConfigRow = {
    id: string;
    maxSeats: number;
    refillPriceUsd: number;
};

function createJsonRequest(url: string, body: unknown) {
    return new NextRequest(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function setupConfigRoute(params?: {
    isAdmin?: boolean;
    initialConfig?: PartnerConfigRow;
}) {
    const initialConfig: PartnerConfigRow = params?.initialConfig ?? {
        id: 'GLOBAL',
        maxSeats: 100,
        refillPriceUsd: 10,
    };

    const updateMock = vi.fn().mockImplementation(async ({ data }: { data: Partial<PartnerConfigRow> }) => ({
        ...initialConfig,
        maxSeats: data.maxSeats ?? initialConfig.maxSeats,
        refillPriceUsd: data.refillPriceUsd ?? initialConfig.refillPriceUsd,
    }));

    const pendingRefundCount = vi.fn().mockResolvedValue(2);
    const ensureMock = vi.fn().mockResolvedValue(initialConfig);
    const getActiveSeatCountMock = vi.fn().mockResolvedValue(40);

    vi.resetModules();
    vi.doMock('@/lib/prisma', () => ({
        prisma: {
            partnerProgramConfig: {
                update: updateMock,
            },
            partnerRefund: {
                count: pendingRefundCount,
            },
        },
        isDatabaseEnabled: true,
    }));

    vi.doMock('@/lib/participation-program/partner-program', () => ({
        DEFAULT_PARTNER_MAX_SEATS: 100,
        ensurePartnerProgramConfig: ensureMock,
        getActiveSeatCount: getActiveSeatCountMock,
        isAdminRequest: () => params?.isAdmin ?? true,
    }));

    const route = await import('@/app/api/partners/config/route');
    return {
        get: route.GET,
        post: route.POST,
        updateMock,
        ensureMock,
    };
}

describe('Partner config route integration', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('rejects attempts to increase seat cap above immutable 100', async () => {
        const { post, updateMock } = await setupConfigRoute();

        const res = await post(
            createJsonRequest('http://localhost/api/partners/config', {
                maxSeats: 101,
                refillPriceUsd: 12,
            })
        );
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.code).toBe('IMMUTABLE_SEAT_CAP');
        expect(body.allowedMaxSeats).toBe(100);
        expect(updateMock).not.toHaveBeenCalled();
    });

    it('allows refill price updates while preserving immutable seat cap', async () => {
        const { post, updateMock } = await setupConfigRoute();

        const res = await post(
            createJsonRequest('http://localhost/api/partners/config', {
                maxSeats: 100,
                refillPriceUsd: 25,
            })
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.config.maxSeats).toBe(100);
        expect(body.config.refillPriceUsd).toBe(25);
        expect(updateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    maxSeats: 100,
                    refillPriceUsd: 25,
                }),
            })
        );
    });

    it('returns immutable cap in GET response', async () => {
        const { get } = await setupConfigRoute({
            initialConfig: {
                id: 'GLOBAL',
                maxSeats: 100,
                refillPriceUsd: 5,
            },
        });

        const res = await get();
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.config.maxSeats).toBe(100);
    });
});
