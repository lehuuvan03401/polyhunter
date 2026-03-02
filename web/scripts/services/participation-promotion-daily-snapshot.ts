import 'dotenv/config';

type SnapshotResponse = {
    snapshotDate?: string;
    dryRun?: boolean;
    processed?: number;
    upserted?: number;
    error?: string;
};

function parseBool(value: string | undefined, fallback: boolean): boolean {
    if (!value) return fallback;
    return value.toLowerCase() === 'true';
}

function parseWalletList(value: string | undefined): string[] {
    if (!value) return [];
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizeDateInput(value: string | undefined, envName: string): string | undefined {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid ${envName}: ${value}`);
    }
    return parsed.toISOString();
}

async function main(): Promise<void> {
    const baseUrl = process.env.PARTICIPATION_OPS_BASE_URL || 'http://localhost:3000';
    const adminWallet =
        process.env.PARTICIPATION_OPS_ADMIN_WALLET ||
        process.env.ADMIN_WALLETS?.split(',').map((v) => v.trim()).filter(Boolean)[0] ||
        '';

    if (!adminWallet) {
        throw new Error('Missing PARTICIPATION_OPS_ADMIN_WALLET (or ADMIN_WALLETS first entry)');
    }

    const date = normalizeDateInput(
        process.env.PARTICIPATION_PROMOTION_SNAPSHOT_DATE,
        'PARTICIPATION_PROMOTION_SNAPSHOT_DATE'
    );
    const dryRun = parseBool(process.env.PARTICIPATION_PROMOTION_DRY_RUN, false);
    const walletAddresses = parseWalletList(process.env.PARTICIPATION_PROMOTION_WALLETS);

    const payload = {
        ...(date ? { date } : {}),
        ...(walletAddresses.length > 0 ? { walletAddresses } : {}),
        dryRun,
    };

    const res = await fetch(`${baseUrl}/api/participation/promotion`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-admin-wallet': adminWallet,
        },
        body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as SnapshotResponse;
    if (!res.ok) {
        throw new Error(
            `[participation-promotion-daily] failed status=${res.status} body=${JSON.stringify(data)}`
        );
    }

    console.log(
        `[participation-promotion-daily] success snapshotDate=${data.snapshotDate || date || 'auto'} dryRun=${data.dryRun ?? dryRun} processed=${data.processed ?? 0} upserted=${data.upserted ?? 0}`
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
