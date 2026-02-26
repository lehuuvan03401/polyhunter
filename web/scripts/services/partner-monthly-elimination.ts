import 'dotenv/config';

type EliminationResponse = {
    monthKey?: string;
    eliminated?: number;
    eliminateCount?: number;
    code?: string;
    error?: string;
};

function toMonthKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
    if (!value) return fallback;
    return value.toLowerCase() === 'true';
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
}

async function main(): Promise<void> {
    const baseUrl = process.env.PARTNER_OPS_BASE_URL || 'http://localhost:3000';
    const adminWallet =
        process.env.PARTNER_OPS_ADMIN_WALLET ||
        process.env.ADMIN_WALLETS?.split(',').map((v) => v.trim()).filter(Boolean)[0] ||
        '';

    if (!adminWallet) {
        throw new Error('Missing PARTNER_OPS_ADMIN_WALLET (or ADMIN_WALLETS first entry)');
    }

    const monthKey = process.env.PARTNER_ELIMINATION_MONTH_KEY || toMonthKey(new Date());
    const eliminateCount = parsePositiveInt(process.env.PARTNER_ELIMINATION_COUNT, 10);
    const dryRun = parseBool(process.env.PARTNER_ELIMINATION_DRY_RUN, false);
    const allowExistingCycle = parseBool(process.env.PARTNER_ELIMINATION_ALLOW_EXISTING_CYCLE, true);
    const reason = process.env.PARTNER_ELIMINATION_REASON || 'scheduler-month-end';

    const payload = {
        monthKey,
        eliminateCount,
        dryRun,
        reason,
    };

    const res = await fetch(`${baseUrl}/api/partners/cycle/eliminate`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-admin-wallet': adminWallet,
        },
        body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as EliminationResponse;

    if (res.ok) {
        console.log(
            `[partner-monthly-elimination] success monthKey=${data.monthKey || monthKey} dryRun=${dryRun} eliminateCount=${data.eliminateCount ?? eliminateCount} eliminated=${data.eliminated ?? 0}`
        );
        return;
    }

    if (allowExistingCycle && res.status === 409 && data.code === 'CYCLE_ALREADY_EXECUTED') {
        console.log(
            `[partner-monthly-elimination] skipped monthKey=${monthKey} reason=already_executed`
        );
        return;
    }

    throw new Error(
        `[partner-monthly-elimination] failed status=${res.status} body=${JSON.stringify(data)}`
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
