import { afterEach, describe, expect, it } from 'vitest';
import {
    buildCopyTradePendingExpiryDate,
    getCopyTradePendingExpiryMinutes,
    getCopyTradePendingExpiryMs,
} from './copy-trade-lifecycle.js';

const ORIGINAL_PENDING_EXPIRY = process.env.COPY_TRADING_PENDING_EXPIRY_MINUTES;

describe('copy trade lifecycle helpers', () => {
    afterEach(() => {
        if (ORIGINAL_PENDING_EXPIRY === undefined) {
            delete process.env.COPY_TRADING_PENDING_EXPIRY_MINUTES;
        } else {
            process.env.COPY_TRADING_PENDING_EXPIRY_MINUTES = ORIGINAL_PENDING_EXPIRY;
        }
    });

    it('uses the default pending expiry when env is missing', () => {
        delete process.env.COPY_TRADING_PENDING_EXPIRY_MINUTES;

        expect(getCopyTradePendingExpiryMinutes()).toBe(10);
        expect(getCopyTradePendingExpiryMs()).toBe(600000);
    });

    it('builds the pending expiry from the configured minutes', () => {
        process.env.COPY_TRADING_PENDING_EXPIRY_MINUTES = '3';
        const now = new Date('2026-03-06T00:00:00.000Z');

        expect(buildCopyTradePendingExpiryDate(now).toISOString()).toBe('2026-03-06T00:03:00.000Z');
    });
});
