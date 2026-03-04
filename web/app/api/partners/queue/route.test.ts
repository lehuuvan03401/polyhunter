import { describe, expect, it, vi } from 'vitest';
import { POST, GET } from './route';

const { mockPrisma } = vi.hoisted(() => {
    return {
        mockPrisma: {
            partnerSeat: {
                findUnique: vi.fn(),
            },
            partnerQueue: {
                findUnique: vi.fn(),
                create: vi.fn(),
                findMany: vi.fn(),
                count: vi.fn(),
            }
        }
    };
});

vi.mock('@/lib/prisma', () => {
    return {
        prisma: mockPrisma
    };
});

vi.mock('@/lib/participation-program/partner-program', () => ({
    isAdminRequest: vi.fn(() => true),
}));

describe('Partner Queue API', () => {
    describe('POST /api/partners/queue', () => {
        it('rejects if already has active seat', async () => {
            mockPrisma.partnerSeat.findUnique.mockResolvedValueOnce({ status: 'ACTIVE' });

            const req = new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ walletAddress: '0x123', commitmentAmountUsd: 500 })
            });

            const res = await POST(req);
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe('Wallet already holds an active partner seat');
        });

        it('rejects if already in queue', async () => {
            mockPrisma.partnerSeat.findUnique.mockResolvedValueOnce(null);
            mockPrisma.partnerQueue.findUnique.mockResolvedValueOnce({ status: 'PENDING' });

            const req = new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ walletAddress: '0x123', commitmentAmountUsd: 500 })
            });

            const res = await POST(req);
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe('Wallet is already in the queue');
        });

        it('creates queue entry successfully', async () => {
            mockPrisma.partnerSeat.findUnique.mockResolvedValueOnce(null);
            mockPrisma.partnerQueue.findUnique.mockResolvedValueOnce(null);
            mockPrisma.partnerQueue.create.mockResolvedValueOnce({ id: 'queue-1' });

            const req = new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ walletAddress: '0xabc', commitmentAmountUsd: 500 })
            });

            const res = await POST(req);
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.queueId).toBe('queue-1');

            expect(mockPrisma.partnerQueue.create).toHaveBeenCalledWith({
                data: {
                    walletAddress: '0xabc',
                    commitmentAmountUsd: 500,
                    status: 'PENDING',
                }
            });
        });
    });

    describe('GET /api/partners/queue', () => {
        it('returns queue position for a wallet', async () => {
            mockPrisma.partnerQueue.findUnique.mockResolvedValueOnce({
                status: 'PENDING',
                commitmentAmountUsd: 500,
                joinedAt: new Date('2026-01-01T00:00:00Z')
            });
            mockPrisma.partnerQueue.count.mockResolvedValueOnce(2); // 2 people ahead

            const req = new Request('http://localhost?walletAddress=0x123');
            const res = await GET(req);

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.inQueue).toBe(true);
            expect(data.position).toBe(3); // Count + 1
        });

        it('returns all queue entries for admin', async () => {
            const mockQueue = [
                { id: '1', walletAddress: '0xabc', commitmentAmountUsd: 1000 },
                { id: '2', walletAddress: '0xdef', commitmentAmountUsd: 500 },
            ];
            mockPrisma.partnerQueue.findMany.mockResolvedValueOnce(mockQueue);

            const req = new Request('http://localhost');
            const res = await GET(req);

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.queue).toEqual(mockQueue);
        });
    });
});
