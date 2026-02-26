import 'dotenv/config';

type PendingRefund = {
    id: string;
    amountUsd: number;
    requestedAt: string;
    seat: {
        walletAddress: string;
    };
    elimination: {
        monthKey: string;
        refundDeadlineAt: string;
    };
};

type RefundQueueResponse = {
    refunds?: PendingRefund[];
    error?: string;
};

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
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

    const allowedOverdue = parseNonNegativeInt(process.env.PARTNER_REFUND_SLA_ALLOWED_OVERDUE, 0);
    const now = Date.now();

    const res = await fetch(`${baseUrl}/api/partners/refunds?status=PENDING`, {
        headers: {
            'x-admin-wallet': adminWallet,
        },
    });

    const data = (await res.json().catch(() => ({}))) as RefundQueueResponse;
    if (!res.ok) {
        throw new Error(
            `[partner-refund-sla] failed status=${res.status} body=${JSON.stringify(data)}`
        );
    }

    const refunds = data.refunds ?? [];
    const overdue = refunds.filter((refund) => {
        const deadline = new Date(refund.elimination.refundDeadlineAt).getTime();
        return Number.isFinite(deadline) && deadline < now;
    });

    console.log(
        `[partner-refund-sla] pending=${refunds.length} overdue=${overdue.length} allowedOverdue=${allowedOverdue}`
    );

    if (overdue.length > 0) {
        console.log('[partner-refund-sla] overdue refunds:');
        for (const row of overdue) {
            console.log(
                `  refundId=${row.id} wallet=${row.seat.walletAddress} monthKey=${row.elimination.monthKey} deadline=${row.elimination.refundDeadlineAt} amountUsd=${row.amountUsd}`
            );
        }
    }

    if (overdue.length > allowedOverdue) {
        throw new Error(
            `[partner-refund-sla] overdue refunds exceed threshold (${overdue.length} > ${allowedOverdue})`
        );
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
