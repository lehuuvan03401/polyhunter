import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function parseBooleanParam(value: string | null): boolean | undefined {
    if (value === null) return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const strategy = searchParams.get('strategy');
        const guaranteed = parseBooleanParam(searchParams.get('guaranteed'));
        const active = parseBooleanParam(searchParams.get('active'));

        if (!isDatabaseEnabled) {
            return NextResponse.json({
                products: [],
                source: 'static',
                message: 'Database not configured',
            });
        }

        const products = await prisma.managedProduct.findMany({
            where: {
                ...(strategy
                    ? {
                        strategyProfile:
                            strategy.toUpperCase() as 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE',
                    }
                    : {}),
                ...(guaranteed !== undefined ? { isGuaranteed: guaranteed } : {}),
                ...(active !== undefined ? { isActive: active } : { isActive: true }),
            },
            include: {
                terms: {
                    where: { isActive: true },
                    orderBy: { durationDays: 'asc' },
                },
                agents: {
                    include: {
                        agent: {
                            select: {
                                id: true,
                                name: true,
                                traderAddress: true,
                                traderName: true,
                                avatarUrl: true,
                                strategyProfile: true,
                            },
                        },
                    },
                    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
                },
            },
            orderBy: [{ strategyProfile: 'asc' }, { createdAt: 'desc' }],
        });

        return NextResponse.json({ products });
    } catch (error) {
        console.error('Failed to fetch managed products:', error);
        return NextResponse.json(
            { error: 'Failed to fetch managed products' },
            { status: 500 }
        );
    }
}
