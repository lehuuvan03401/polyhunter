import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/participation-program/partner-program';

const queueApplySchema = z.object({
    walletAddress: z.string(),
    commitmentAmountUsd: z.number().min(100), // Minimum commitment to join queue
});

export async function POST(req: Request) {
    try {
        const json = await req.json();
        const parsed = queueApplySchema.safeParse(json);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid parameters', details: parsed.error }, { status: 400 });
        }

        const { walletAddress, commitmentAmountUsd } = parsed.data;
        const normalizedWallet = walletAddress.toLowerCase();

        // 1. Check if user already has an active seat
        const existingSeat = await prisma.partnerSeat.findUnique({
            where: { walletAddress: normalizedWallet }
        });

        if (existingSeat && existingSeat.status === 'ACTIVE') {
            return NextResponse.json({ error: 'Wallet already holds an active partner seat' }, { status: 400 });
        }

        // 2. Check if user is already in queue
        const existingQueueEntry = (prisma as any).partnerQueue && await (prisma as any).partnerQueue.findUnique({
            where: { walletAddress: normalizedWallet }
        });

        if (existingQueueEntry && existingQueueEntry.status === 'PENDING') {
            return NextResponse.json({ error: 'Wallet is already in the queue' }, { status: 400 });
        }

        // 3. Create queue entry
        const queueEntry = await (prisma as any).partnerQueue.create({
            data: {
                walletAddress: normalizedWallet,
                commitmentAmountUsd,
                status: 'PENDING',
            }
        });

        return NextResponse.json({ success: true, queueId: queueEntry.id });

    } catch (error: any) {
        console.error('Queue application error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const walletAddress = searchParams.get('walletAddress');

        if (!walletAddress) {
            // Admin only: list all queue
            if (!isAdminRequest(req as any)) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const queue = await (prisma as any).partnerQueue.findMany({
                where: { status: 'PENDING' },
                orderBy: [
                    { commitmentAmountUsd: 'desc' },
                    { createdAt: 'asc' }
                ]
            });
            return NextResponse.json({ queue });
        }

        // Return position for specific wallet
        const normalizedWallet = walletAddress.toLowerCase();

        const entry = await (prisma as any).partnerQueue.findUnique({
            where: { walletAddress: normalizedWallet }
        });

        if (!entry || entry.status !== 'PENDING') {
            return NextResponse.json({ inQueue: false });
        }

        // Calculate position based on commitment and joined time
        const higherPriorityCount = await (prisma as any).partnerQueue.count({
            where: {
                status: 'PENDING',
                OR: [
                    { commitmentAmountUsd: { gt: entry.commitmentAmountUsd } },
                    {
                        commitmentAmountUsd: entry.commitmentAmountUsd,
                        createdAt: { lt: entry.createdAt }
                    }
                ]
            }
        });

        return NextResponse.json({
            inQueue: true,
            position: higherPriorityCount + 1,
            entry
        });

    } catch (error: any) {
        console.error('Queue status check error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
