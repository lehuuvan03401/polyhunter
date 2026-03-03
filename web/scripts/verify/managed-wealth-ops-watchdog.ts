/**
 * managed-wealth-ops-watchdog.ts
 *
 * Periodic watchdog / health-check script for the Managed Wealth subsystem.
 * Designed to run as a cron job (e.g. every 5 minutes via PM2 cron or systemd).
 *
 * Exit codes:
 *   0 — all metrics within acceptable thresholds
 *   1 — one or more metrics breached threshold (log output shows detail)
 *
 * Required env vars:
 *   MW_OPS_BASE_URL          — base URL of the running Next.js app (default: http://localhost:3000)
 *   MW_OPS_ADMIN_WALLET      — admin wallet address for x-admin-wallet auth header
 *                              Falls back to ADMIN_WALLETS first comma-separated entry.
 *
 * Optional alert thresholds (all default to safe production values):
 *   MW_OPS_MAX_UNMAPPED           — max unmapped subscription count before alert (default: 5)
 *   MW_OPS_MAX_BACKLOG            — max liquidation backlog count before alert (default: 10)
 *   MW_OPS_MAX_PARITY_ISSUES      — max settlement parity issues before alert (default: 0)
 *   MW_OPS_MAX_FAILED_TASKS       — max failed liquidation tasks before alert (default: 3)
 *   MW_OPS_MAX_24H_ERRORS         — max 24h ERROR-severity risk events before alert (default: 5)
 *   MW_OPS_WINDOW_DAYS            — health check window in days (default: 7)
 */
import 'dotenv/config';

function resolveInt(envKey: string, fallback: number): number {
    const raw = process.env[envKey];
    if (!raw) return fallback;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

type HealthResponse = {
    generatedAt: string;
    allocation: {
        unmappedCount: number;
        executionScopeSubscriptions: number;
        mappedCount: number;
        staleMappingMinutes: number;
        staleUnmapped: Array<{ subscriptionId: string; status: string; walletAddress: string; ageMinutes: number }>;
    };
    liquidation: {
        backlogCount: number;
        backlogOldestAgeMinutes: number;
        taskStatus: { pending: number; retrying: number; blocked: number; failed: number };
    };
    settlementCommissionParity: {
        missingCount: number;
        feeMismatchCount: number;
        windowDays: number;
    };
    error?: string;
};

type RiskEventsResponse = {
    stats: Record<string, number>;
    total: number;
    error?: string;
};

interface CheckResult {
    name: string;
    observed: number;
    threshold: number;
    breach: boolean;
    detail?: string;
}

async function main(): Promise<void> {
    const baseUrl = process.env.MW_OPS_BASE_URL || 'http://localhost:3000';
    const adminWallet =
        process.env.MW_OPS_ADMIN_WALLET ||
        process.env.ADMIN_WALLETS?.split(',').map((v) => v.trim()).filter(Boolean)[0] ||
        '';

    if (!adminWallet) {
        throw new Error(
            '[managed-wealth-watchdog] Missing MW_OPS_ADMIN_WALLET (or ADMIN_WALLETS first entry)'
        );
    }

    const windowDays = resolveInt('MW_OPS_WINDOW_DAYS', 7);
    const maxUnmapped = resolveInt('MW_OPS_MAX_UNMAPPED', 5);
    const maxBacklog = resolveInt('MW_OPS_MAX_BACKLOG', 10);
    const maxParityIssues = resolveInt('MW_OPS_MAX_PARITY_ISSUES', 0);
    const maxFailedTasks = resolveInt('MW_OPS_MAX_FAILED_TASKS', 3);
    const max24hErrors = resolveInt('MW_OPS_MAX_24H_ERRORS', 5);

    const headers = { 'x-admin-wallet': adminWallet };
    const tag = '[managed-wealth-watchdog]';

    // ── 1. Fetch health ────────────────────────────────────────────────────────
    const healthRes = await fetch(
        `${baseUrl}/api/managed-settlement/health?windowDays=${windowDays}`,
        { headers }
    );
    const health = (await healthRes.json().catch(() => ({}))) as HealthResponse;
    if (!healthRes.ok) {
        throw new Error(`${tag} health fetch failed status=${healthRes.status} body=${JSON.stringify(health)}`);
    }

    // ── 2. Fetch risk events ───────────────────────────────────────────────────
    const riskRes = await fetch(`${baseUrl}/api/managed-risk-events?limit=1`, { headers });
    const risk = (await riskRes.json().catch(() => ({}))) as RiskEventsResponse;
    if (!riskRes.ok) {
        throw new Error(`${tag} risk-events fetch failed status=${riskRes.status} body=${JSON.stringify(risk)}`);
    }

    // ── 3. Evaluate checks ────────────────────────────────────────────────────
    const parityIssues =
        (health.settlementCommissionParity?.missingCount ?? 0) +
        (health.settlementCommissionParity?.feeMismatchCount ?? 0);

    const checks: CheckResult[] = [
        {
            name: 'unmapped_subscriptions',
            observed: health.allocation?.unmappedCount ?? 0,
            threshold: maxUnmapped,
            breach: (health.allocation?.unmappedCount ?? 0) > maxUnmapped,
            detail: health.allocation?.staleUnmapped
                ?.slice(0, 3)
                .map((s) => `${s.subscriptionId} (${s.ageMinutes}m)`)
                .join(', '),
        },
        {
            name: 'liquidation_backlog',
            observed: health.liquidation?.backlogCount ?? 0,
            threshold: maxBacklog,
            breach: (health.liquidation?.backlogCount ?? 0) > maxBacklog,
            detail: health.liquidation?.backlogCount > 0
                ? `oldest ${health.liquidation.backlogOldestAgeMinutes}m`
                : undefined,
        },
        {
            name: 'failed_liquidation_tasks',
            observed: health.liquidation?.taskStatus?.failed ?? 0,
            threshold: maxFailedTasks,
            breach: (health.liquidation?.taskStatus?.failed ?? 0) > maxFailedTasks,
        },
        {
            name: 'settlement_parity_issues',
            observed: parityIssues,
            threshold: maxParityIssues,
            breach: parityIssues > maxParityIssues,
        },
        {
            name: 'risk_events_24h_error',
            observed: risk.stats?.ERROR ?? 0,
            threshold: max24hErrors,
            breach: (risk.stats?.ERROR ?? 0) > max24hErrors,
            detail: risk.stats?.WARN ? `WARN=${risk.stats.WARN}` : undefined,
        },
    ];

    // ── 4. Log summary ────────────────────────────────────────────────────────
    const generatedAt = health.generatedAt ?? new Date().toISOString();
    console.log(`${tag} check run at ${new Date().toISOString()} (health snapshot: ${generatedAt})`);
    console.log(`${tag} thresholds: unmapped<=${maxUnmapped} backlog<=${maxBacklog} parity<=${maxParityIssues} failed-tasks<=${maxFailedTasks} 24h-errors<=${max24hErrors}`);

    const breaches: CheckResult[] = [];
    for (const check of checks) {
        const icon = check.breach ? '🚨' : '✅';
        const detail = check.detail ? ` (${check.detail})` : '';
        console.log(`${tag} ${icon} ${check.name}: observed=${check.observed} threshold=${check.threshold}${detail}`);
        if (check.breach) breaches.push(check);
    }

    if (breaches.length > 0) {
        const names = breaches.map((c) => c.name).join(', ');
        throw new Error(`${tag} ${breaches.length} check(s) breached threshold: ${names}. See logs above.`);
    }

    console.log(`${tag} all checks passed`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
