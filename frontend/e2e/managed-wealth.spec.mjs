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
        await expect(page.getByRole('heading', { name: 'Marketplace' })).toBeVisible();

        await page.getByRole('button', { name: 'Subscribe Now' }).click();
        await expect(page.getByRole('heading', { name: /Subscribe to Safe Income Vault/i })).toBeVisible();

        const confirmButton = page.getByRole('button', { name: /Confirm Investment/i });
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

        await expect(page.getByRole('heading', { name: 'My Dashboard' })).toBeVisible();
        await expect(page.getByText('30D (30d)')).toBeVisible();
        await expect(page.getByText('Final Payout')).toBeVisible();
        await expect(page.getByText('$1035.00').first()).toBeVisible();
        await expect(page.getByText('+3.50%').first()).toBeVisible();

        await page.getByRole('heading', { name: 'Safe Income Vault' }).click();
        await expect(page.getByText('Subscription Details')).toBeVisible();
        await expect(page.getByRole('button', { name: 'View Full Analysis' })).toBeVisible();
    });
});
