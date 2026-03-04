/**
 * Copy Trading Trades API
 * 
 * Get copy trade history for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveCopyTradingWalletContext } from '@/lib/copy-trading/request-wallet';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * GET /api/copy-trading/trades
 * Get copy trade history for a wallet
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // Optional filter
        const requestedLimit = parseInt(searchParams.get('limit') || `${DEFAULT_LIMIT}`, 10);
        const limit = Number.isFinite(requestedLimit)
            ? Math.max(1, Math.min(requestedLimit, MAX_LIMIT))
            : DEFAULT_LIMIT;
        const cursor = searchParams.get('cursor') || undefined;
        const walletCheck = resolveCopyTradingWalletContext(request, {
            queryWallet: searchParams.get('wallet'),
        });
        if (!walletCheck.ok) {
            return NextResponse.json({ error: walletCheck.error }, { status: walletCheck.status });
        }
        const walletAddress = walletCheck.wallet;

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
            orderBy: [
                { detectedAt: 'desc' },
                { id: 'desc' },
            ],
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            take: limit + 1,
        });

        const hasMore = trades.length > limit;
        const pageItems = hasMore ? trades.slice(0, limit) : trades;
        const nextCursor = hasMore ? pageItems[pageItems.length - 1]?.id || null : null;

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
            trades: pageItems,
            pagination: {
                limit,
                nextCursor,
                hasMore,
            },
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
