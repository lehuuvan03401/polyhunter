import 'dotenv/config';
import {
    evaluateRefundSla,
    parseNonNegativeInt,
    type PendingRefund,
} from '@/lib/participation-program/partner-ops-automation';

type RefundQueueResponse = {
    refunds?: PendingRefund[];
    error?: string;
};

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
    const evaluation = evaluateRefundSla({
        refunds,
        nowMs: now,
        allowedOverdue,
    });

    console.log(
        `[partner-refund-sla] pending=${evaluation.pendingCount} overdue=${evaluation.overdueCount} allowedOverdue=${allowedOverdue}`
    );

    if (evaluation.overdueCount > 0) {
        console.log('[partner-refund-sla] overdue refunds:');
        for (const row of evaluation.overdue) {
            console.log(
                `  refundId=${row.id} wallet=${row.seat.walletAddress} monthKey=${row.elimination.monthKey} deadline=${row.elimination.refundDeadlineAt} amountUsd=${row.amountUsd}`
            );
        }
    }

    if (evaluation.breach) {
        throw new Error(
            `[partner-refund-sla] overdue refunds exceed threshold (${evaluation.overdueCount} > ${allowedOverdue})`
        );
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
