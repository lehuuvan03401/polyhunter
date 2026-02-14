import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3210);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const mockWallet = process.env.NEXT_PUBLIC_E2E_MOCK_WALLET ?? '0x1111111111111111111111111111111111111111';

export default defineConfig({
    testDir: './e2e',
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL,
        trace: 'retain-on-failure',
    },
    webServer: process.env.PLAYWRIGHT_BASE_URL
        ? undefined
        : {
            command: `NEXT_PUBLIC_E2E_MOCK_AUTH=true NEXT_PUBLIC_E2E_MOCK_WALLET=${mockWallet} npm run build && NEXT_PUBLIC_E2E_MOCK_AUTH=true NEXT_PUBLIC_E2E_MOCK_WALLET=${mockWallet} npm run start -- --port ${port}`,
            url: `${baseURL}/en/managed-wealth`,
            reuseExistingServer: !process.env.CI,
            timeout: 240_000,
        },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
            },
        },
    ],
});
