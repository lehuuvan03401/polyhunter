import { afterEach, describe, expect, it, vi } from 'vitest';

async function setupRulesRoute() {
    vi.resetModules();
    vi.doMock('@/lib/prisma', () => ({
        prisma: {},
        isDatabaseEnabled: false,
    }));

    const route = await import('@/app/api/participation/rules/route');
    return {
        get: route.GET,
    };
}

describe('Participation rules integration', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns managed return estimate for principal + cycle + strategy', async () => {
        const { get } = await setupRulesRoute();

        const res = await get(
            new Request(
                'http://localhost/api/participation/rules?principalUsd=6000&cycleDays=180&strategy=AGGRESSIVE'
            )
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.managedReturnEstimate).toEqual(
            expect.objectContaining({
                principalBand: 'B',
                matched: true,
            })
        );
        expect(body.managedReturnEstimate.row.displayRange).toBe('1.76x-2.40x');
    });

    it('supports BALANCED alias strategy for matrix estimate', async () => {
        const { get } = await setupRulesRoute();

        const res = await get(
            new Request(
                'http://localhost/api/participation/rules?principalUsd=1200&cycleDays=30&strategy=BALANCED'
            )
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.managedReturnEstimate.input.strategyProfile).toBe('MODERATE');
        expect(body.managedReturnEstimate.row.displayRange).toBe('23%-30%');
    });

    it('rejects partial estimate query params', async () => {
        const { get } = await setupRulesRoute();

        const res = await get(
            new Request('http://localhost/api/participation/rules?principalUsd=1200')
        );
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('required together');
    });
});
