
import { NextResponse } from 'next/server';
import { prisma, errorResponse, normalizeAddress } from '../utils';

interface TreeMember {
    address: string;
    referralCode?: string;
    tier: string;
    volume: number;
    teamSize: number;
    depth: number;
    children: TreeMember[];
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const format = searchParams.get('format') || 'flat'; // 'flat' | 'tree'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
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

        // ========== TREE FORMAT ==========
        if (format === 'tree') {
            // Get direct referrals first (depth=1)
            const directReferrals = await prisma.teamClosure.findMany({
                where: {
                    ancestorId: referrer.id,
                    depth: 1
                },
                include: {
                    descendant: {
                        select: {
                            id: true,
                            walletAddress: true,
                            referralCode: true,
                            tier: true,
                            totalVolume: true,
                        }
                    }
                }
            });

            // Build tree recursively (limit to 3 levels for performance)
            const buildTree = async (parentId: string, currentDepth: number, maxDepth: number): Promise<TreeMember[]> => {
                if (currentDepth > maxDepth) return [];

                const children = await prisma.teamClosure.findMany({
                    where: {
                        ancestorId: parentId,
                        depth: 1 // Direct children only
                    },
                    include: {
                        descendant: {
                            select: {
                                id: true,
                                walletAddress: true,
                                referralCode: true,
                                tier: true,
                                totalVolume: true,
                            }
                        }
                    }
                });

                return Promise.all(children.map(async (child: any) => {
                    // Get team size for this member
                    const teamSize = await prisma.teamClosure.count({
                        where: {
                            ancestorId: child.descendant.id,
                            depth: { gt: 0 }
                        }
                    });

                    const subChildren = await buildTree(child.descendant.id, currentDepth + 1, maxDepth);

                    return {
                        address: child.descendant.walletAddress,
                        referralCode: child.descendant.referralCode,
                        tier: child.descendant.tier,
                        volume: child.descendant.totalVolume,
                        teamSize,
                        depth: currentDepth,
                        children: subChildren
                    };
                }));
            };

            // Build tree for each direct referral (3 levels deep)
            const treeData = await Promise.all(directReferrals.map(async (dr: any) => {
                const teamSize = await prisma.teamClosure.count({
                    where: {
                        ancestorId: dr.descendant.id,
                        depth: { gt: 0 }
                    }
                });

                const children = await buildTree(dr.descendant.id, 2, 4); // Start at depth 2, max 4

                return {
                    address: dr.descendant.walletAddress,
                    referralCode: dr.descendant.referralCode,
                    tier: dr.descendant.tier,
                    volume: dr.descendant.totalVolume,
                    teamSize,
                    depth: 1,
                    children
                };
            }));

            return NextResponse.json({
                directReferrals: treeData,
                totalDirects: treeData.length
            });
        }

        // ========== FLAT FORMAT (Original) ==========
        const total = await prisma.teamClosure.count({
            where: {
                ancestorId: referrer.id,
                depth: { gt: 0 }
            }
        });

        const team = await prisma.teamClosure.findMany({
            where: {
                ancestorId: referrer.id,
                depth: { gt: 0 }
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
