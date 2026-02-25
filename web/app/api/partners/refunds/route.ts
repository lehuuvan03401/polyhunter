import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/participation-program/partner-program';

export const dynamic = 'force-dynamic';

const refundStatusSchema = z.enum(['PENDING', 'COMPLETED', 'FAILED']);

const updateRefundSchema = z.object({
    refundId: z.string().min(3),
    action: z.enum(['COMPLETE', 'FAIL']),
    txHash: z.string().min(3).optional(),
    errorMessage: z.string().max(200).optional(),
});

export async function GET(request: NextRequest) {
    try {
        if (!isAdminRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const { searchParams } = new URL(request.url);
        const statusRaw = searchParams.get('status');
        const statusParsed = statusRaw ? refundStatusSchema.safeParse(statusRaw) : null;

        if (statusParsed && !statusParsed.success) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        const refunds = await prisma.partnerRefund.findMany({
            where: {
                ...(statusParsed?.success ? { status: statusParsed.data } : {}),
            },
            include: {
                seat: {
                    select: {
                        id: true,
                        walletAddress: true,
                        status: true,
                    },
                },
                elimination: {
                    select: {
                        id: true,
                        monthKey: true,
                        rankAtElimination: true,
                        refundDeadlineAt: true,
                    },
                },
            },
            orderBy: [{ status: 'asc' }, { requestedAt: 'asc' }],
            take: 500,
        });

        return NextResponse.json({ refunds });
    } catch (error) {
        console.error('[PartnerRefunds] GET failed:', error);
        return NextResponse.json({ error: 'Failed to fetch refunds' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!isAdminRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const body = await request.json();
        const parsed = updateRefundSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const now = new Date();

        const updated = await prisma.$transaction(async (tx) => {
            const refund = await tx.partnerRefund.findUnique({
                where: { id: parsed.data.refundId },
                select: {
                    id: true,
                    seatId: true,
                    status: true,
                },
            });

            if (!refund) {
                throw new Error('REFUND_NOT_FOUND');
            }

            if (parsed.data.action === 'COMPLETE') {
                if (refund.status === 'COMPLETED') {
                    return tx.partnerRefund.findUniqueOrThrow({
                        where: { id: refund.id },
                    });
                }

                const next = await tx.partnerRefund.update({
                    where: { id: refund.id },
                    data: {
                        status: 'COMPLETED',
                        completedAt: now,
                        txHash: parsed.data.txHash,
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
            }

            if (refund.status === 'COMPLETED') {
                throw new Error('REFUND_ALREADY_COMPLETED');
            }

            const next = await tx.partnerRefund.update({
                where: { id: refund.id },
                data: {
                    status: 'FAILED',
                    completedAt: null,
                    txHash: null,
                    errorMessage: parsed.data.errorMessage ?? 'Refund processing failed',
                },
            });

            await tx.partnerSeat.update({
                where: { id: refund.seatId },
                data: {
                    status: 'REFUND_PENDING',
                    backendAccess: false,
                },
            });

            return next;
        });

        return NextResponse.json({ refund: updated });
    } catch (error) {
        if (error instanceof Error && error.message === 'REFUND_NOT_FOUND') {
            return NextResponse.json({ error: 'Refund not found' }, { status: 404 });
        }
        if (error instanceof Error && error.message === 'REFUND_ALREADY_COMPLETED') {
            return NextResponse.json({ error: 'Completed refund cannot be marked as failed' }, { status: 409 });
        }

        console.error('[PartnerRefunds] POST failed:', error);
        return NextResponse.json({ error: 'Failed to update refund' }, { status: 500 });
    }
}
