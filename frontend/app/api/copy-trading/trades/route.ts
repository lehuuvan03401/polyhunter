/**
 * Copy Trading Trades API
 * 
 * Get copy trade history for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/copy-trading/trades
 * Get copy trade history for a wallet
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('wallet');
        const status = searchParams.get('status'); // Optional filter
        const limit = parseInt(searchParams.get('limit') || '50');

        if (!walletAddress) {
            return NextResponse.json(
                { error: 'Missing wallet address' },
                { status: 400 }
            );
        }

        // Build where clause
        const where: Record<string, unknown> = {
            config: {
                walletAddress: walletAddress.toLowerCase(),
            },
        };

        if (status) {
            where.status = status.toUpperCase();
        }

        const trades = await prisma.copyTrade.findMany({
            where,
            include: {
                config: {
                    select: {
                        traderAddress: true,
                        traderName: true,
                        mode: true,
                    },
                },
            },
            orderBy: { detectedAt: 'desc' },
            take: limit,
        });

        // Get stats
        const stats = await prisma.copyTrade.groupBy({
            by: ['status'],
            where: {
                config: {
                    walletAddress: walletAddress.toLowerCase(),
                },
            },
            _count: true,
        });

        const statsMap: Record<string, number> = {};
        stats.forEach((s) => {
            statsMap[s.status] = s._count;
        });

        return NextResponse.json({
            trades,
            stats: {
                pending: statsMap['PENDING'] || 0,
                executed: statsMap['EXECUTED'] || 0,
                failed: statsMap['FAILED'] || 0,
                skipped: statsMap['SKIPPED'] || 0,
                expired: statsMap['EXPIRED'] || 0,
            },
        });
    } catch (error) {
        console.error('Error fetching copy trades:', error);
        return NextResponse.json(
            { error: 'Failed to fetch trades' },
            { status: 500 }
        );
    }
}
