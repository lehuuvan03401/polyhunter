/**
 * Order Status API
 * 
 * Track and monitor order execution status for copy trades
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseMarketSlug } from '@/lib/utils';
import { createTTLCache } from '@/lib/server-cache';
// Order status types
export type OrderStatus = 'PENDING' | 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'EXPIRED' | 'REJECTED' | 'SETTLEMENT_PENDING';

interface OrderStatusInfo {
    orderId: string;
    status: OrderStatus;
    filledSize: number;
    remainingSize: number;
    filledPercent: number;
    price: number;
    side: string;
    createdAt: number;
    updatedAt?: number;
}

const RESPONSE_TTL_MS = 20000;
const responseCache = createTTLCache<any>();

/**
 * GET /api/copy-trading/orders
 * Get orders for copy trades
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('wallet');
        const tradeId = searchParams.get('tradeId');
        const status = searchParams.get('status');

        if (!walletAddress) {
            return NextResponse.json(
                { error: 'Missing wallet address' },
                { status: 400 }
            );
        }

        const cacheKey = `orders:${walletAddress.toLowerCase()}:${tradeId || 'all'}:${status || 'all'}`;
        const responsePayload = await responseCache.getOrSet(cacheKey, RESPONSE_TTL_MS, async () => {
            // Build query
            const where: Record<string, unknown> = {
                config: {
                    walletAddress: walletAddress.toLowerCase(),
                },
            };

            if (tradeId) {
                where.id = tradeId;
            }

            if (status) {
                where.status = status.toUpperCase();
            }

            // Get copy trades with order info
            const trades = await prisma.copyTrade.findMany({
                where,
                select: {
                    id: true,
                    status: true,
                    txHash: true,
                    originalTxHash: true,
                    originalSide: true,
                    copySize: true,
                    copyPrice: true,
                    originalSize: true,
                    originalPrice: true,
                    marketSlug: true,
                    tokenId: true,
                    detectedAt: true,
                    executedAt: true,
                    errorMessage: true,
                    config: {
                        select: {
                            traderName: true,
                            traderAddress: true,
                        },
                    },
                },
                orderBy: { detectedAt: 'desc' },
            });

            // Type alias for trade items
            type TradeType = typeof trades[number];
            type OrderItem = {
                tradeId: string;
                orderId: string | null;
                status: OrderStatus;
                side: string;
                size: number;
                price: number;
                market: string | null;
                tokenId: string | null;
                traderName: string | null;
                traderAddress: string;
                detectedAt: Date;
                executedAt: Date | null;
                errorMessage: string | null;
                filledSize: number;
                filledPercent: number;
                leaderSize: number;
                leaderPrice: number;
                leaderTxHash: string | null;
                isSim: boolean;
            };

            // Transform trades to orders
            const tradeOrders: OrderItem[] = trades.map((trade: TradeType) => ({
                tradeId: trade.id,
                orderId: trade.txHash,
                status: mapTradeStatusToOrderStatus(trade.status),
                side: trade.originalSide,
                size: trade.copySize,
                price: trade.copyPrice || trade.originalPrice,
                market: parseMarketSlug(trade.marketSlug, trade.tokenId),
                tokenId: trade.tokenId,
                traderName: trade.config.traderName,
                traderAddress: trade.config.traderAddress,
                detectedAt: trade.detectedAt,
                executedAt: trade.executedAt,
                errorMessage: trade.errorMessage,
                // Filled info - would come from CLOB API in production
                filledSize: trade.status === 'EXECUTED' ? trade.copySize : 0,
                filledPercent: trade.status === 'EXECUTED' ? 100 : 0,
                leaderSize: trade.originalSize,
                leaderPrice: trade.originalPrice,
                leaderTxHash: trade.originalTxHash,
                isSim: (trade.txHash || '').toLowerCase().startsWith('sim-'),
            }));

            // Sort by newest first (no need to combine with strategies anymore)
            const orders = tradeOrders.sort((a, b) => {
                return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
            });

            // Get stats (only from actual trades)
            const stats = {
                total: orders.length,
                pending: orders.filter((o: OrderItem) => o.status === 'PENDING' || o.status === 'SETTLEMENT_PENDING').length,
                open: orders.filter((o: OrderItem) => o.status === 'OPEN').length,
                filled: orders.filter((o: OrderItem) => o.status === 'FILLED').length,
                failed: orders.filter((o: OrderItem) => o.status === 'REJECTED').length,
            };

            return { orders, stats };
        });

        return NextResponse.json(responsePayload);
    } catch (error) {
        console.error('[Orders] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Failed to fetch orders', details: errorMessage },
            { status: 500 }
        );
    }
}

/**
 * Map internal trade status to order status
 */
function mapTradeStatusToOrderStatus(tradeStatus: string): OrderStatus {
    switch (tradeStatus) {
        case 'PENDING':
            return 'PENDING';
        case 'SETTLEMENT_PENDING':
            return 'SETTLEMENT_PENDING';
        case 'EXECUTED':
            return 'FILLED';
        case 'FAILED':
            return 'REJECTED';
        case 'SKIPPED':
            return 'CANCELLED';
        case 'EXPIRED':
            return 'EXPIRED';
        default:
            return 'PENDING';
    }
}

/**
 * POST /api/copy-trading/orders
 * Refresh order status from CLOB (for pending orders)
 * 
 * Note: In production, this would query Polymarket CLOB API 
 * to get real-time fill status
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { walletAddress, orderIds } = body;

        if (!walletAddress) {
            return NextResponse.json(
                { error: 'Missing wallet address' },
                { status: 400 }
            );
        }

        /**
         * CLOB STATUS CHECK
         * 
         * In production with TradingService:
         * 
         * const tradingService = new TradingService(rateLimiter, cache, {
         *     privateKey: TRADING_PRIVATE_KEY,
         *     chainId: CHAIN_ID,
         * });
         * await tradingService.initialize();
         * 
         * // Get open orders
         * const openOrders = await tradingService.getOpenOrders();
         * 
         * // Check each order ID
         * for (const orderId of orderIds) {
         *     const order = openOrders.find(o => o.id === orderId);
         *     if (order) {
         *         // Update database with fill status
         *         if (order.filledSize === order.originalSize) {
         *             await prisma.copyTrade.updateMany({
         *                 where: { txHash: orderId },
         *                 data: { status: 'EXECUTED', executedAt: new Date() },
         *             });
         *         }
         *     }
         * }
         */

        // For now, just return current status
        const orders = await prisma.copyTrade.findMany({
            where: {
                config: {
                    walletAddress: walletAddress.toLowerCase(),
                },
                txHash: {
                    in: orderIds || undefined,
                },
            },
            select: {
                id: true,
                txHash: true,
                status: true,
                copySize: true,
            },
        });

        type RefreshOrderType = typeof orders[number];

        return NextResponse.json({
            refreshed: orders.length,
            orders: orders.map((o: RefreshOrderType) => ({
                tradeId: o.id,
                orderId: o.txHash,
                status: mapTradeStatusToOrderStatus(o.status),
                filledSize: o.status === 'EXECUTED' ? o.copySize : 0,
                filledPercent: o.status === 'EXECUTED' ? 100 : 0,
            })),
            message: 'Status refresh completed (simulation mode)',
        });
    } catch (error) {
        console.error('[Orders] Refresh error:', error);
        return NextResponse.json(
            { error: 'Failed to refresh orders' },
            { status: 500 }
        );
    }
}
