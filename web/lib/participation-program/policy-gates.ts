export function resolveManagedPolicyGate(
    envValue: string | undefined,
    nodeEnv: string | undefined
): boolean {
    if (envValue === 'true') return true;
    // Production policy hard-gate: managed checks are mandatory even if env is set to false.
    if (nodeEnv === 'production') return true;
    return false;
}

export function resolveSameLevelBonusPolicy(
    envValue: string | undefined,
    nodeEnv: string | undefined
): {
    enabled: boolean;
    auditMessage: string | null;
} {
    if (envValue === 'true') {
        return { enabled: true, auditMessage: null };
    }

    if (envValue === 'false') {
        const auditMessage = nodeEnv === 'production'
            ? '[AffiliateEngine][AUDIT] Same-level bonus disabled in production via PARTICIPATION_ENABLE_SAME_LEVEL_BONUS=false'
            : null;
        return {
            enabled: false,
            auditMessage,
        };
    }

    // Production default is enabled. Non-production keeps explicit opt-in.
    return {
        enabled: nodeEnv === 'production',
        auditMessage: null,
    };
}
