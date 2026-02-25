import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { resolveWalletContext } from '@/lib/managed-wealth/request-wallet';
import { PARTICIPATION_MODES } from '@/lib/participation-program/rules';

export const dynamic = 'force-dynamic';

const createAuthSchema = z.object({
    walletAddress: z.string().min(3),
    mode: z.enum(PARTICIPATION_MODES).optional().default('MANAGED'),
    consentStatement: z.string().min(12),
    scope: z.record(z.string(), z.unknown()).optional(),
});

const revokeAuthSchema = z.object({
    walletAddress: z.string().min(3),
    authorizationId: z.string().optional(),
    reason: z.string().max(200).optional(),
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

        const [activeAuthorization, recentAuthorizations] = await Promise.all([
            prisma.managedCustodyAuthorization.findFirst({
                where: {
                    walletAddress: walletContext.wallet,
                    status: 'ACTIVE',
                },
                orderBy: { grantedAt: 'desc' },
            }),
            prisma.managedCustodyAuthorization.findMany({
                where: { walletAddress: walletContext.wallet },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
        ]);

        return NextResponse.json({
            activeAuthorization,
            recentAuthorizations,
        });
    } catch (error) {
        console.error('[CustodyAuth] GET failed:', error);
        return NextResponse.json({ error: 'Failed to fetch custody authorization' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const body = await request.json();
        const parsed = createAuthSchema.safeParse(body);
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

        const signature = request.headers.get('x-wallet-signature');
        if (!signature) {
            return NextResponse.json({ error: 'Missing wallet signature header' }, { status: 401 });
        }

        const scope = parsed.data.scope as Prisma.InputJsonValue | undefined;
        const now = new Date();

        const authorization = await prisma.$transaction(async (tx) => {
            const account = await tx.participationAccount.upsert({
                where: { walletAddress: walletContext.wallet },
                update: {},
                create: {
                    walletAddress: walletContext.wallet,
                    status: 'PENDING',
                },
                select: { id: true },
            });

            await tx.managedCustodyAuthorization.updateMany({
                where: {
                    walletAddress: walletContext.wallet,
                    status: 'ACTIVE',
                },
                data: {
                    status: 'REVOKED',
                    revokedAt: now,
                },
            });

            return tx.managedCustodyAuthorization.create({
                data: {
                    accountId: account.id,
                    walletAddress: walletContext.wallet,
                    mode: parsed.data.mode,
                    status: 'ACTIVE',
                    consentStatement: parsed.data.consentStatement,
                    requestPath: `${request.nextUrl.pathname}${request.nextUrl.search}`,
                    requestMethod: request.method,
                    signature,
                    scope,
                    grantedAt: now,
                },
            });
        });

        return NextResponse.json({ authorization }, { status: 201 });
    } catch (error) {
        console.error('[CustodyAuth] POST failed:', error);
        return NextResponse.json({ error: 'Failed to create custody authorization' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const body = await request.json();
        const parsed = revokeAuthSchema.safeParse(body);
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

        const where = parsed.data.authorizationId
            ? {
                id: parsed.data.authorizationId,
                walletAddress: walletContext.wallet,
                status: 'ACTIVE' as const,
            }
            : {
                walletAddress: walletContext.wallet,
                status: 'ACTIVE' as const,
            };

        const revokeResult = await prisma.managedCustodyAuthorization.updateMany({
            where,
            data: {
                status: 'REVOKED',
                revokedAt: new Date(),
            },
        });

        if (revokeResult.count === 0) {
            return NextResponse.json({ error: 'No active authorization found' }, { status: 404 });
        }

        return NextResponse.json({
            revoked: revokeResult.count,
            reason: parsed.data.reason,
        });
    } catch (error) {
        console.error('[CustodyAuth] DELETE failed:', error);
        return NextResponse.json({ error: 'Failed to revoke custody authorization' }, { status: 500 });
    }
}
