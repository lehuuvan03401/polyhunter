import { expect, test } from '@playwright/test';

const MOCK_WALLET = (process.env.NEXT_PUBLIC_E2E_MOCK_WALLET ?? '0x1111111111111111111111111111111111111111').toLowerCase();
const PRODUCT_ID = 'prod-safe-yield';
const TERM_ID = 'term-30d';
const SUBSCRIPTION_ID = 'sub-managed-e2e-1';
const WITHDRAW_GUARDRAILS = {
    cooldownHours: 6,
    earlyWithdrawalFeeRate: 0.01,
    drawdownAlertThreshold: 0.35,
};

const runningSubscriptionResponse = {
    id: SUBSCRIPTION_ID,
    status: 'RUNNING',
    principal: 1000,
    createdAt: '2026-02-14T00:00:00.000Z',
    startAt: '2026-02-14T00:00:00.000Z',
    endAt: '2026-03-15T00:00:00.000Z',
    product: {
        id: PRODUCT_ID,
        slug: 'safe-yield-bot',
        name: 'Safe Yield Bot',
        strategyProfile: 'CONSERVATIVE',
        isGuaranteed: true,
        disclosurePolicy: 'TRANSPARENT',
        disclosureDelayHours: 0,
    },
    term: {
        id: TERM_ID,
        label: '30D',
        durationDays: 30,
        targetReturnMin: 6,
        targetReturnMax: 12,
        maxDrawdown: 5,
    },
    navSnapshots: [
        {
            snapshotAt: '2026-03-14T00:00:00.000Z',
            nav: 1.02,
            equity: 1020,
            cumulativeReturn: 0.02,
            drawdown: 0.007,
        },
    ],
    allocationSummary: {
        version: 2,
        createdAt: '2026-03-10T12:00:00.000Z',
        selectedWeights: [
            { address: '0xaaaa11111111111111111111111111111111aaaa', weight: 0.6 },
            { address: '0xbbbb22222222222222222222222222222222bbbb', weight: 0.4 },
        ],
    },
    settlement: null,
};

const settledSubscriptionResponse = {
    id: SUBSCRIPTION_ID,
    status: 'SETTLED',
    principal: 1000,
    createdAt: '2026-02-14T00:00:00.000Z',
    startAt: '2026-02-14T00:00:00.000Z',
    endAt: '2026-03-15T00:00:00.000Z',
    settledAt: '2026-03-15T00:00:00.000Z',
    product: {
        id: PRODUCT_ID,
        slug: 'safe-yield-bot',
        name: 'Safe Yield Bot',
        strategyProfile: 'CONSERVATIVE',
        isGuaranteed: true,
        disclosurePolicy: 'TRANSPARENT',
        disclosureDelayHours: 0,
    },
    term: {
        id: TERM_ID,
        label: '30D',
        durationDays: 30,
        targetReturnMin: 6,
        targetReturnMax: 12,
        maxDrawdown: 5,
    },
    navSnapshots: [
        {
            snapshotAt: '2026-03-15T00:00:00.000Z',
            nav: 1.035,
            equity: 1035,
            cumulativeReturn: 0.035,
            drawdown: 0.01,
        },
    ],
    settlement: {
        id: 'settle-e2e-1',
        status: 'COMPLETED',
        finalPayout: 1035,
        reserveTopup: 0,
        settledAt: '2026-03-15T00:00:00.000Z',
    },
};

const managedProductsResponse = {
    products: [
        {
            id: PRODUCT_ID,
            slug: 'safe-yield-bot',
            name: 'Safe Yield Bot',
            description: 'Low risk managed strategy for steady growth.',
            strategyProfile: 'CONSERVATIVE',
            isGuaranteed: true,
            disclosurePolicy: 'TRANSPARENT',
            disclosureDelayHours: 0,
            performanceFeeRate: 0.08,
            reserveCoverageMin: 1.2,
            terms: [
                {
                    id: TERM_ID,
                    label: '30D',
                    durationDays: 30,
                    targetReturnMin: 6,
                    targetReturnMax: 12,
                    maxDrawdown: 5,
                    minYieldRate: 0.02,
                    performanceFeeRate: 0.08,
                    maxSubscriptionAmount: 20000,
                },
            ],
            agents: [],
        },
    ],
};

const managedProductDetailResponse = {
    product: {
        ...managedProductsResponse.products[0],
        agents: [],
    },
    stats: {
        subscriptionCount: 12,
        runningSubscriptionCount: 5,
    },
    chartData: [
        { date: '2026-02-01', value: 1.0 },
        { date: '2026-03-01', value: 1.03 },
    ],
    allocationSnapshots: [],
};

