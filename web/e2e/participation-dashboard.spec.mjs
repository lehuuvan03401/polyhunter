import { expect, test } from '@playwright/test';

const MOCK_WALLET = (process.env.NEXT_PUBLIC_E2E_MOCK_WALLET ?? '0x1111111111111111111111111111111111111111').toLowerCase();

test.describe('Participation dashboard E2E', () => {
    test('authenticated user can register, activate managed mode, and manage custody authorization', async ({ page }) => {
        const state = {
            account: null,
            activeAuthorization: null,
            recentAuthorizations: [],
        };

        await page.route('**/api/participation/account?**', async (route) => {
            const request = route.request();
            expect(request.headers()['x-wallet-address']).toBe(MOCK_WALLET);

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    account: state.account,
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

        await page.route('**/api/participation/account', async (route) => {
            if (route.request().method() !== 'POST') {
                await route.continue();
                return;
            }

            const payload = route.request().postDataJSON();

            if (payload.action === 'REGISTER') {
                state.account = {
                    status: 'PENDING',
                    preferredMode: null,
                    isRegistrationComplete: true,
                    registrationCompletedAt: '2026-03-01T00:00:00.000Z',
                    activatedAt: null,
                };

                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        account: state.account,
                        message: 'Registration completed',
                    }),
                });
                return;
            }

            state.account = {
                status: 'ACTIVE',
                preferredMode: payload.mode,
                isRegistrationComplete: true,
                registrationCompletedAt: '2026-03-01T00:00:00.000Z',
                activatedAt: '2026-03-02T00:00:00.000Z',
            };

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    account: state.account,
                    message: 'Participation activated',
                }),
            });
        });

        await page.route('**/api/participation/custody-auth?**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    activeAuthorization: state.activeAuthorization,
                    recentAuthorizations: state.recentAuthorizations,
                }),
            });
        });

        await page.route('**/api/participation/custody-auth', async (route) => {
            const method = route.request().method();

            if (method === 'POST') {
                const authorization = {
                    id: 'auth-e2e-1',
                    mode: 'MANAGED',
                    status: 'ACTIVE',
                    grantedAt: '2026-03-02T01:00:00.000Z',
                    revokedAt: null,
                    createdAt: '2026-03-02T01:00:00.000Z',
                };

                state.activeAuthorization = authorization;
                state.recentAuthorizations = [
                    authorization,
                    ...state.recentAuthorizations.filter((item) => item.id !== authorization.id),
                ];

                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify({ authorization }),
                });
                return;
            }

            if (method === 'DELETE') {
                if (!state.activeAuthorization) {
                    await route.fulfill({
                        status: 404,
                        contentType: 'application/json',
                        body: JSON.stringify({ error: 'No active authorization found' }),
                    });
                    return;
                }

                const revokedAuthorization = {
                    ...state.activeAuthorization,
                    status: 'REVOKED',
                    revokedAt: '2026-03-02T02:00:00.000Z',
                };

                state.activeAuthorization = null;
                state.recentAuthorizations = [
                    revokedAuthorization,
                    ...state.recentAuthorizations.filter((item) => item.id !== revokedAuthorization.id),
                ];

                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ revoked: 1 }),
                });
                return;
            }

            await route.continue();
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
        await expect(page.getByText('NOT_REGISTERED')).toBeVisible();
        await page.getByRole('button', { name: 'Complete Registration' }).click();
        await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible();

        await page.getByRole('button', { name: 'Activate MANAGED Mode' }).click();
        await expect(page.getByText('Mode: MANAGED')).toBeVisible();
        await page.getByRole('button', { name: 'Authorize Managed Custody' }).click();

        const custodyPanel = page.locator('section').filter({
            has: page.getByRole('heading', { name: 'Managed Custody Authorization' }),
        });
        await expect(custodyPanel.getByText('ACTIVE', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Revoke Authorization' })).toBeVisible();

        await page.getByRole('button', { name: 'Revoke Authorization' }).click();
        await expect(custodyPanel.getByText('NOT_AUTHORIZED', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Authorize Managed Custody' })).toBeVisible();

        await expect(page.getByText('1250.00 MCN')).toBeVisible();
        await expect(page.getByText('Dividend 50%')).toBeVisible();
        await expect(page.getByText('Direct legs 2')).toBeVisible();
        await expect(page.getByText('$3,200,000.00')).toBeVisible();
        await expect(page.getByText('$550,000.00').first()).toBeVisible();
        await expect(page.getByText('Open Managed Wealth')).toBeVisible();
    });

    test('shows activation failure banner when managed activation is rejected by API', async ({ page }) => {
        const state = {
            account: {
                status: 'PENDING',
                preferredMode: null,
                isRegistrationComplete: true,
                registrationCompletedAt: '2026-03-01T00:00:00.000Z',
                activatedAt: null,
            },
        };

        await page.route('**/api/participation/account?**', async (route) => {
            const request = route.request();
            expect(request.headers()['x-wallet-address']).toBe(MOCK_WALLET);

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    account: state.account,
                    netDeposits: {
                        depositUsd: 450,
                        withdrawUsd: 0,
                        netUsd: 450,
                        depositMcn: 450,
                        withdrawMcn: 0,
                        netMcnEquivalent: 450,
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

        await page.route('**/api/participation/account', async (route) => {
            if (route.request().method() !== 'POST') {
                await route.continue();
                return;
            }

            const payload = route.request().postDataJSON();
            if (payload.action === 'ACTIVATE' && payload.mode === 'MANAGED') {
                await route.fulfill({
                    status: 409,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: 'Qualified funding required before activation',
                        mode: 'MANAGED',
                        requiredThreshold: 500,
                        currentNetMcnEquivalent: 450,
                        deficit: 50,
                    }),
                });
                return;
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    account: state.account,
                    message: 'noop',
                }),
            });
        });

        await page.route('**/api/participation/custody-auth?**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    activeAuthorization: null,
                    recentAuthorizations: [],
                }),
            });
        });

        await page.route('**/api/participation/levels?**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    progress: null,
                    latestSnapshot: null,
                }),
            });
        });

        await page.route('**/api/participation/promotion?**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    progress: null,
                    latestSnapshot: null,
                }),
            });
        });

        await page.goto('/en/participation');

        await expect(page.getByRole('button', { name: 'Activate MANAGED Mode' })).toBeVisible();
        await page.getByRole('button', { name: 'Activate MANAGED Mode' }).click();
        await expect(
            page.getByRole('main').getByText('Qualified funding required before activation')
        ).toBeVisible();
        await expect(page.getByText('Mode not selected')).toBeVisible();
    });

    test('renders localized participation dashboard in zh-CN locale', async ({ page }) => {
        const state = {
            account: null,
        };

        await page.route('**/api/participation/account?**', async (route) => {
            const request = route.request();
            expect(request.headers()['x-wallet-address']).toBe(MOCK_WALLET);

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    account: state.account,
                    netDeposits: {
                        depositUsd: 0,
                        withdrawUsd: 0,
                        netUsd: 0,
                        depositMcn: 0,
                        withdrawMcn: 0,
                        netMcnEquivalent: 0,
                    },
                    eligibility: {
                        freeQualified: false,
                        managedQualified: false,
                        thresholds: {
                            FREE: 100,
                            MANAGED: 500,
                        },
                    },
                }),
            });
        });

        await page.route('**/api/participation/custody-auth?**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    activeAuthorization: null,
                    recentAuthorizations: [],
                }),
            });
        });

        await page.route('**/api/participation/levels?**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    progress: null,
                    latestSnapshot: null,
                }),
            });
        });

        await page.route('**/api/participation/promotion?**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    progress: null,
                    latestSnapshot: null,
                }),
            });
        });

        await page.goto('/zh-CN/participation');

        await expect(page.getByRole('heading', { name: '参与体系看板' })).toBeVisible();
        await expect(page.getByText('账户状态')).toBeVisible();
        await expect(page.getByText('建议下一步')).toBeVisible();
        await expect(page.getByRole('button', { name: '完成注册' })).toBeVisible();
    });
});
