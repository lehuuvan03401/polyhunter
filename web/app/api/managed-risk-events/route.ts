import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '')
    .split(',')
    .map((w) => w.toLowerCase().trim())
    .filter(Boolean);

function isAdminRequest(request: NextRequest): boolean {
    const adminWallet = request.headers.get('x-admin-wallet');
    if (process.env.NODE_ENV === 'development' && ADMIN_WALLETS.length === 0) {
        return true; // Allow all in dev when ADMIN_WALLETS not configured
    }
    if (!adminWallet) return false;
    return ADMIN_WALLETS.includes(adminWallet.toLowerCase());
}

const querySchema = z.object({
    severity: z.enum(['INFO', 'WARN', 'ERROR', 'CRITICAL']).optional(),
    metric: z.string().optional(),
    subscriptionId: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional().default(50),
});

/**
 * GET /api/managed-risk-events
 *
 * Query risk events logged by the managed-wealth system.
 * Requires admin authentication via x-admin-wallet header.
 */
export async function GET(request: NextRequest) {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json(
                { events: [], message: 'Database not configured' },
                { status: 503 }
            );
        }

        if (!isAdminRequest(request)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const parsed = querySchema.safeParse({
            severity: searchParams.get('severity') ?? undefined,
            metric: searchParams.get('metric') ?? undefined,
            subscriptionId: searchParams.get('subscriptionId') ?? undefined,
            limit: searchParams.get('limit') ?? undefined,
        });

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid query', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const { severity, metric, subscriptionId, limit } = parsed.data;

        const events = await prisma.managedRiskEvent.findMany({
            where: {
                ...(severity ? { severity } : {}),
                ...(metric ? { metric } : {}),
                ...(subscriptionId ? { subscriptionId } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                subscription: {
                    select: {
                        id: true,
                        walletAddress: true,
                        status: true,
                        principal: true,
                        product: {
                            select: { name: true, strategyProfile: true },
                        },
                    },
                },
            },
        });

        const stats = await prisma.managedRiskEvent.groupBy({
            by: ['severity'],
            _count: { id: true },
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // last 24h
                },
            },
        });

        return NextResponse.json({
            events,
            stats: Object.fromEntries(
                stats.map((s) => [s.severity, s._count.id])
            ),
            total: events.length,
        });
    } catch (error) {
        console.error('Failed to fetch risk events:', error);
        return NextResponse.json(
            { error: 'Failed to fetch risk events' },
            { status: 500 }
        );
    }
}
