import { describe, expect, it } from 'vitest';

import { evaluateReservationSafeGuardrails } from './guardrail-reservations';

describe('evaluateReservationSafeGuardrails', () => {
    it('blocks a second wallet reservation when combined reserved amount would exceed the cap', () => {
        const firstAttempt = evaluateReservationSafeGuardrails({
            amountUsd: 8,
            wallet: {
                usedUsd: 90,
                reservedUsd: 0,
                capUsd: 100,
            },
        });

        expect(firstAttempt.allowed).toBe(true);

        const secondAttempt = evaluateReservationSafeGuardrails({
            amountUsd: 8,
            wallet: {
                usedUsd: 90,
                reservedUsd: 8,
                capUsd: 100,
            },
        });

        expect(secondAttempt).toEqual({
            allowed: false,
            reason: 'WALLET_DAILY_CAP_EXCEEDED (90.00 + 8.00 reserved + 8.00 > 100)',
        });
    });

    it('allows a later reservation after reserved capacity is released', () => {
        const attempt = evaluateReservationSafeGuardrails({
            amountUsd: 8,
            wallet: {
                usedUsd: 90,
                reservedUsd: 0,
                capUsd: 100,
            },
            window: {
                usedCount: 1,
                reservedCount: 0,
                capCount: 2,
            },
        });

        expect(attempt.allowed).toBe(true);
    });

    it('enforces trade-rate reservations using reserved count as well as executed count', () => {
        const attempt = evaluateReservationSafeGuardrails({
            amountUsd: 5,
            window: {
                usedCount: 4,
                reservedCount: 1,
                capCount: 5,
            },
        });

        expect(attempt).toEqual({
            allowed: false,
            reason: 'TRADE_RATE_LIMIT_EXCEEDED (4 + 1 reserved >= 5)',
        });
    });
});
