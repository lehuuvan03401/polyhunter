import { ethers } from 'ethers';
import { buildManagedWalletAuthMessage } from '@/lib/managed-wealth/wallet-auth-message';

export type EliminationResponse = {
    monthKey?: string;
    eliminated?: number;
    eliminateCount?: number;
    code?: string;
    error?: string;
};

export type EliminationEvaluation = {
    status: 'success' | 'skipped';
    reason?: 'already_executed';
};

export type PendingRefund = {
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

export function toMonthKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

export function parseBool(value: string | undefined, fallback: boolean): boolean {
    if (!value) return fallback;
    return value.toLowerCase() === 'true';
}

export function parsePositiveInt(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
}

export function parseNonNegativeInt(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.floor(parsed);
}

export function evaluateEliminationResponse(input: {
    status: number;
    body: EliminationResponse;
    allowExistingCycle: boolean;
}): EliminationEvaluation {
    if (input.status >= 200 && input.status < 300) {
        return { status: 'success' };
    }

    if (input.allowExistingCycle && input.status === 409 && input.body.code === 'CYCLE_ALREADY_EXECUTED') {
        return {
            status: 'skipped',
            reason: 'already_executed',
        };
    }

    throw new Error(
        `[partner-monthly-elimination] failed status=${input.status} body=${JSON.stringify(input.body)}`
    );
}

export function getOverdueRefunds(refunds: PendingRefund[], nowMs: number): PendingRefund[] {
    return refunds.filter((refund) => {
        const deadline = new Date(refund.elimination.refundDeadlineAt).getTime();
        return Number.isFinite(deadline) && deadline < nowMs;
    });
}

export function evaluateRefundSla(input: {
    refunds: PendingRefund[];
    nowMs: number;
    allowedOverdue: number;
}): {
    overdue: PendingRefund[];
    overdueCount: number;
    pendingCount: number;
    breach: boolean;
} {
    const overdue = getOverdueRefunds(input.refunds, input.nowMs);
    return {
        overdue,
        overdueCount: overdue.length,
        pendingCount: input.refunds.length,
        breach: overdue.length > input.allowedOverdue,
    };
}

function normalizePathWithQuery(pathWithQuery: string): string {
    if (pathWithQuery.startsWith('http://') || pathWithQuery.startsWith('https://')) {
        const url = new URL(pathWithQuery);
        return `${url.pathname}${url.search}`;
    }
    return pathWithQuery;
}

export async function buildPartnerAdminHeaders(params: {
    method: string;
    pathWithQuery: string;
    adminWallet: string;
    adminPrivateKey?: string;
}): Promise<Record<string, string>> {
    const normalizedWallet = params.adminWallet.toLowerCase();
    const headers: Record<string, string> = {
        'x-admin-wallet': normalizedWallet,
    };

    if (!params.adminPrivateKey) {
        return headers;
    }

    const signer = new ethers.Wallet(params.adminPrivateKey);
    if (signer.address.toLowerCase() !== normalizedWallet) {
        throw new Error(
            `PARTNER_OPS_ADMIN_PRIVATE_KEY wallet mismatch (expected ${normalizedWallet}, got ${signer.address.toLowerCase()})`
        );
    }

    const timestamp = Date.now();
    const message = buildManagedWalletAuthMessage({
        walletAddress: normalizedWallet,
        method: params.method,
        pathWithQuery: normalizePathWithQuery(params.pathWithQuery),
        timestamp,
    });
    const signature = await signer.signMessage(message);

    return {
        ...headers,
        'x-admin-signature': signature,
        'x-admin-timestamp': String(timestamp),
        'x-wallet-address': normalizedWallet,
        'x-wallet-signature': signature,
        'x-wallet-timestamp': String(timestamp),
    };
}
