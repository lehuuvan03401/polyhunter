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
import { resolveCopyTradingWalletContext } from '@/lib/copy-trading/request-wallet';
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
        const tradeId = searchParams.get('tradeId');
        const status = searchParams.get('status');
        const walletCheck = resolveCopyTradingWalletContext(request, {
            queryWallet: searchParams.get('wallet'),
        });
        if (!walletCheck.ok) {
            return NextResponse.json({ error: walletCheck.error }, { status: walletCheck.status });
        }
        const walletAddress = walletCheck.wallet;

        const cacheKey = `orders:${walletAddress.toLowerCase()}:${tradeId || 'all'}:${status || 'all'}`;
        const responsePayload = await responseCache.getOrSet(cacheKey, RESPONSE_TTL_MS, async () => {
            // 读取接口使用短 TTL 缓存，避免频繁刷新页面时对 DB 造成压力。
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
                const statusUpper = status.toUpperCase();
                // 状态口径兼容：
                // - 前端常用 OPEN
                // - 数据库存的是 PENDING
                // 非法状态直接忽略，避免 enum 抛错导致 500。
                if (statusUpper === 'OPEN') {
                    where.status = 'PENDING';
                } else if (['PENDING', 'EXECUTED', 'SETTLEMENT_PENDING', 'FAILED', 'SKIPPED', 'EXPIRED'].includes(statusUpper)) {
                    where.status = statusUpper;
                }
                // If invalid status, ignore filter or return specific error?
                // Ignoring prevents 500 crash on invalid enum
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
                // 当前仅做本地推导：EXECUTED 视为 100% filled。
                // 若后续接入真实 CLOB 订单状态，应以链路实际撮合结果覆盖此字段。
                filledSize: trade.status === 'EXECUTED' ? trade.copySize : 0,
                filledPercent: trade.status === 'EXECUTED' ? 100 : 0,
                leaderSize: trade.originalSize,
                leaderPrice: trade.originalPrice,
                leaderTxHash: trade.originalTxHash,
                isSim: (() => {
                    const tx = (trade.txHash || '').toLowerCase();
                    // LIVE- prefix means Live mode, not simulation
                    if (tx.startsWith('live-')) return false;
                    return tx.startsWith('sim-') || tx.startsWith('adjust-');
                })(),
            }));

            // Sort by newest first (no need to combine with strategies anymore)
            const orders = tradeOrders.sort((a, b) => {
                return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
            });

            // Get stats (only from actual trades)
            // 这里统计的是“映射后的展示状态”，用于前端看板摘要。
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
    // 统一把内部 copyTrade 状态映射到前端订单语义，避免 UI 直接感知底层状态枚举。
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
        const walletCheck = resolveCopyTradingWalletContext(request, {
            bodyWallet: walletAddress,
            requireHeader: true,
        });
        if (!walletCheck.ok) {
            return NextResponse.json({ error: walletCheck.error }, { status: walletCheck.status });
        }
        const normalizedWallet = walletCheck.wallet;

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

        // 当前实现是“本地状态回显”占位。
        // 后续如果接入 CLOB 状态轮询，可在此处把挂单状态回写 DB 后再返回。
        const orders = await prisma.copyTrade.findMany({
            where: {
                config: {
                    walletAddress: normalizedWallet,
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
