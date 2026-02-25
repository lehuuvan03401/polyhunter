import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import {
    ensurePartnerProgramConfig,
    getActiveSeatCount,
    isAdminRequest,
} from '@/lib/participation-program/partner-program';

export const dynamic = 'force-dynamic';

const updateConfigSchema = z.object({
    maxSeats: z.number().int().positive().max(1000).optional(),
    refillPriceUsd: z.number().nonnegative().max(1_000_000).optional(),
});

export async function GET() {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const [config, activeSeatCount] = await Promise.all([
            ensurePartnerProgramConfig(prisma),
            getActiveSeatCount(prisma),
        ]);
        const pendingRefundCount = await prisma.partnerRefund.count({
            where: { status: 'PENDING' },
        });
        const availableSeatCount = Math.max(0, config.maxSeats - activeSeatCount);

        return NextResponse.json({
            config,
            stats: {
                activeSeatCount,
                availableSeatCount,
                pendingRefundCount,
                refill: {
                    isOpen: availableSeatCount > 0,
                    openSeats: availableSeatCount,
                    refillPriceUsd: config.refillPriceUsd,
                },
            },
        });
    } catch (error) {
        console.error('[PartnerConfig] GET failed:', error);
        return NextResponse.json({ error: 'Failed to fetch partner config' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!isAdminRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const body = await request.json();
        const parsed = updateConfigSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const existing = await ensurePartnerProgramConfig(prisma);
        const config = await prisma.partnerProgramConfig.update({
            where: { id: existing.id },
            data: {
                ...(parsed.data.maxSeats !== undefined ? { maxSeats: parsed.data.maxSeats } : {}),
                ...(parsed.data.refillPriceUsd !== undefined ? { refillPriceUsd: parsed.data.refillPriceUsd } : {}),
            },
        });

        const [activeSeatCount, pendingRefundCount] = await Promise.all([
            getActiveSeatCount(prisma),
            prisma.partnerRefund.count({ where: { status: 'PENDING' } }),
        ]);
        const availableSeatCount = Math.max(0, config.maxSeats - activeSeatCount);

        return NextResponse.json({
            config,
            stats: {
                activeSeatCount,
                availableSeatCount,
                pendingRefundCount,
                refill: {
                    isOpen: availableSeatCount > 0,
                    openSeats: availableSeatCount,
                    refillPriceUsd: config.refillPriceUsd,
                },
            },
        });
    } catch (error) {
        console.error('[PartnerConfig] POST failed:', error);
        return NextResponse.json({ error: 'Failed to update partner config' }, { status: 500 });
    }
}
