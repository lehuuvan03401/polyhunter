import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const { mockPrisma, mockIsAdminRequest } = vi.hoisted(() => {
    const partnerRefundFindUnique = vi.fn();
    const partnerRefundUpdate = vi.fn();
    const partnerSeatUpdate = vi.fn();
    const transaction = vi.fn().mockImplementation(async (callback: (tx: any) => Promise<any>) =>
        callback({
            partnerRefund: {
                update: partnerRefundUpdate,
            },
            partnerSeat: {
                update: partnerSeatUpdate,
            },
        })
    );

    return {
        mockPrisma: {
            partnerRefund: {
                findUnique: partnerRefundFindUnique,
            },
            $transaction: transaction,
        },
        mockIsAdminRequest: vi.fn(() => true),
    };
});

vi.mock('@/lib/prisma', () => ({
    prisma: mockPrisma,
    isDatabaseEnabled: true,
}));

vi.mock('@/lib/participation-program/partner-program', () => ({
    isAdminRequest: mockIsAdminRequest,
}));

describe('POST /api/partners/refunds/execute', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects invalid parameters', async () => {
        const req = new Request('http://localhost/api/partners/refunds/execute', {
            method: 'POST',
            body: JSON.stringify({
                refundId: 'refund-1',
                txHash: 'invalid-hash',
            }),
            headers: { 'content-type': 'application/json' },
        });

        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toBe('Invalid parameters');
    });

    it('marks pending refund as completed using provided txHash', async () => {
        const txHash = '0x1111111111111111111111111111111111111111111111111111111111111111';
        mockPrisma.partnerRefund.findUnique.mockResolvedValueOnce({
            id: 'refund-1',
            seatId: 'seat-1',
            status: 'PENDING',
        });
        const updatedRefund = {
            id: 'refund-1',
            status: 'COMPLETED',
            txHash,
        };
        mockPrisma.$transaction.mockImplementationOnce(async (callback: (tx: any) => Promise<any>) =>
            callback({
                partnerRefund: {
                    update: vi.fn().mockResolvedValue(updatedRefund),
                },
                partnerSeat: {
                    update: vi.fn().mockResolvedValue({ id: 'seat-1', status: 'REFUNDED' }),
                },
            })
        );

        const req = new Request('http://localhost/api/partners/refunds/execute', {
            method: 'POST',
            body: JSON.stringify({
                refundId: 'refund-1',
                txHash,
            }),
            headers: { 'content-type': 'application/json' },
        });

        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.txHash).toBe(txHash);
        expect(body.refund.status).toBe('COMPLETED');
    });

    it('returns conflict when refund already completed', async () => {
        mockPrisma.partnerRefund.findUnique.mockResolvedValueOnce({
            id: 'refund-1',
            seatId: 'seat-1',
            status: 'COMPLETED',
        });

        const req = new Request('http://localhost/api/partners/refunds/execute', {
            method: 'POST',
            body: JSON.stringify({
                refundId: 'refund-1',
                txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
            }),
            headers: { 'content-type': 'application/json' },
        });

        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.error).toBe('Refund already completed');
    });
});
