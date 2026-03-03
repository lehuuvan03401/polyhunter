import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

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
 * Intended for admin/ops monitoring. No wallet auth required
 * (should be protected by admin middleware in production).
 */
export async function GET(request: NextRequest) {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json(
                { events: [], message: 'Database not configured' },
                { status: 503 }
            );
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
