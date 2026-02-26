import { describe, expect, it } from 'vitest';
import {
    evaluateEliminationResponse,
    evaluateRefundSla,
    toMonthKey,
    type PendingRefund,
} from './partner-ops-automation';

const SAMPLE_REFUNDS: PendingRefund[] = [
    {
        id: 'refund-1',
        amountUsd: 5000,
        requestedAt: '2026-02-20T00:00:00.000Z',
        seat: { walletAddress: '0x1111111111111111111111111111111111111111' },
        elimination: {
            monthKey: '2026-02',
            refundDeadlineAt: '2026-02-25T00:00:00.000Z',
        },
    },
    {
        id: 'refund-2',
        amountUsd: 8000,
        requestedAt: '2026-02-20T00:00:00.000Z',
        seat: { walletAddress: '0x2222222222222222222222222222222222222222' },
        elimination: {
            monthKey: '2026-02',
            refundDeadlineAt: '2026-03-01T00:00:00.000Z',
        },
    },
];

describe('partner ops automation helpers', () => {
    it('formats month key using UTC', () => {
        expect(toMonthKey(new Date('2026-02-26T12:00:00.000Z'))).toBe('2026-02');
    });

    it('treats executed month cycle conflict as idempotent skip', () => {
        expect(
            evaluateEliminationResponse({
                status: 409,
                body: { code: 'CYCLE_ALREADY_EXECUTED' },
                allowExistingCycle: true,
            })
        ).toEqual({
            status: 'skipped',
            reason: 'already_executed',
        });
    });

    it('throws when elimination execution fails and conflict skip is not allowed', () => {
        expect(() =>
            evaluateEliminationResponse({
                status: 409,
                body: { code: 'CYCLE_ALREADY_EXECUTED' },
                allowExistingCycle: false,
            })
        ).toThrow(/failed status=409/);
    });

    it('detects overdue refunds and SLA breach', () => {
        const evaluation = evaluateRefundSla({
            refunds: SAMPLE_REFUNDS,
            nowMs: new Date('2026-02-26T00:00:00.000Z').getTime(),
            allowedOverdue: 0,
        });

        expect(evaluation.pendingCount).toBe(2);
        expect(evaluation.overdueCount).toBe(1);
        expect(evaluation.overdue[0].id).toBe('refund-1');
        expect(evaluation.breach).toBe(true);
    });

    it('stays healthy when overdue count is within allowed threshold', () => {
        const evaluation = evaluateRefundSla({
            refunds: SAMPLE_REFUNDS,
            nowMs: new Date('2026-02-26T00:00:00.000Z').getTime(),
            allowedOverdue: 1,
        });

        expect(evaluation.breach).toBe(false);
    });
});
