import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { PARTICIPATION_SERVICE_PERIODS_DAYS } from '@/lib/participation-program/rules';

export const dynamic = 'force-dynamic';
type StrategyProfile = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';

function parseBooleanParam(value: string | null): boolean | undefined {
    if (value === null) return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
}

function parseStrategy(value: string | null): StrategyProfile | undefined {
    if (!value) return undefined;
    const normalized = value.toUpperCase();
    if (normalized === 'CONSERVATIVE' || normalized === 'MODERATE' || normalized === 'AGGRESSIVE') {
        return normalized;
    }
    return undefined;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const rawStrategy = searchParams.get('strategy');
        const strategy = parseStrategy(rawStrategy);
        const guaranteed = parseBooleanParam(searchParams.get('guaranteed'));
        const active = parseBooleanParam(searchParams.get('active'));

        if (rawStrategy && !strategy) {
            return NextResponse.json(
                {
                    error: 'Invalid strategy',
                    allowed: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'],
                },
                { status: 400 }
            );
        }

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
                        strategyProfile: strategy,
                    }
                    : {}),
                ...(guaranteed !== undefined ? { isGuaranteed: guaranteed } : {}),
                ...(active !== undefined ? { isActive: active } : { isActive: true }),
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
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
            return NextResponse.json(
                { products: [], error: 'Managed wealth tables are not initialized' },
                { status: 503 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to fetch managed products' },
            { status: 500 }
        );
    }
}