test.describe('Managed wealth E2E', () => {
    test('user can subscribe from marketplace', async ({ page }) => {
        let postedPayload = null;

        await page.route('**/api/managed-products?**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(managedProductsResponse),
            });
        });

        await page.route('**/api/managed-products/*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(managedProductDetailResponse),
            });
        });

        await page.route('**/api/participation/rules**', async (route) => {
            const url = new URL(route.request().url());
            const principalUsd = Number(url.searchParams.get('principalUsd') || '0');
            const cycleDays = Number(url.searchParams.get('cycleDays') || TERM_ID.replace(/\D/g, '') || '30');

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    managedReturnMatrix: [],
                    managedReturnMatrixByBand: {
                        A: [],
                        B: [],
                        C: [],
                    },
                    managedReturnEstimate: url.searchParams.has('principalUsd')
                        ? {
                            input: {
                                principalUsd,
                                cycleDays,
                                strategyProfile: 'CONSERVATIVE',
                            },
                            principalBand: 'A',
                            matched: true,
                            row: {
                                principalBand: 'A',
                                minPrincipalUsd: 500,
                                maxPrincipalUsd: 5000,
                                termDays: 30,
                                strategyProfile: 'CONSERVATIVE',
                                returnMin: 6,
                                returnMax: 12,
                                returnUnit: 'PERCENT',
                                displayRange: '6% - 12%',
                            },
                        }
                        : null,
                }),
            });
        });

        await page.route('**/api/managed-subscriptions', async (route) => {
            const request = route.request();
            if (request.method() !== 'POST') {
                await route.continue();
                return;
            }

            postedPayload = request.postDataJSON();
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    subscription: {
                        id: SUBSCRIPTION_ID,
                    },
                }),
            });
        });

        await page.goto('/en/managed-wealth');
        await expect(page.getByRole('heading', { name: 'Marketplace' })).toBeVisible();

        await page.getByRole('button', { name: 'Subscribe Now' }).first().click();
        await page.waitForURL(`**/en/managed-wealth/safe-yield-bot?**`);
        await page.getByRole('button', { name: 'Subscribe Now' }).click();

        const confirmButton = page.getByRole('button', { name: /Confirm Investment/i });
        await expect(confirmButton).toBeVisible();
        await expect(confirmButton).toBeDisabled();

        await page.getByPlaceholder('0.00').fill('1200');
        await page.getByRole('checkbox').nth(0).check();
        await page.getByRole('checkbox').nth(1).check();

        await expect(confirmButton).toBeEnabled();
        await confirmButton.click();

        await expect(page.getByRole('heading', { name: /Subscribe to Safe Income Vault/i })).toHaveCount(0);

        expect(postedPayload).toBeTruthy();
        expect(String(postedPayload.walletAddress).toLowerCase()).toBe(MOCK_WALLET);
        expect(postedPayload.productId).toBe(PRODUCT_ID);
        expect(postedPayload.termId).toBe(TERM_ID);
        expect(postedPayload.principal).toBe(1200);
        expect(postedPayload.acceptedTerms).toBe(true);
    });

    test('user can view settled subscription details', async ({ page }) => {
        await page.route('**/api/managed-subscriptions?**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    subscriptions: [settledSubscriptionResponse],
                }),
            });
        });

        await page.route(`**/api/managed-subscriptions/${SUBSCRIPTION_ID}/nav?**`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    summary: {
                        latestNav: 1.035,
                        latestEquity: 1035,
                        cumulativeReturn: 0.035,
                        maxDrawdown: 0.01,
                        peakNav: 1.04,
                        points: 3,
                    },
                    snapshots: [
                        { snapshotAt: '2026-03-13T00:00:00.000Z', nav: 1.01, equity: 1010, cumulativeReturn: 0.01, drawdown: 0.005 },
                        { snapshotAt: '2026-03-14T00:00:00.000Z', nav: 1.02, equity: 1020, cumulativeReturn: 0.02, drawdown: 0.007 },
                        { snapshotAt: '2026-03-15T00:00:00.000Z', nav: 1.035, equity: 1035, cumulativeReturn: 0.035, drawdown: 0.01 },
                    ],
                }),
            });
        });

        await page.goto('/en/managed-wealth/my');

        await expect(page.getByRole('heading', { name: 'My Dashboard' })).toBeVisible();
        await expect(page.getByText('30D (30d)')).toBeVisible();
        await expect(page.getByText('Final Payout')).toBeVisible();
        await expect(page.getByText('$1035.00').first()).toBeVisible();
        await expect(page.getByText('+3.50%').first()).toBeVisible();

        await page.getByRole('heading', { name: 'Safe Income Vault' }).click();
        await expect(page.getByText('Subscription Details')).toBeVisible();
        await expect(page.getByRole('button', { name: 'View Full Analysis' })).toBeVisible();
    });

    test('user can withdraw a running subscription and see the settled state after reload', async ({ page }) => {
        let subscriptionReads = 0;
        let withdrawPayload = null;

        page.on('dialog', async (dialog) => {
            await dialog.accept();
        });

        await page.route('**/api/managed-subscriptions?**', async (route) => {
            subscriptionReads += 1;

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    withdrawGuardrails: WITHDRAW_GUARDRAILS,
                    subscriptions: [
                        subscriptionReads === 1
                            ? runningSubscriptionResponse
                            : settledSubscriptionResponse,
                    ],
                }),
            });
        });

        await page.route(`**/api/managed-subscriptions/${SUBSCRIPTION_ID}/withdraw`, async (route) => {
            const request = route.request();
            if (request.method() !== 'POST') {
                await route.continue();
                return;
            }

            withdrawPayload = request.postDataJSON();
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    status: 'SETTLED',
                    subscription: {
                        id: SUBSCRIPTION_ID,
                    },
                    settlement: {
                        id: 'settle-e2e-1',
                        finalPayout: 1035,
                    },
                }),
            });
        });

        await page.goto('/en/managed-wealth/my');

        await expect(page.getByRole('heading', { name: 'My Dashboard' })).toBeVisible();
        await expect(page.getByText('Current Equity').first()).toBeVisible();

        await page.getByRole('heading', { name: 'Safe Income Vault' }).click();
        await expect(page.getByRole('button', { name: 'Withdraw' })).toBeVisible();

        await page.getByRole('button', { name: 'Withdraw' }).click();

        await expect.poll(() => subscriptionReads).toBeGreaterThan(1);
        await expect(page.getByText('Final Payout')).toBeVisible();
        await expect(page.getByText('$1035.00').first()).toBeVisible();

        expect(withdrawPayload).toBeTruthy();
        expect(String(withdrawPayload.walletAddress).toLowerCase()).toBe(MOCK_WALLET);
        expect(withdrawPayload.confirm).toBe(true);
    });
});
