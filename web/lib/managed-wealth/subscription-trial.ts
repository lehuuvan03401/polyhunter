const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function resolveManagedSubscriptionTrial(params: {
    existingSubscriptionCount: number;
    termDurationDays: number;
    now: Date;
}): {
    trialApplied: boolean;
    trialEndsAt: Date | null;
} {
    const isNewcomer = params.existingSubscriptionCount <= 0;
    const isOneDayTerm = params.termDurationDays <= 1;
    const trialApplied = isNewcomer && isOneDayTerm;

    return {
        trialApplied,
        trialEndsAt: trialApplied ? new Date(params.now.getTime() + ONE_DAY_MS) : null,
    };
}
