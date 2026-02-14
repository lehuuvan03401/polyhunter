import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';

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

        return NextResponse.json({
            product,
            stats: {
                subscriptionCount,
                runningSubscriptionCount,
            },
        });
    } catch (error) {
        console.error('Failed to fetch managed product detail:', error);
        return NextResponse.json(
            { error: 'Failed to fetch managed product detail' },
            { status: 500 }
        );
    }
}
