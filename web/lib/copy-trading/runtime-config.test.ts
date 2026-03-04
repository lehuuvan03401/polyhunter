import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadRuntimeConfig() {
    vi.resetModules();
    return import('./runtime-config');
}

afterEach(() => {
    for (const key of Object.keys(process.env)) {
        if (!(key in ORIGINAL_ENV)) {
            delete process.env[key];
        }
    }
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    vi.unstubAllEnvs();
    vi.resetModules();
});

describe('copy-trading runtime config', () => {
    it('requires signatures in production regardless of legacy flags', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('COPY_TRADING_REQUIRE_SIGNATURE', 'false');
        vi.stubEnv('MANAGED_WEALTH_REQUIRE_SIGNATURE', 'false');

        const mod = await loadRuntimeConfig();
        expect(mod.isCopyTradingSignatureRequired()).toBe(true);
        expect(mod.isCopyTradingMockAuthBypassEnabled()).toBe(false);
    });

    it('rejects conflicting chain ids', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('CHAIN_ID', '137');
        vi.stubEnv('NEXT_PUBLIC_CHAIN_ID', '31337');

        const mod = await loadRuntimeConfig();
        expect(() => mod.getCopyTradingChainId()).toThrow(/Conflicting chain id/);
    });

    it('requires an explicit chain id in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        delete process.env.CHAIN_ID;
        delete process.env.NEXT_PUBLIC_CHAIN_ID;

        const mod = await loadRuntimeConfig();
        expect(() => mod.getCopyTradingChainId()).toThrow(/CHAIN_ID or NEXT_PUBLIC_CHAIN_ID is required/);
    });

    it('requires an explicit dry-run flag in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        delete process.env.DRY_RUN;
        delete process.env.COPY_TRADING_DRY_RUN;

        const mod = await loadRuntimeConfig();
        expect(() => mod.isCopyTradingDryRunEnabled()).toThrow(/COPY_TRADING_DRY_RUN or DRY_RUN is required/);
    });

    it('rejects placeholder cron secret and validates bearer header', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('CRON_SECRET', 'super-secret');

        const mod = await loadRuntimeConfig();
        expect(mod.verifyCopyTradingCronAuthorizationHeader('Bearer super-secret')).toBe(true);
        expect(mod.verifyCopyTradingCronAuthorizationHeader('Bearer wrong')).toBe(false);

        vi.stubEnv('CRON_SECRET', 'dev-cron-secret');
        const reloaded = await loadRuntimeConfig();
        expect(() => reloaded.getCopyTradingCronSecret()).toThrow(/insecure default placeholder/);
    });

    it('rejects placeholder encryption keys', async () => {
        vi.stubEnv('ENCRYPTION_KEY', '0'.repeat(64));

        const mod = await loadRuntimeConfig();
        expect(() => mod.assertCopyTradingEncryptionKeyConfigured()).toThrow(/all-zero placeholder/);
    });
});
