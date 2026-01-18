
import { NextRequest, NextResponse } from 'next/server';
import { prisma, errorResponse, normalizeAddress } from '../../affiliate/utils';

// Helper: Check for Admin authorization
// In a real app, use session-based auth or verify the signer is an admin.
// For now, we will check a header `x-admin-wallet` against strict env var.
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '').split(',').map(w => w.toLowerCase());

function isAdmin(req: NextRequest): boolean {
    const adminWallet = req.headers.get('x-admin-wallet');
    // For development, allow localhost if no env configured (dangerous in prod!)
    if (process.env.NODE_ENV === 'development' && !process.env.ADMIN_WALLETS) return true;

    if (!adminWallet) return false;
    return ADMIN_WALLETS.includes(adminWallet.toLowerCase());
}

export async function GET(request: NextRequest) {
    if (!isAdmin(request)) {
        return errorResponse('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    const offset = (page - 1) * limit;

    try {
        const whereClause: any = {};
        if (search) {
            whereClause.OR = [
                { walletAddress: { contains: search } }, // Case sensitive in SQLite/Prisma depending on DB
                { referralCode: { contains: search } }
            ];
        }

        const [total, affiliates] = await prisma.$transaction([
            prisma.referrer.count({ where: whereClause }),
            prisma.referrer.findMany({
                where: whereClause,
                skip: offset,
                take: limit,
                orderBy: { totalEarned: 'desc' }, // Default sort by earnings
                include: {
                    _count: {
                        select: { referrals: true }
                    }
                }
            })
        ]);

        // Get team sizes efficiently
        // We can't easily join closure table count in one go with default Prisma methods efficiently for a list without raw query or N+1.
        // For 20 items, N+1 count query is acceptable.
        const enrichedAffiliates = await Promise.all(affiliates.map(async (aff) => {
            const teamSize = await prisma.teamClosure.count({
                where: {
                    ancestorId: aff.id,
                    depth: { gt: 0 }
                }
            });
            return {
                ...aff,
                teamSize,
                directReferrals: aff._count.referrals
            };
        }));

        return NextResponse.json({
            data: enrichedAffiliates,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Admin affiliates fetch error:', error);
        return errorResponse('Internal server error', 500);
    }
}

export async function PUT(request: NextRequest) {
    if (!isAdmin(request)) {
        return errorResponse('Unauthorized', 401);
    }

    try {
        const body = await request.json();
        const { id, tier } = body;

        if (!id || !tier) {
            return errorResponse('Missing required fields');
        }

        const updated = await prisma.referrer.update({
            where: { id },
            data: { tier }
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        console.error('Admin update error:', error);
        return errorResponse('Failed to update affiliate', 500);
    }
}
