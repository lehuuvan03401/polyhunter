import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type PayoutWithReferrer = {
    id: string;
    amountUsd: number;
    status: string;
    txHash: string | null;
    createdAt: Date;
    processedAt: Date | null;
    referrer: {
        walletAddress: string;
        tier: string;
        referralCode: string | null;
    };
};

// Check admin authorization
function isAdmin(request: NextRequest): boolean {
    const adminWallet = request.headers.get('x-admin-wallet');
    const adminWallets = process.env.ADMIN_WALLETS?.split(',').map(w => w.toLowerCase()) || [];

    // Development mode bypass
    if (process.env.NODE_ENV === 'development' && !process.env.ADMIN_WALLETS) {
        console.warn('[Admin Payouts] Auth bypassed in development mode');
        return true;
    }

    return adminWallets.includes(adminWallet?.toLowerCase() || '');
}

export async function GET(request: NextRequest) {
    if (!isAdmin(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const status = request.nextUrl.searchParams.get('status');
        const search = request.nextUrl.searchParams.get('search');
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

        // Build where clause
        const where: any = {};
        if (status && status !== 'ALL') {
            where.status = status;
        }

        // Get payouts with referrer info
        const payouts = await prisma.payout.findMany({
            where,
            include: {
                referrer: {
                    select: {
                        walletAddress: true,
                        tier: true,
                        referralCode: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        }) as PayoutWithReferrer[];

        // Filter by search if provided (wallet address search)
        let filteredPayouts = payouts;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredPayouts = payouts.filter((p) =>
                p.referrer.walletAddress.toLowerCase().includes(searchLower) ||
                p.referrer.referralCode?.toLowerCase().includes(searchLower)
            );
        }

        const total = await prisma.payout.count({ where });

        // Calculate summary stats
        const pendingCount = await prisma.payout.count({ where: { status: 'PENDING' } });
        const processingCount = await prisma.payout.count({ where: { status: 'PROCESSING' } });
        const pendingTotal = await prisma.payout.aggregate({
            where: { status: 'PENDING' },
            _sum: { amountUsd: true }
        });

        return NextResponse.json({
            payouts: filteredPayouts.map((p) => ({
                id: p.id,
                walletAddress: p.referrer.walletAddress,
                referralCode: p.referrer.referralCode,
                tier: p.referrer.tier,
                amount: p.amountUsd,
                status: p.status,
                txHash: p.txHash,
                createdAt: p.createdAt.toISOString(),
                processedAt: p.processedAt?.toISOString() || null
            })),
            total,
            page,
            limit,
            summary: {
                pendingCount,
                processingCount,
                pendingTotal: pendingTotal._sum.amountUsd || 0
            }
        });
    } catch (error) {
        console.error('Admin payouts list error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    if (!isAdmin(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { id, action, txHash } = body;

        if (!id || !action) {
            return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
        }

        const validActions = ['approve', 'reject', 'complete'];
        if (!validActions.includes(action)) {
            return NextResponse.json({ error: 'Invalid action. Use: approve, reject, complete' }, { status: 400 });
        }

        const payout = await prisma.payout.findUnique({
            where: { id },
            include: { referrer: true }
        });

        if (!payout) {
            return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
        }

        let newStatus = payout.status;
        let updateData: any = {};

        switch (action) {
            case 'approve':
                if (payout.status !== 'PENDING') {
                    return NextResponse.json({ error: 'Can only approve PENDING payouts' }, { status: 400 });
                }
                newStatus = 'PROCESSING';
                updateData = { status: 'PROCESSING' };
                break;

            case 'reject':
                if (!['PENDING', 'PROCESSING'].includes(payout.status)) {
                    return NextResponse.json({ error: 'Can only reject PENDING or PROCESSING payouts' }, { status: 400 });
                }
                // Return funds to user's pending balance
                await prisma.referrer.update({
                    where: { id: payout.referrerId },
                    data: { pendingPayout: { increment: payout.amountUsd } }
                });
                newStatus = 'REJECTED';
                updateData = { status: 'REJECTED', processedAt: new Date() };
                break;

            case 'complete':
                if (payout.status !== 'PROCESSING') {
                    return NextResponse.json({ error: 'Can only complete PROCESSING payouts' }, { status: 400 });
                }
                if (!txHash) {
                    return NextResponse.json({ error: 'txHash is required to complete payout' }, { status: 400 });
                }
                newStatus = 'COMPLETED';
                updateData = { status: 'COMPLETED', txHash, processedAt: new Date() };
                break;
        }

        const updatedPayout = await prisma.payout.update({
            where: { id },
            data: updateData
        });

        console.log(`[Admin] Payout ${id} ${action}: ${payout.status} -> ${newStatus}`);

        return NextResponse.json({
            success: true,
            payout: {
                id: updatedPayout.id,
                status: updatedPayout.status,
                txHash: updatedPayout.txHash
            }
        });
    } catch (error) {
        console.error('Admin payout update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
