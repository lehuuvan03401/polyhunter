
import { NextRequest, NextResponse } from 'next/server';
import { prisma, errorResponse, normalizeAddress } from '../../affiliate/utils';

// Valid tier values for validation
const VALID_TIERS = ['ORDINARY', 'VIP', 'ELITE', 'PARTNER', 'SUPER_PARTNER'] as const;
type TierType = typeof VALID_TIERS[number];

// Admin wallet configuration
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '').split(',').map(w => w.toLowerCase()).filter(Boolean);

// Production safety check - log warning on startup if not configured
if (process.env.NODE_ENV === 'production' && ADMIN_WALLETS.length === 0) {
    console.warn('[Admin API] ⚠️ ADMIN_WALLETS not configured - admin endpoints will reject all requests');
}

function isAdmin(req: NextRequest): boolean {
    const adminWallet = req.headers.get('x-admin-wallet');

    // Development mode bypass with warning
    if (process.env.NODE_ENV === 'development' && ADMIN_WALLETS.length === 0) {
        console.warn('[Admin API] ⚠️ Admin auth bypassed in development mode');
        return true;
    }

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
                { walletAddress: { contains: search } },
                { referralCode: { contains: search } }
            ];
        }

        const [total, affiliates] = await prisma.$transaction([
            prisma.referrer.count({ where: whereClause }),
            prisma.referrer.findMany({
                where: whereClause,
                skip: offset,
                take: limit,
                orderBy: { totalEarned: 'desc' },
                include: {
                    _count: {
                        select: { referrals: true }
                    }
                }
            })
        ]);

        // Batch query for team sizes - avoid N+1
        const affiliateIds = affiliates.map(a => a.id);
        const teamSizeCounts = await prisma.teamClosure.groupBy({
            by: ['ancestorId'],
            where: {
                ancestorId: { in: affiliateIds },
                depth: { gt: 0 }
            },
            _count: { descendantId: true }
        });

        // Create lookup map for O(1) access
        const teamSizeMap = new Map(
            teamSizeCounts.map(t => [t.ancestorId, t._count.descendantId])
        );

        // Enrich affiliates with team sizes
        const enrichedAffiliates = affiliates.map(aff => ({
            ...aff,
            teamSize: teamSizeMap.get(aff.id) || 0,
            directReferrals: aff._count.referrals
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
            return errorResponse('Missing required fields', 400);
        }

        // Validate tier value
        if (!VALID_TIERS.includes(tier as TierType)) {
            return errorResponse(`Invalid tier value. Must be one of: ${VALID_TIERS.join(', ')}`, 400);
        }

        const updated = await prisma.referrer.update({
            where: { id },
            data: { tier }
        });

        console.log(`[Admin API] Tier updated: ${id} -> ${tier}`);
        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        console.error('Admin update error:', error);
        return errorResponse('Failed to update affiliate', 500);
    }
}
