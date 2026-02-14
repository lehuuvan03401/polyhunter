import { expect, test } from '@playwright/test';

const MOCK_WALLET = (process.env.NEXT_PUBLIC_E2E_MOCK_WALLET ?? '0x1111111111111111111111111111111111111111').toLowerCase();
const PRODUCT_ID = 'prod-safe-yield';
const TERM_ID = 'term-30d';
const SUBSCRIPTION_ID = 'sub-managed-e2e-1';

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
        await expect(page.getByRole('heading', { name: 'Managed Wealth' })).toBeVisible();

        await page.getByRole('button', { name: 'Subscribe' }).click();
        await expect(page.getByRole('heading', { name: /Subscribe to Safe Yield Bot/i })).toBeVisible();

        const confirmButton = page.getByRole('button', { name: /Confirm Subscription/i });
        await expect(confirmButton).toBeDisabled();

        await page.getByLabel('Principal (USDC)').fill('1200');
        await page.getByLabel(/I understand this is strategy investing/i).check();
        await page.getByLabel(/I accept product terms, disclosure policy/i).check();

        await expect(confirmButton).toBeEnabled();
        await confirmButton.click();

        await expect(page.getByRole('heading', { name: /Subscribe to Safe Yield Bot/i })).toHaveCount(0);

        expect(postedPayload).toBeTruthy();
        expect(String(postedPayload.walletAddress).toLowerCase()).toBe(MOCK_WALLET);
        expect(postedPayload.productId).toBe(PRODUCT_ID);
        expect(postedPayload.termId).toBe(TERM_ID);
        expect(postedPayload.principal).toBe(1200);
        expect(postedPayload.acceptedTerms).toBe(true);
    });

    test('user can view settled subscription and nav details', async ({ page }) => {
        await page.route('**/api/managed-subscriptions?**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    subscriptions: [
                        {
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
                        },
                    ],
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

        await expect(page.getByRole('heading', { name: 'My Managed Positions' })).toBeVisible();
        await expect(page.getByText('30D (30d) · SETTLED')).toBeVisible();

        await page.getByRole('button', { name: 'View NAV' }).click();

        await expect(page.getByText('Latest NAV')).toBeVisible();
        await expect(page.getByText('1.0350').first()).toBeVisible();
        await expect(page.getByText('3.50%').first()).toBeVisible();
        await expect(page.getByText('Points')).toBeVisible();
    });
});
