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
            chartData: simulateHistoricalData(product.createdAt, product.strategyProfile),
        });
    } catch (error) {
        console.error('Failed to fetch managed product detail:', error);
        return NextResponse.json(
            { error: 'Failed to fetch managed product detail' },
            { status: 500 }
        );
    }
}

// Helper to simulate historical data for demo content
function simulateHistoricalData(createdAt: Date, strategyProfile: string) {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)) || 30; // Min 30 days
    const data = [];
    let price = 100;

    // Volatility settings
    const volatility =
        strategyProfile === 'AGGRESSIVE' ? 0.02 :
            strategyProfile === 'MODERATE' ? 0.01 :
                0.005; // CONSERVATIVE

    // Trend settings (daily return)
    const trend =
        strategyProfile === 'AGGRESSIVE' ? 0.0015 :
            strategyProfile === 'MODERATE' ? 0.001 :
                0.0005; // CONSERVATIVE

    const now = new Date();

    for (let i = days; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);

        // Random walk with drift
        const change = (Math.random() - 0.45) * volatility + trend;
        price = price * (1 + change);

        data.push({
            date: date.toISOString(),
            value: price
        });
    }

    return data;
}
