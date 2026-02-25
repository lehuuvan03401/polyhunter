import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { resolveWalletContext } from '@/lib/managed-wealth/request-wallet';
import {
    DEFAULT_PARTNER_MAX_SEATS,
    DEFAULT_PARTNER_PRIVILEGE_LEVEL,
    ensurePartnerProgramConfig,
    getActiveSeatCount,
    isAdminRequest,
    parseMonthKey,
} from '@/lib/participation-program/partner-program';

export const dynamic = 'force-dynamic';

const seatCreateSchema = z.object({
    walletAddress: z.string().min(3),
    seatFeeUsd: z.number().nonnegative().max(1_000_000).optional(),
    notes: z.string().max(200).optional(),
});

const seatStatusSchema = z.enum(['ACTIVE', 'ELIMINATED', 'REFUND_PENDING', 'REFUNDED']);

export async function GET(request: NextRequest) {
    try {
        if (!isAdminRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const { searchParams } = new URL(request.url);
        const statusRaw = searchParams.get('status');
        const wallet = searchParams.get('wallet')?.toLowerCase();
        const monthKeyRaw = searchParams.get('monthKey') || undefined;

        const statusParsed = statusRaw ? seatStatusSchema.safeParse(statusRaw) : null;
        if (statusParsed && !statusParsed.success) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }
        if (monthKeyRaw) {
            try {
                parseMonthKey(monthKeyRaw);
            } catch {
                return NextResponse.json({ error: 'Invalid monthKey' }, { status: 400 });
            }
        }

        const seats = await prisma.partnerSeat.findMany({
            where: {
                ...(statusParsed?.success ? { status: statusParsed.data } : {}),
                ...(wallet ? { walletAddress: wallet } : {}),
            },
            include: {
                eliminations: {
                    orderBy: { eliminatedAt: 'desc' },
                    take: 1,
                },
                refunds: {
                    orderBy: { requestedAt: 'desc' },
                    take: 1,
                },
                monthlyRanks: {
                    ...(monthKeyRaw ? { where: { monthKey: monthKeyRaw } } : {}),
                    orderBy: { snapshotAt: 'desc' },
                    take: 1,
                },
            },
            orderBy: [{ status: 'asc' }, { joinedAt: 'asc' }],
        });

        const [config, activeSeatCount, pendingRefundCount] = await Promise.all([
            ensurePartnerProgramConfig(prisma),
            getActiveSeatCount(prisma),
            prisma.partnerRefund.count({ where: { status: 'PENDING' } }),
        ]);
        const availableSeatCount = Math.max(0, config.maxSeats - activeSeatCount);

        return NextResponse.json({
            seats,
            monthKey: monthKeyRaw ?? null,
            stats: {
                activeSeatCount,
                availableSeatCount,
                maxSeats: config.maxSeats,
                pendingRefundCount,
                refill: {
                    isOpen: availableSeatCount > 0,
                    openSeats: availableSeatCount,
                    refillPriceUsd: config.refillPriceUsd,
                },
            },
        });
    } catch (error) {
        console.error('[PartnerSeats] GET failed:', error);
        return NextResponse.json({ error: 'Failed to fetch partner seats' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const body = await request.json();
        const parsed = seatCreateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const walletContext = resolveWalletContext(request, {
            bodyWallet: parsed.data.walletAddress,
            requireHeader: true,
            requireSignature: true,
        });
        if (!walletContext.ok) {
            return NextResponse.json({ error: walletContext.error }, { status: walletContext.status });
        }

        const walletAddress = walletContext.wallet;

        const result = await prisma.$transaction(async (tx) => {
            const config = await tx.partnerProgramConfig.upsert({
                where: { id: 'GLOBAL' },
                update: {},
                create: {
                    id: 'GLOBAL',
                    maxSeats: DEFAULT_PARTNER_MAX_SEATS,
                    refillPriceUsd: 0,
                },
            });

            const existing = await tx.partnerSeat.findUnique({
                where: { walletAddress },
                select: {
                    id: true,
                    status: true,
                },
            });

            if (existing && existing.status !== 'REFUNDED') {
                return {
                    ok: false as const,
                    code: 'SEAT_ALREADY_EXISTS',
                    seatId: existing.id,
                    status: existing.status,
                };
            }

            const activeSeatCount = await tx.partnerSeat.count({
                where: { status: 'ACTIVE' },
            });

            if (activeSeatCount >= config.maxSeats) {
                return {
                    ok: false as const,
                    code: 'SEAT_CAP_REACHED',
                    maxSeats: config.maxSeats,
                    activeSeatCount,
                };
            }

            const seatFeeUsd = parsed.data.seatFeeUsd ?? config.refillPriceUsd;
            const now = new Date();
            const seat = existing
                ? await tx.partnerSeat.update({
                    where: { id: existing.id },
                    data: {
                        status: 'ACTIVE',
                        seatFeeUsd,
                        privilegeLevel: DEFAULT_PARTNER_PRIVILEGE_LEVEL,
                        backendAccess: true,
                        notes: parsed.data.notes,
                        joinedAt: now,
                        eliminatedAt: null,
                        refundedAt: null,
                    },
                })
                : await tx.partnerSeat.create({
                    data: {
                        walletAddress,
                        status: 'ACTIVE',
                        seatFeeUsd,
                        privilegeLevel: DEFAULT_PARTNER_PRIVILEGE_LEVEL,
                        backendAccess: true,
                        notes: parsed.data.notes,
                    },
                });

            return {
                ok: true as const,
                seat,
                config,
                activeSeatCount: activeSeatCount + 1,
                isRefill: Boolean(existing),
            };
        });

        if (!result.ok) {
            return NextResponse.json(result, { status: 409 });
        }

        return NextResponse.json(
            {
                seat: result.seat,
                isRefill: result.isRefill,
                stats: {
                    activeSeatCount: result.activeSeatCount,
                    availableSeatCount: Math.max(0, result.config.maxSeats - result.activeSeatCount),
                    maxSeats: result.config.maxSeats,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('[PartnerSeats] POST failed:', error);
        return NextResponse.json({ error: 'Failed to allocate partner seat' }, { status: 500 });
    }
}
