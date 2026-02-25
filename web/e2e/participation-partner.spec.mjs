import { expect, test } from '@playwright/test';

const MOCK_WALLET = (process.env.NEXT_PUBLIC_E2E_MOCK_WALLET ?? '0x1111111111111111111111111111111111111111').toLowerCase();
const ADMIN_WALLET = '0x9999999999999999999999999999999999999999';

const PRODUCT_ID = 'prod-managed-e2e';
const TERM_ID = 'term-7d';
const MONTH_KEY = '2026-02';

const rulesResponse = {
    version: '2026-02-25',
    fundingChannels: ['EXCHANGE', 'TP_WALLET'],
    modes: ['FREE', 'MANAGED'],
    strategies: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'],
    servicePeriodsDays: [1, 7, 30, 90, 180, 360],
    minimums: {
        FREE: 100,
        MANAGED: 500,
        unit: 'MCN_EQUIVALENT',
    },
    feePolicy: {
        onlyProfitFee: true,
        noProfitNoFee: true,
        realizedProfitFeeRate: 0.2,
    },
    managedReturnMatrixByBand: {
        A: [
            {
                principalBand: 'A',
                minPrincipalUsd: 500,
                maxPrincipalUsd: 5000,
                termDays: 7,
                strategyProfile: 'CONSERVATIVE',
                returnMin: 4,
                returnMax: 6,
                returnUnit: 'PERCENT',
                displayRange: '4%-6%',
            },
            {
                principalBand: 'A',
                minPrincipalUsd: 500,
                maxPrincipalUsd: 5000,
                termDays: 7,
                strategyProfile: 'MODERATE',
                returnMin: 7,
                returnMax: 11,
                returnUnit: 'PERCENT',
                displayRange: '7%-11%',
            },
            {
                principalBand: 'A',
                minPrincipalUsd: 500,
                maxPrincipalUsd: 5000,
                termDays: 7,
                strategyProfile: 'AGGRESSIVE',
                returnMin: 10,
                returnMax: 16,
                returnUnit: 'PERCENT',
                displayRange: '10%-16%',
            },
        ],
        B: [],
        C: [],
    },
};

const managedProductsResponse = {
    products: [
        {
            id: PRODUCT_ID,
            slug: 'managed-e2e-strategy',
            name: 'Managed E2E Strategy',
            description: 'Strategy used for participation onboarding E2E.',
            strategyProfile: 'CONSERVATIVE',
            isGuaranteed: true,
            disclosurePolicy: 'TRANSPARENT',
            disclosureDelayHours: 0,
            performanceFeeRate: 0.08,
            reserveCoverageMin: 1.2,
            terms: [
                {
                    id: TERM_ID,
                    label: '7D',
                    durationDays: 7,
                    targetReturnMin: 4,
                    targetReturnMax: 6,
                    maxDrawdown: 5,
                    minYieldRate: 0.02,
                    performanceFeeRate: 0.08,
                    maxSubscriptionAmount: 10000,
                },
            ],
            agents: [],
        },
    ],
};

