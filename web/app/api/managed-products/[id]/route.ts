import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { PARTICIPATION_SERVICE_PERIODS_DAYS } from '@/lib/participation-program/rules';

export const dynamic = 'force-dynamic';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!isDatabaseEnabled) {
            return NextResponse.json(
                { error: 'Database not configured' },
                { status: 503 }
            );
        }

        const product = await prisma.managedProduct.findFirst({
            where: {
                OR: [{ id }, { slug: id }],
            },
            include: {
                terms: {
                    where: {
                        isActive: true,
                        durationDays: { in: [...PARTICIPATION_SERVICE_PERIODS_DAYS] },
                    },
                    orderBy: { durationDays: 'asc' },
                },
                agents: {
                    include: {
                        agent: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                tags: true,
                                traderAddress: true,
                                traderName: true,
                                avatarUrl: true,
                                strategyProfile: true,
                            },
                        },
                    },
                    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
                },
                subscriptions: {
                    select: {
                        id: true,
                        status: true,
                        principal: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
        });

        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        const [subscriptionCount, runningSubscriptionCount] = await Promise.all([
            prisma.managedSubscription.count({ where: { productId: product.id } }),
            prisma.managedSubscription.count({
                where: { productId: product.id, status: 'RUNNING' },
            }),
        ]);

        const rawSnapshots = await prisma.managedNavSnapshot.findMany({
            where: {
                subscription: {
                    productId: product.id,
                },
            },
            select: {
                snapshotAt: true,
                nav: true,
            },
            orderBy: { snapshotAt: 'desc' },
            take: 5000,
        });

        const chartBuckets = new Map<string, { sum: number; count: number }>();
        for (const snapshot of rawSnapshots) {
            const dayKey = snapshot.snapshotAt.toISOString().slice(0, 10);
            const bucket = chartBuckets.get(dayKey) ?? { sum: 0, count: 0 };
            bucket.sum += snapshot.nav;
            bucket.count += 1;
            chartBuckets.set(dayKey, bucket);
        }

        const chartData = Array.from(chartBuckets.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([dayKey, bucket]) => ({
                date: `${dayKey}T00:00:00.000Z`,
                value: bucket.sum / bucket.count,
            }));

        return NextResponse.json({
            product,
            stats: {
                subscriptionCount,
                runningSubscriptionCount,
            },
            chartData,
        });
    } catch (error) {
        console.error('Failed to fetch managed product detail:', error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
            return NextResponse.json(
                { error: 'Managed wealth tables are not initialized' },
                { status: 503 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to fetch managed product detail' },
            { status: 500 }
        );
    }
}
