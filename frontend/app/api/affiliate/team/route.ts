
import { NextResponse } from 'next/server';
import { prisma, errorResponse, normalizeAddress } from '../utils';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100); // Max 100
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!walletAddress) {
        return errorResponse('Wallet address required');
    }

    try {
        const normalized = normalizeAddress(walletAddress);

        const referrer = await prisma.referrer.findUnique({
            where: { walletAddress: normalized },
            select: { id: true }
        });

        if (!referrer) {
            return errorResponse('Affiliate not found', 404);
        }

        // Get total count first for pagination metadata
        const total = await prisma.teamClosure.count({
            where: {
                ancestorId: referrer.id,
                depth: { gt: 0 }
            }
        });

        // Fetch paginated descendants via Closure Table
        const team = await prisma.teamClosure.findMany({
            where: {
                ancestorId: referrer.id,
                depth: { gt: 0 } // Exclude self
            },
            include: {
                descendant: {
                    select: {
                        walletAddress: true,
                        referralCode: true,
                        tier: true,
                        totalVolume: true,
                        teamVolume: true,
                        sunLineCount: true,
                        _count: {
                            select: { referrals: true }
                        }
                    }
                }
            },
            orderBy: { depth: 'asc' },
            skip: offset,
            take: limit
        });

        // Transform for frontend tree view
        const formattedTeam = team.map((t: any) => ({
            ...t.descendant,
            referrals: { _count: t.descendant._count.referrals },
            depth: t.depth,
            isSunLine: t.descendant.sunLineCount > 0
        }));

        return NextResponse.json({
            members: formattedTeam,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + formattedTeam.length < total
            }
        });

    } catch (error) {
        console.error('Get team error:', error);
        return errorResponse('Internal server error', 500);
    }
}

