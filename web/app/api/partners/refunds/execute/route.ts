import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/participation-program/partner-program';

const executeSchema = z.object({
    refundId: z.string().min(3),
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid txHash'),
});

export async function POST(req: Request) {
    try {
        if (!isAdminRequest(req as any)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const json = await req.json();
        const parsed = executeSchema.safeParse(json);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid parameters', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const now = new Date();
        const { refundId, txHash } = parsed.data;
        const refund = await prisma.partnerRefund.findUnique({
            where: { id: refundId },
            select: {
                id: true,
                seatId: true,
                status: true,
            },
        });

        if (!refund) {
            return NextResponse.json({ error: 'Refund not found' }, { status: 404 });
        }

        if (refund.status === 'COMPLETED') {
            return NextResponse.json({ error: 'Refund already completed' }, { status: 409 });
        }

        const updatedRefund = await prisma.$transaction(async (tx) => {
            const next = await tx.partnerRefund.update({
                where: { id: refundId },
                data: {
                    status: 'COMPLETED',
                    completedAt: now,
                    txHash,
                    errorMessage: null,
                },
            });

            await tx.partnerSeat.update({
                where: { id: refund.seatId },
                data: {
                    status: 'REFUNDED',
                    refundedAt: now,
                    backendAccess: false,
                },
            });

            return next;
        });

        return NextResponse.json({
            success: true,
            txHash,
            refund: updatedRefund,
        });
    } catch (error) {
        console.error('[PartnerRefundExecute] POST failed:', error);
        return NextResponse.json({ error: 'Failed to execute refund' }, { status: 500 });
    }
}
