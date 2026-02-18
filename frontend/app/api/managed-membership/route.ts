import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { resolveWalletContext } from '@/lib/managed-wealth/request-wallet';
import {
    calculateManagedMembershipPrice,
    ManagedMembershipPaymentToken,
    ManagedMembershipPlanType,
} from '@/lib/managed-wealth/membership-plans';

export const dynamic = 'force-dynamic';

const createMembershipSchema = z.object({
    walletAddress: z.string().min(3),
    planType: z.enum(['MONTHLY', 'QUARTERLY']),
    paymentToken: z.enum(['USDC', 'MCN']).optional().default('USDC'),
});
const membershipStatusSchema = z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED']);

type ManagedMembershipRow = {
    id: string;
    walletAddress: string;
    planType: ManagedMembershipPlanType;
    status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
    paymentToken: 'USDC' | 'MCN';
    basePriceUsd: number;
    discountRate: number;
    finalPriceUsd: number;
    startsAt: Date;
    endsAt: Date;
    paidAt: Date;
    createdAt: Date;
    updatedAt: Date;
};

async function expireOutdatedMemberships(wallet: string, now: Date) {
    await prisma.$executeRaw`
        UPDATE "ManagedMembership"
        SET "status" = 'EXPIRED', "updatedAt" = ${now}
        WHERE "walletAddress" = ${wallet}
          AND "status" = 'ACTIVE'
          AND "endsAt" <= ${now}
    `;
}

