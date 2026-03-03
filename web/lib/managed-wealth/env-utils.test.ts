import { describe, expect, it, afterAll } from 'vitest';
import { resolveNumberEnv } from './env-utils';

describe('resolveNumberEnv', () => {
    const backupEnv: Record<string, string | undefined> = {};

    afterAll(() => {
        // Restore modified env vars
        Object.entries(backupEnv).forEach(([k, v]) => {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        });
    });

    it('returns default when env var is not set', () => {
        backupEnv['TEST_NUM_ENV'] = process.env['TEST_NUM_ENV'];
        delete process.env['TEST_NUM_ENV'];
        expect(resolveNumberEnv('TEST_NUM_ENV', 42, 0, 100)).toBe(42);
    });

    it('parses a valid numeric env var', () => {
        process.env['TEST_NUM_ENV'] = '75';
        expect(resolveNumberEnv('TEST_NUM_ENV', 42, 0, 100)).toBe(75);
    });

    it('clamps value to min', () => {
        process.env['TEST_NUM_ENV'] = '-10';
        expect(resolveNumberEnv('TEST_NUM_ENV', 42, 0, 100)).toBe(0);
    });

    it('clamps value to max', () => {
        process.env['TEST_NUM_ENV'] = '200';
        expect(resolveNumberEnv('TEST_NUM_ENV', 42, 0, 100)).toBe(100);
    });

    it('returns default for non-numeric value', () => {
        process.env['TEST_NUM_ENV'] = 'notanumber';
        expect(resolveNumberEnv('TEST_NUM_ENV', 42, 0, 100)).toBe(42);
    });

    it('returns exact boundary value when on boundary', () => {
        process.env['TEST_NUM_ENV'] = '100';
        expect(resolveNumberEnv('TEST_NUM_ENV', 42, 0, 100)).toBe(100);
    });
});
