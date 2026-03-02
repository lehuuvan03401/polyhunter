import { expect, test } from '@playwright/test';

const MOCK_WALLET = (process.env.NEXT_PUBLIC_E2E_MOCK_WALLET ?? '0x1111111111111111111111111111111111111111').toLowerCase();

test.describe('Participation dashboard E2E', () => {
    test('authenticated user can view participation status, level progress, and promotion progress', async ({ page }) => {
        await page.route('**/api/participation/account?**', async (route) => {
            const request = route.request();
            expect(request.headers()['x-wallet-address']).toBe(MOCK_WALLET);

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    account: {
                        status: 'ACTIVE',
                        preferredMode: 'MANAGED',
                        isRegistrationComplete: true,
                        registrationCompletedAt: '2026-03-01T00:00:00.000Z',
                        activatedAt: '2026-03-02T00:00:00.000Z',
                    },
                    netDeposits: {
                        depositUsd: 1500,
                        withdrawUsd: 250,
                        netUsd: 1250,
                        depositMcn: 1500,
                        withdrawMcn: 250,
                        netMcnEquivalent: 1250,
                    },
                    eligibility: {
                        freeQualified: true,
                        managedQualified: true,
                        thresholds: {
                            FREE: 100,
                            MANAGED: 500,
                        },
                    },
                }),
            });
        });

        await page.route('**/api/participation/levels?**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    progress: {
                        level: 'V5',
                        dividendRate: 0.5,
                        teamNetDepositUsd: 3200000,
                        selfNetDepositUsd: 1250,
                        directTeamWalletCount: 12,
                        nextLevel: 'V6',
                        nextLevelThresholdUsd: 5000000,
                        remainingToNextUsd: 1800000,
                    },
                    latestSnapshot: {
                        snapshotDate: '2026-03-02T00:00:00.000Z',
                        level: 'V5',
                        dividendRate: 0.5,
                    },
                }),
            });
        });

        await page.route('**/api/participation/promotion?**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    progress: {
                        promotionLevel: 'V3',
                        directLegCount: 2,
                        leftNetDepositUsd: 900000,
                        rightNetDepositUsd: 550000,
                        weakZoneNetDepositUsd: 550000,
                        strongZoneNetDepositUsd: 900000,
                        nextLevel: 'V4',
                        nextLevelThresholdUsd: 1000000,
                        nextLevelGapUsd: 450000,
                    },
                    latestSnapshot: {
                        snapshotDate: '2026-03-02T00:00:00.000Z',
                        promotionLevel: 'V3',
                        nextLevel: 'V4',
                    },
                }),
            });
        });

        await page.goto('/en/participation');

        await expect(page.getByRole('heading', { name: 'Participation Dashboard' })).toBeVisible();
        await expect(page.getByText('Mode: MANAGED')).toBeVisible();
        await expect(page.getByText('1250.00 MCN')).toBeVisible();
        await expect(page.getByText('Dividend 50%')).toBeVisible();
        await expect(page.getByText('Direct legs 2')).toBeVisible();
        await expect(page.getByText('$3,200,000.00')).toBeVisible();
        await expect(page.getByText('$550,000.00').first()).toBeVisible();
        await expect(page.getByText('Open Managed Wealth')).toBeVisible();
    });
});
