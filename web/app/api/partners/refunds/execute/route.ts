import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/participation-program/partner-program';

const executeSchema = z.object({
    refundId: z.string(),
});

export async function POST(req: Request) {
    try {
        if (!isAdminRequest(req as any)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const json = await req.json();
        const parsed = executeSchema.safeParse(json);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid parameters', details: parsed.error }, { status: 400 });
        }

        const { refundId } = parsed.data;

        const refund = await prisma.partnerRefund.findUnique({
            where: { id: refundId },
            include: { seat: true }
        });

        if (!refund) {
            return NextResponse.json({ error: 'Refund not found' }, { status: 404 });
        }

        if (refund.status === 'COMPLETED') {
            return NextResponse.json({ error: 'Refund already completed' }, { status: 400 });
        }

        // Simulate interaction with payment gateway / multi-sig safe
        // In a real implementation this would call out to a smart contract to execute the transfer
        const mockTxHash = `0xsimulated_refund_tx_${Date.now()}`;

        // 1. Mark the refund as processed
        const updatedRefund = await prisma.partnerRefund.update({
            where: { id: refundId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                txHash: mockTxHash,
            }
        });

        // 2. Mark the seat as fully refunded
        await prisma.partnerSeat.update({
            where: { id: refund.seatId },
            data: {
                status: 'REFUNDED',
                refundedAt: new Date(),
            }
        });

        return NextResponse.json({
            success: true,
            txHash: mockTxHash,
            refund: updatedRefund
        });

    } catch (error: any) {
        console.error('Refund execution error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
