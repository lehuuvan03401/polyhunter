import { describe, expect, it } from 'vitest';
import { resolveManagedLiquidationIntent } from './liquidation-intent';

describe('resolveManagedLiquidationIntent', () => {
    it('returns BLOCKED when copy config is missing', () => {
        const intent = resolveManagedLiquidationIntent({
            hasCopyConfig: false,
            indicativeBidPrice: 0.42,
        });

        expect(intent.status).toBe('BLOCKED');
        expect(intent.errorCode).toBe('MISSING_COPY_CONFIG');
    });

    it('returns RETRYING when there is no executable bid', () => {
        const intent = resolveManagedLiquidationIntent({
            hasCopyConfig: true,
            indicativeBidPrice: 0,
        });

        expect(intent.status).toBe('RETRYING');
        expect(intent.errorCode).toBe('NO_BID_LIQUIDITY');
    });

    it('returns PENDING when liquidation is executable', () => {
        const intent = resolveManagedLiquidationIntent({
            hasCopyConfig: true,
            indicativeBidPrice: 0.35,
        });

        expect(intent.status).toBe('PENDING');
        expect(intent.errorCode).toBe('PENDING_EXTERNAL_EXECUTION');
    });
});
