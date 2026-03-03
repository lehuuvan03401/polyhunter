const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Minimum account age (days) before a trial is eligible.
 * Controlled by MANAGED_TRIAL_MIN_ACCOUNT_AGE_DAYS (default: 1 day).
 */
function resolveTrialMinAccountAgeDays(): number {
    const raw = process.env.MANAGED_TRIAL_MIN_ACCOUNT_AGE_DAYS;
    if (!raw) return 1;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}

export function resolveManagedSubscriptionTrial(params: {
    existingSubscriptionCount: number;
    /** Number of prior subscriptions that had trialApplied = true. */
    priorTrialCount: number;
    termDurationDays: number;
    /** When the participation account was created (for min-age check). */
    accountCreatedAt: Date;
    now: Date;
}): {
    trialApplied: boolean;
    trialEndsAt: Date | null;
    trialDeniedReason: string | null;
} {
    const isNewcomer = params.existingSubscriptionCount <= 0;
    const isOneDayTerm = params.termDurationDays <= 1;

    if (!isNewcomer || !isOneDayTerm) {
        return { trialApplied: false, trialEndsAt: null, trialDeniedReason: null };
    }

    // Anti-abuse guard 1: wallet has already used a trial before
    if (params.priorTrialCount > 0) {
        return {
            trialApplied: false,
            trialEndsAt: null,
            trialDeniedReason: 'Trial already used on this wallet',
        };
    }

    // Anti-abuse guard 2: account must meet minimum age requirement
    const minAgeDays = resolveTrialMinAccountAgeDays();
    const accountAgeMs = params.now.getTime() - params.accountCreatedAt.getTime();
    const accountAgeDays = accountAgeMs / ONE_DAY_MS;
    if (accountAgeDays < minAgeDays) {
        return {
            trialApplied: false,
            trialEndsAt: null,
            trialDeniedReason: `Account must be at least ${minAgeDays} day(s) old to receive trial`,
        };
    }

    return {
        trialApplied: true,
        trialEndsAt: new Date(params.now.getTime() + ONE_DAY_MS),
        trialDeniedReason: null,
    };
}
