type AmountCapReservation = {
    usedUsd: number;
    reservedUsd: number;
    capUsd: number;
};

type CountCapReservation = {
    usedCount: number;
    reservedCount: number;
    capCount: number;
};

export type ReservationSafeGuardrailInput = {
    amountUsd: number;
    global?: AmountCapReservation;
    wallet?: AmountCapReservation;
    market?: AmountCapReservation;
    window?: CountCapReservation;
};

export type ReservationSafeGuardrailResult = {
    allowed: boolean;
    reason?: string;
};

function normalizeNumber(value: number): number {
    return Number.isFinite(value) ? value : 0;
}

function exceedsAmountCap(amountUsd: number, scope?: AmountCapReservation): boolean {
    if (!scope || scope.capUsd <= 0) return false;
    return normalizeNumber(scope.usedUsd) + normalizeNumber(scope.reservedUsd) + amountUsd > scope.capUsd;
}

export function evaluateReservationSafeGuardrails(
    input: ReservationSafeGuardrailInput
): ReservationSafeGuardrailResult {
    const amountUsd = normalizeNumber(input.amountUsd);

    if (exceedsAmountCap(amountUsd, input.global)) {
        return {
            allowed: false,
            reason: `GLOBAL_DAILY_CAP_EXCEEDED (${normalizeNumber(input.global!.usedUsd).toFixed(2)} + ${normalizeNumber(input.global!.reservedUsd).toFixed(2)} reserved + ${amountUsd.toFixed(2)} > ${input.global!.capUsd})`,
        };
    }

    if (exceedsAmountCap(amountUsd, input.wallet)) {
        return {
            allowed: false,
            reason: `WALLET_DAILY_CAP_EXCEEDED (${normalizeNumber(input.wallet!.usedUsd).toFixed(2)} + ${normalizeNumber(input.wallet!.reservedUsd).toFixed(2)} reserved + ${amountUsd.toFixed(2)} > ${input.wallet!.capUsd})`,
        };
    }

    if (exceedsAmountCap(amountUsd, input.market)) {
        return {
            allowed: false,
            reason: `MARKET_DAILY_CAP_EXCEEDED (${normalizeNumber(input.market!.usedUsd).toFixed(2)} + ${normalizeNumber(input.market!.reservedUsd).toFixed(2)} reserved + ${amountUsd.toFixed(2)} > ${input.market!.capUsd})`,
        };
    }

    if (input.window && input.window.capCount > 0) {
        const usedCount = normalizeNumber(input.window.usedCount);
        const reservedCount = normalizeNumber(input.window.reservedCount);
        if (usedCount + reservedCount >= input.window.capCount) {
            return {
                allowed: false,
                reason: `TRADE_RATE_LIMIT_EXCEEDED (${usedCount} + ${reservedCount} reserved >= ${input.window.capCount})`,
            };
        }
    }

    return { allowed: true };
}
