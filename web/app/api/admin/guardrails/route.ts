import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '').split(',').map((w) => w.toLowerCase()).filter(Boolean);

if (process.env.NODE_ENV === 'production' && ADMIN_WALLETS.length === 0) {
    console.warn('[Admin API] ⚠️ ADMIN_WALLETS not configured - admin endpoints will reject all requests');
}

function isAdmin(req: NextRequest): boolean {
    const adminWallet = req.headers.get('x-admin-wallet');

    if (process.env.NODE_ENV === 'development' && ADMIN_WALLETS.length === 0) {
        console.warn('[Admin API] ⚠️ Admin auth bypassed in development mode');
        return true;
    }

    if (!adminWallet) return false;
    return ADMIN_WALLETS.includes(adminWallet.toLowerCase());
}

export async function GET(request: NextRequest) {
    if (!isAdmin(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const wallet = searchParams.get('wallet')?.toLowerCase();
    const reason = searchParams.get('reason');
    const source = searchParams.get('source');
    const since = searchParams.get('since');

    const where: any = {};
    if (wallet) where.walletAddress = wallet;
    if (reason) where.reason = reason;
    if (source) where.source = source;
    if (since) {
        const sinceDate = new Date(since);
        if (!Number.isNaN(sinceDate.getTime())) {
            where.createdAt = { gte: sinceDate };
        }
    }

    const events = await prisma.guardrailEvent.findMany({
        where,
        take: limit,
        orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: events });
}
