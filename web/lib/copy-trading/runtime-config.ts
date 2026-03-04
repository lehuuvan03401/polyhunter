import { createHash, timingSafeEqual } from 'crypto';

const ZERO_HEX_64 = '0'.repeat(64);

function parseBoolean(value: string | undefined): boolean | null {
    if (value === undefined) return null;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return null;
}

function parseInteger(value: string | undefined): number | null {
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
}

function assertNoConflictingIntegers(label: string, entries: Array<[string, number | null]>): void {
    const defined = entries.filter((entry): entry is [string, number] => entry[1] !== null);
    if (defined.length <= 1) return;

    const unique = new Set(defined.map(([, value]) => value));
    if (unique.size <= 1) return;

    const rendered = defined.map(([key, value]) => `${key}=${value}`).join(', ');
    throw new Error(`[CopyTradingConfig] Conflicting ${label}: ${rendered}`);
}

function assertNoConflictingBooleans(label: string, entries: Array<[string, boolean | null]>): void {
    const defined = entries.filter((entry): entry is [string, boolean] => entry[1] !== null);
    if (defined.length <= 1) return;

    const unique = new Set(defined.map(([, value]) => value));
    if (unique.size <= 1) return;

    const rendered = defined.map(([key, value]) => `${key}=${value}`).join(', ');
    throw new Error(`[CopyTradingConfig] Conflicting ${label}: ${rendered}`);
}

function validateHexKey(input: string, name: string): void {
    if (!/^[0-9a-fA-F]{64}$/.test(input)) {
        throw new Error(`[CopyTradingConfig] ${name} must be 64 hex characters`);
    }
    if (input.toLowerCase() === ZERO_HEX_64) {
        throw new Error(`[CopyTradingConfig] ${name} cannot be an all-zero placeholder`);
    }
}

export function getCopyTradingChainId(): number {
    const chainId = parseInteger(process.env.CHAIN_ID);
    const publicChainId = parseInteger(process.env.NEXT_PUBLIC_CHAIN_ID);

    assertNoConflictingIntegers('chain id', [
        ['CHAIN_ID', chainId],
        ['NEXT_PUBLIC_CHAIN_ID', publicChainId],
    ]);

    if (chainId !== null) return chainId;
    if (publicChainId !== null) return publicChainId;

    return process.env.NODE_ENV === 'production' ? 137 : 31337;
}

export function isCopyTradingDryRunEnabled(): boolean {
    const dryRun = parseBoolean(process.env.DRY_RUN);
    const copyDryRun = parseBoolean(process.env.COPY_TRADING_DRY_RUN);

    assertNoConflictingBooleans('dry-run flag', [
        ['DRY_RUN', dryRun],
        ['COPY_TRADING_DRY_RUN', copyDryRun],
    ]);

    return copyDryRun ?? dryRun ?? false;
}

export function isCopyTradingSignatureRequired(): boolean {
    if (process.env.NODE_ENV === 'production') return true;

    const copyFlag = parseBoolean(process.env.COPY_TRADING_REQUIRE_SIGNATURE);
    if (copyFlag !== null) return copyFlag;

    const legacyFlag = parseBoolean(process.env.MANAGED_WEALTH_REQUIRE_SIGNATURE);
    if (legacyFlag !== null) return legacyFlag;

    return false;
}

export function isCopyTradingMockAuthBypassEnabled(): boolean {
    if (process.env.NODE_ENV === 'production') return false;
    return process.env.NEXT_PUBLIC_E2E_MOCK_AUTH === 'true';
}

export function isCopyTradingSimulationMutationEnabled(): boolean {
    const enabled = parseBoolean(process.env.COPY_TRADING_SIMULATION_ENABLED);
    return enabled === true;
}

export function getCopyTradingCronSecret(): string {
    const value = process.env.CRON_SECRET?.trim();
    if (!value) {
        throw new Error('[CopyTradingConfig] CRON_SECRET is required');
    }
    if (value === 'dev-cron-secret') {
        throw new Error('[CopyTradingConfig] CRON_SECRET uses insecure default placeholder');
    }
    return value;
}

export function assertCopyTradingEncryptionKeyConfigured(): string {
    const value = process.env.ENCRYPTION_KEY?.trim();
    if (!value) {
        throw new Error('[CopyTradingConfig] ENCRYPTION_KEY is required');
    }
    validateHexKey(value, 'ENCRYPTION_KEY');
    return value.toLowerCase();
}

function sha256(input: string): Buffer {
    return createHash('sha256').update(input).digest();
}

export function verifyCopyTradingCronAuthorizationHeader(authHeader: string | null): boolean {
    if (!authHeader) return false;
    const expected = `Bearer ${getCopyTradingCronSecret()}`;
    const providedHash = sha256(authHeader);
    const expectedHash = sha256(expected);
    return timingSafeEqual(providedHash, expectedHash);
}
