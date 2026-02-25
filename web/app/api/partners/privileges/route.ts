import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { resolveWalletContext } from '@/lib/managed-wealth/request-wallet';
import {
    derivePartnerPrivileges,
    isAdminRequest,
    normalizeWalletAddress,
} from '@/lib/participation-program/partner-program';

export const dynamic = 'force-dynamic';

const privilegeLevelSchema = z.enum(['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9']);

const updatePrivilegesSchema = z
    .object({
        seatId: z.string().min(3).optional(),
        walletAddress: z.string().min(3).optional(),
        privilegeLevel: privilegeLevelSchema.optional(),
        backendAccess: z.boolean().optional(),
    })
    .refine((data) => Boolean(data.seatId || data.walletAddress), {
        message: 'seatId or walletAddress is required',
        path: ['seatId'],
    })
    .refine((data) => data.privilegeLevel !== undefined || data.backendAccess !== undefined, {
        message: 'No update field provided',
        path: ['privilegeLevel'],
    });

export async function GET(request: NextRequest) {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const { searchParams } = new URL(request.url);
        const walletContext = resolveWalletContext(request, {
            queryWallet: searchParams.get('wallet'),
            requireHeader: true,
            requireSignature: true,
        });
        if (!walletContext.ok) {
            return NextResponse.json({ error: walletContext.error }, { status: walletContext.status });
        }

        const walletAddress = walletContext.wallet;
        const seat = await prisma.partnerSeat.findUnique({
            where: { walletAddress },
            select: {
                id: true,
                walletAddress: true,
                status: true,
                privilegeLevel: true,
                backendAccess: true,
                joinedAt: true,
                eliminatedAt: true,
                refundedAt: true,
                updatedAt: true,
            },
        });

        return NextResponse.json({
            walletAddress,
            seat,
            privileges: derivePartnerPrivileges(seat),
        });
    } catch (error) {
        console.error('[PartnerPrivileges] GET failed:', error);
        return NextResponse.json({ error: 'Failed to fetch partner privileges' }, { status: 500 });
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

        const body = await request.json().catch(() => ({}));
        const parsed = updatePrivilegesSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const walletAddress = parsed.data.walletAddress
            ? normalizeWalletAddress(parsed.data.walletAddress)
            : null;
        if (parsed.data.walletAddress && !walletAddress) {
            return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
        }

        const seat = parsed.data.seatId
            ? await prisma.partnerSeat.findUnique({
                where: { id: parsed.data.seatId },
                select: {
                    id: true,
                    walletAddress: true,
                    status: true,
                    privilegeLevel: true,
                    backendAccess: true,
                },
            })
            : await prisma.partnerSeat.findUnique({
                where: { walletAddress: walletAddress! },
                select: {
                    id: true,
                    walletAddress: true,
                    status: true,
                    privilegeLevel: true,
                    backendAccess: true,
                },
            });

        if (!seat) {
            return NextResponse.json({ error: 'Partner seat not found' }, { status: 404 });
        }

        if (walletAddress && seat.walletAddress !== walletAddress) {
            return NextResponse.json({ error: 'seatId and walletAddress mismatch' }, { status: 400 });
        }

        const nextBackendAccess = parsed.data.backendAccess ?? seat.backendAccess;
        if (seat.status !== 'ACTIVE' && nextBackendAccess) {
            return NextResponse.json(
                { error: 'Backend access can only be enabled for ACTIVE seats' },
                { status: 400 }
            );
        }

        const updatedSeat = await prisma.partnerSeat.update({
            where: { id: seat.id },
            data: {
                ...(parsed.data.privilegeLevel !== undefined
                    ? { privilegeLevel: parsed.data.privilegeLevel }
                    : {}),
                ...(parsed.data.backendAccess !== undefined
                    ? { backendAccess: parsed.data.backendAccess }
                    : {}),
            },
            select: {
                id: true,
                walletAddress: true,
                status: true,
                privilegeLevel: true,
                backendAccess: true,
                joinedAt: true,
                eliminatedAt: true,
                refundedAt: true,
                updatedAt: true,
            },
        });

        return NextResponse.json({
            seat: updatedSeat,
            privileges: derivePartnerPrivileges(updatedSeat),
        });
    } catch (error) {
        console.error('[PartnerPrivileges] POST failed:', error);
        return NextResponse.json({ error: 'Failed to update partner privileges' }, { status: 500 });
    }
}