test.describe('Participation + partner flows E2E', () => {
    test('FREE/MANAGED rule presentation and managed onboarding threshold flow', async ({ page }) => {
        const submittedPrincipals = [];

        await page.route('**/api/participation/rules', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(rulesResponse),
            });
        });

        await page.route('**/api/managed-products?**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(managedProductsResponse),
            });
        });

        await page.route('**/api/managed-subscriptions', async (route) => {
            if (route.request().method() !== 'POST') {
                await route.continue();
                return;
            }

            const payload = route.request().postDataJSON();
            submittedPrincipals.push(payload.principal);

            if (Number(payload.principal) < 500) {
                await route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: 'Principal below managed minimum threshold',
                        minimumPrincipal: 500,
                    }),
                });
                return;
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    subscription: {
                        id: 'sub-participation-e2e',
                    },
                }),
            });
        });

        await page.goto('/en/managed-wealth');
        await expect(page.getByRole('heading', { name: 'Marketplace' })).toBeVisible();
        await expect(page.getByText('FREE Mode', { exact: true })).toBeVisible();
        await expect(page.getByText('MANAGED Mode', { exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'Subscribe Now' }).click();
        await expect(page.getByRole('heading', { name: /Subscribe to Safe Income Vault/i })).toBeVisible();

        await page.getByPlaceholder('0.00').fill('120');
        await page.getByRole('checkbox').nth(0).check();
        await page.getByRole('checkbox').nth(1).check();

        const confirmButton = page.getByRole('button', { name: /Confirm Investment/i });
        await expect(confirmButton).toBeEnabled();
        await confirmButton.click();

        await expect(page.getByRole('heading', { name: /Subscribe to Safe Income Vault/i })).toBeVisible();

        await page.getByPlaceholder('0.00').fill('600');
        await confirmButton.click();

        await expect(page.getByRole('heading', { name: /Subscribe to Safe Income Vault/i })).toHaveCount(0);

        expect(submittedPrincipals).toEqual([120, 600]);
    });

    test('partner-seat operation flow can run elimination and refund completion', async ({ page }) => {
        const state = {
            config: {
                id: 'GLOBAL',
                maxSeats: 100,
                refillPriceUsd: 0,
            },
            seats: [
                {
                    id: 'seat-1',
                    walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                    status: 'ACTIVE',
                    seatFeeUsd: 800,
                    privilegeLevel: 'V5',
                    backendAccess: true,
                    joinedAt: '2026-02-01T00:00:00.000Z',
                    monthlyRanks: [{ monthKey: MONTH_KEY, rank: 1, scoreNetDepositUsd: 1000 }],
                },
                {
                    id: 'seat-2',
                    walletAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                    status: 'ACTIVE',
                    seatFeeUsd: 700,
                    privilegeLevel: 'V5',
                    backendAccess: true,
                    joinedAt: '2026-02-02T00:00:00.000Z',
                    monthlyRanks: [{ monthKey: MONTH_KEY, rank: 2, scoreNetDepositUsd: 500 }],
                },
                {
                    id: 'seat-3',
                    walletAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
                    status: 'ACTIVE',
                    seatFeeUsd: 600,
                    privilegeLevel: 'V5',
                    backendAccess: true,
                    joinedAt: '2026-02-03T00:00:00.000Z',
                    monthlyRanks: [{ monthKey: MONTH_KEY, rank: 3, scoreNetDepositUsd: 100 }],
                },
            ],
            refunds: [
                {
                    id: 'refund-seat-3',
                    status: 'PENDING',
                    amountUsd: 600,
                    requestedAt: '2026-02-28T00:00:00.000Z',
                    completedAt: null,
                    txHash: null,
                    errorMessage: null,
                    seat: {
                        id: 'seat-3',
                        walletAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
                        status: 'ELIMINATED',
                    },
                    elimination: {
                        id: 'elim-seat-3',
                        monthKey: MONTH_KEY,
                        rankAtElimination: 3,
                        refundDeadlineAt: '2026-03-07T00:00:00.000Z',
                    },
                },
            ],
            eliminationExecuted: false,
        };

        const stats = () => ({
            activeSeatCount: state.seats.filter((seat) => seat.status === 'ACTIVE').length,
            availableSeatCount: Math.max(state.config.maxSeats - state.seats.filter((seat) => seat.status === 'ACTIVE').length, 0),
            pendingRefundCount: state.refunds.filter((refund) => refund.status === 'PENDING').length,
            refill: {
                isOpen: true,
                openSeats: state.seats.filter((seat) => seat.status !== 'ACTIVE').length,
                refillPriceUsd: state.config.refillPriceUsd,
            },
        });

        await page.route('**/api/partners/config', async (route) => {
            if (route.request().method() === 'POST') {
                const payload = route.request().postDataJSON();
                state.config.maxSeats = payload.maxSeats;
                state.config.refillPriceUsd = payload.refillPriceUsd;
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    config: state.config,
                    stats: stats(),
                }),
            });
        });

        await page.route('**/api/partners/seats?**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    seats: state.seats,
                    stats: {
                        ...stats(),
                        maxSeats: state.config.maxSeats,
                    },
                }),
            });
        });

        await page.route('**/api/partners/refunds?**', async (route) => {
            const url = new URL(route.request().url());
            const statusFilter = url.searchParams.get('status');
            const refunds = statusFilter
                ? state.refunds.filter((refund) => refund.status === statusFilter)
                : state.refunds;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ refunds }),
            });
        });

        await page.route('**/api/partners/cycle/eliminate', async (route) => {
            const payload = route.request().postDataJSON();
            const activeSeats = state.seats.filter((seat) => seat.status === 'ACTIVE');
            const eliminationCandidates = [...activeSeats]
                .sort((a, b) => (a.monthlyRanks?.[0]?.rank ?? 0) - (b.monthlyRanks?.[0]?.rank ?? 0))
                .slice(-2);

            if (payload.dryRun) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        monthKey: payload.monthKey,
                        activeSeatCount: activeSeats.length,
                        eliminateCount: eliminationCandidates.length,
                        eliminationCandidates: eliminationCandidates.map((seat) => ({
                            id: seat.id,
                            walletAddress: seat.walletAddress,
                            rank: seat.monthlyRanks?.[0]?.rank ?? 0,
                            scoreNetDepositUsd: seat.monthlyRanks?.[0]?.scoreNetDepositUsd ?? 0,
                        })),
                    }),
                });
                return;
            }

            if (state.eliminationExecuted) {
                await route.fulfill({
                    status: 409,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Cycle already executed for this month' }),
                });
                return;
            }

            state.eliminationExecuted = true;
            for (const seat of eliminationCandidates) {
                seat.status = 'ELIMINATED';
                state.refunds.push({
                    id: `refund-${seat.id}`,
                    status: 'PENDING',
                    amountUsd: seat.seatFeeUsd,
                    requestedAt: '2026-02-28T00:00:00.000Z',
                    completedAt: null,
                    txHash: null,
                    errorMessage: null,
                    seat: {
                        id: seat.id,
                        walletAddress: seat.walletAddress,
                        status: 'ELIMINATED',
                    },
                    elimination: {
                        id: `elim-${seat.id}`,
                        monthKey: payload.monthKey,
                        rankAtElimination: seat.monthlyRanks?.[0]?.rank ?? 0,
                        refundDeadlineAt: '2026-03-07T00:00:00.000Z',
                    },
                });
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    monthKey: payload.monthKey,
                    dryRun: false,
                    activeSeatCount: activeSeats.length,
                    eliminateCount: eliminationCandidates.length,
                    eliminated: eliminationCandidates.length,
                    refundDeadline: '2026-03-07T00:00:00.000Z',
                }),
            });
        });

        await page.route('**/api/partners/refunds', async (route) => {
            if (route.request().method() !== 'POST') {
                await route.continue();
                return;
            }

            const payload = route.request().postDataJSON();
            const refund = state.refunds.find((row) => row.id === payload.refundId);

            if (!refund) {
                await route.fulfill({
                    status: 404,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Refund not found' }),
                });
                return;
            }

            if (payload.action === 'COMPLETE') {
                refund.status = 'COMPLETED';
                refund.completedAt = '2026-03-01T00:00:00.000Z';
                refund.txHash = payload.txHash;
                const seat = state.seats.find((row) => row.id === refund.seat.id);
                if (seat) {
                    seat.status = 'REFUNDED';
                }
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ refund }),
            });
        });

        await page.goto('/en/managed-wealth');

        const flow = await page.evaluate(
            async ({ adminWallet, monthKey }) => {
                const adminHeaders = { 'x-admin-wallet': adminWallet };
                const adminJsonHeaders = {
                    ...adminHeaders,
                    'content-type': 'application/json',
                };

                const configRes = await fetch('/api/partners/config', {
                    headers: adminHeaders,
                });

                const dryRunRes = await fetch('/api/partners/cycle/eliminate', {
                    method: 'POST',
                    headers: adminJsonHeaders,
                    body: JSON.stringify({
                        monthKey,
                        eliminateCount: 2,
                        dryRun: true,
                    }),
                });
                const dryRunData = await dryRunRes.json();

                const executeRes = await fetch('/api/partners/cycle/eliminate', {
                    method: 'POST',
                    headers: adminJsonHeaders,
                    body: JSON.stringify({
                        monthKey,
                        eliminateCount: 2,
                        dryRun: false,
                    }),
                });

                const pendingRefundsRes = await fetch('/api/partners/refunds?status=PENDING', {
                    headers: adminHeaders,
                });
                const pendingRefundsData = await pendingRefundsRes.json();
                const firstRefund = pendingRefundsData.refunds[0];

                let completeStatus = null;
                if (firstRefund) {
                    const completeRes = await fetch('/api/partners/refunds', {
                        method: 'POST',
                        headers: adminJsonHeaders,
                        body: JSON.stringify({
                            refundId: firstRefund.id,
                            action: 'COMPLETE',
                            txHash: '0xabc123',
                        }),
                    });
                    completeStatus = completeRes.status;
                }

                const pendingAfterRes = await fetch('/api/partners/refunds?status=PENDING', {
                    headers: adminHeaders,
                });
                const pendingAfterData = await pendingAfterRes.json();

                return {
                    configStatus: configRes.status,
                    dryRunStatus: dryRunRes.status,
                    dryRunCandidateCount: dryRunData.eliminationCandidates.length,
                    executeStatus: executeRes.status,
                    pendingBefore: pendingRefundsData.refunds.length,
                    completeStatus,
                    pendingAfter: pendingAfterData.refunds.length,
                };
            },
            {
                adminWallet: ADMIN_WALLET,
                monthKey: MONTH_KEY,
            }
        );

        expect(flow.configStatus).toBe(200);
        expect(flow.dryRunStatus).toBe(200);
        expect(flow.dryRunCandidateCount).toBe(2);
        expect(flow.executeStatus).toBe(200);
        expect(flow.pendingBefore).toBeGreaterThan(0);
        expect(flow.completeStatus).toBe(200);
        expect(flow.pendingAfter).toBe(flow.pendingBefore - 1);
    });
});
