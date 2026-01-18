
import { NextResponse } from 'next/server';
import { prisma, errorResponse } from '../utils';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
        return errorResponse('Wallet address required');
    }

    try {
        const referrer = await prisma.referrer.findUnique({
            where: { walletAddress },
            select: { id: true }
        });

        if (!referrer) {
            return errorResponse('Affiliate not found', 404);
        }

        // Fetch descendants via Closure Table
        // Join with Referrer to get details
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
                        sunLineCount: true,
                        _count: {
                            select: { referrals: true }
                        }
                    }
                }
            },
            orderBy: { depth: 'asc' }
        });

        // Transform for frontend tree view
        // The closure table gives flat list with depth.
        // We can group by depth or just return flatness.
        // For tree visualization, returning flattened list with 'depth' is usually sufficient for frontend recursion.

        const formattedTeam = team.map((t: any) => ({
            ...t.descendant,
            referrals: { _count: t.descendant._count.referrals },
            depth: t.depth,
            isSunLine: t.descendant.sunLineCount > 0
        }));

        return NextResponse.json(formattedTeam);

    } catch (error) {
        console.error('Get team error:', error);
        return errorResponse('Internal server error', 500);
    }
}
