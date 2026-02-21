import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

/**
 * GET /api/agents
 * Fetch all active agent templates to display on the frontend
 */
export async function GET() {
    try {
        const agents = await prisma.agentTemplate.findMany({
            where: {
                isActive: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return NextResponse.json({ agents });
    } catch (error) {
        console.error('Failed to fetch agents:', error);
        return NextResponse.json(
            { error: 'Failed to fetch agent templates' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents
 * Create a new agent template (Admin/Seeding)
 */
const createAgentSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    tags: z.array(z.string()),
    traderAddress: z.string(),
    traderName: z.string().optional(),
    avatarUrl: z.string().optional(),
    strategyProfile: z.enum(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']),
    mode: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).default('PERCENTAGE'),
    sizeScale: z.number().optional(),
    fixedAmount: z.number().optional(),
    maxSizePerTrade: z.number().default(100),
    minSizePerTrade: z.number().optional(),
    stopLoss: z.number().optional(),
    takeProfit: z.number().optional(),
    maxOdds: z.number().optional(),
    minLiquidity: z.number().optional(),
    minVolume: z.number().optional(),
    sellMode: z.string().default('SAME_PERCENT'),
});

export async function POST(req: NextRequest) {
    try {
        // In a real app, add admin auth check here

        const body = await req.json();
        const validation = createAgentSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.format() },
                { status: 400 }
            );
        }

        const agent = await prisma.agentTemplate.create({
            data: validation.data,
        });

        return NextResponse.json({ agent }, { status: 201 });
    } catch (error) {
        console.error('Failed to create agent:', error);
        return NextResponse.json(
            { error: 'Failed to create agent template' },
            { status: 500 }
        );
    }
}