export async function GET(request: NextRequest) {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json(
                { memberships: [], activeMembership: null, source: 'static', message: 'Database not configured' },
                { status: 503 }
            );
        }

        const { searchParams } = new URL(request.url);
        const walletContext = resolveWalletContext(request, {
            queryWallet: searchParams.get('wallet'),
            requireHeader: true,
            requireSignature: true,
        });
        const rawStatus = searchParams.get('status');
        const parsedStatus = rawStatus ? membershipStatusSchema.safeParse(rawStatus.toUpperCase()) : null;
        const parsedLimit = Number(searchParams.get('limit') ?? 20);
        const limit = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, Math.floor(parsedLimit))) : 20;

        if (!walletContext.ok) {
            return NextResponse.json({ error: walletContext.error }, { status: walletContext.status });
        }
        if (parsedStatus && !parsedStatus.success) {
            return NextResponse.json(
                { error: 'Invalid status', allowed: membershipStatusSchema.options },
                { status: 400 }
            );
        }

        const now = new Date();
        await expireOutdatedMemberships(walletContext.wallet, now);

        const membershipSelect = Prisma.sql`
          SELECT
            "id",
            "walletAddress",
            "planType",
            "status",
            "paymentToken",
            "basePriceUsd",
            "discountRate",
            "finalPriceUsd",
            "startsAt",
            "endsAt",
            "paidAt",
            "createdAt",
            "updatedAt"
          FROM "ManagedMembership"
          WHERE "walletAddress" = ${walletContext.wallet}
          ${parsedStatus ? Prisma.sql`AND "status" = ${parsedStatus.data}` : Prisma.empty}
          ORDER BY "createdAt" DESC
          LIMIT ${limit}
        `;
        const memberships = await prisma.$queryRaw<ManagedMembershipRow[]>(membershipSelect);

        const activeMembership = memberships.find(
            (membership) => membership.status === 'ACTIVE' && membership.endsAt > now
        ) ?? null;
        const activeMembershipAlert = activeMembership
            ? (() => {
                const remainingMs = activeMembership.endsAt.getTime() - now.getTime();
                const remainingHours = Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000)));
                const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
                return {
                    isExpiringSoon: remainingMs <= 3 * 24 * 60 * 60 * 1000,
                    remainingHours,
                    remainingDays,
                };
            })()
            : null;

        return NextResponse.json({ memberships, activeMembership, activeMembershipAlert });
    } catch (error) {
        console.error('Failed to fetch managed memberships:', error);
        return NextResponse.json({ error: 'Failed to fetch managed memberships' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const body = await request.json();
        const validation = createMembershipSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.format() },
                { status: 400 }
            );
        }

        const { walletAddress, planType, paymentToken } = validation.data;
        const walletContext = resolveWalletContext(request, {
            bodyWallet: walletAddress,
            requireHeader: true,
            requireSignature: true,
        });

        if (!walletContext.ok) {
            return NextResponse.json({ error: walletContext.error }, { status: walletContext.status });
        }

        const now = new Date();
        const price = calculateManagedMembershipPrice(
            planType as ManagedMembershipPlanType,
            paymentToken as ManagedMembershipPaymentToken
        );

        const membership = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`
                UPDATE "ManagedMembership"
                SET "status" = 'EXPIRED', "updatedAt" = ${now}
                WHERE "walletAddress" = ${walletContext.wallet}
                  AND "status" = 'ACTIVE'
                  AND "endsAt" <= ${now}
            `;

            const activeRows = await tx.$queryRaw<ManagedMembershipRow[]>`
                SELECT
                  "id",
                  "walletAddress",
                  "planType",
                  "status",
                  "paymentToken",
                  "basePriceUsd",
                  "discountRate",
                  "finalPriceUsd",
                  "startsAt",
                  "endsAt",
                  "paidAt",
                  "createdAt",
                  "updatedAt"
                FROM "ManagedMembership"
                WHERE "walletAddress" = ${walletContext.wallet}
                  AND "status" = 'ACTIVE'
                  AND "endsAt" > ${now}
                ORDER BY "endsAt" DESC
                LIMIT 1
            `;

            const activeMembership = activeRows[0];
            if (activeMembership) {
                throw new Error(`ACTIVE_MEMBERSHIP_EXISTS:${activeMembership.endsAt.toISOString()}`);
            }

            const id = randomUUID();
            const endsAt = new Date(now.getTime() + price.durationDays * 24 * 60 * 60 * 1000);

            const insertedRows = await tx.$queryRaw<ManagedMembershipRow[]>`
                INSERT INTO "ManagedMembership" (
                  "id",
                  "walletAddress",
                  "planType",
                  "status",
                  "paymentToken",
                  "basePriceUsd",
                  "discountRate",
                  "finalPriceUsd",
                  "startsAt",
                  "endsAt",
                  "paidAt",
                  "createdAt",
                  "updatedAt"
                ) VALUES (
                  ${id},
                  ${walletContext.wallet},
                  ${planType},
                  'ACTIVE',
                  ${paymentToken},
                  ${price.basePriceUsd},
                  ${price.discountRate},
                  ${price.finalPriceUsd},
                  ${now},
                  ${endsAt},
                  ${now},
                  ${now},
                  ${now}
                )
                RETURNING
                  "id",
                  "walletAddress",
                  "planType",
                  "status",
                  "paymentToken",
                  "basePriceUsd",
                  "discountRate",
                  "finalPriceUsd",
                  "startsAt",
                  "endsAt",
                  "paidAt",
                  "createdAt",
                  "updatedAt"
            `;

            return insertedRows[0];
        });

        return NextResponse.json({
            membership,
            summary: {
                planType: membership.planType,
                paymentToken: membership.paymentToken,
                basePriceUsd: membership.basePriceUsd,
                discountRate: membership.discountRate,
                finalPriceUsd: membership.finalPriceUsd,
                startsAt: membership.startsAt,
                endsAt: membership.endsAt,
            },
        }, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('ACTIVE_MEMBERSHIP_EXISTS:')) {
            const activeUntil = error.message.slice('ACTIVE_MEMBERSHIP_EXISTS:'.length);
            return NextResponse.json(
                { error: 'Active membership already exists', activeUntil },
                { status: 409 }
            );
        }

        console.error('Failed to create managed membership:', error);
        const detail =
            process.env.NODE_ENV !== 'production' && error instanceof Error ? error.message : undefined;
        return NextResponse.json({ error: 'Failed to create managed membership', detail }, { status: 500 });
    }
}
