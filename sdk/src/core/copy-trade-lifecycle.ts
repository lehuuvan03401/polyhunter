const DEFAULT_PENDING_EXPIRY_MINUTES = 10;

export function getCopyTradePendingExpiryMinutes(): number {
    const raw = Number.parseInt(process.env.COPY_TRADING_PENDING_EXPIRY_MINUTES || '', 10);
    if (!Number.isFinite(raw) || raw <= 0) {
        return DEFAULT_PENDING_EXPIRY_MINUTES;
    }
    return raw;
}

export function getCopyTradePendingExpiryMs(): number {
    return getCopyTradePendingExpiryMinutes() * 60 * 1000;
}

export function buildCopyTradePendingExpiryDate(now: Date = new Date()): Date {
    return new Date(now.getTime() + getCopyTradePendingExpiryMs());
}
