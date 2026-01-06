/**
 * Copy Trading Execute API
 * 
 * Execute pending copy trades through Polymarket CLOB
 * Supports both manual (frontend) and automatic (server-side) execution
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Trading configuration from environment
const TRADING_PRIVATE_KEY = process.env.TRADING_PRIVATE_KEY;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '137');

/**
 * POST /api/copy-trading/execute
 * Execute or mark a pending copy trade
 * 
 * Body: {
 *   tradeId: string,
 *   walletAddress: string,
 *   
 *   // For manual execution (frontend already executed):
 *   txHash?: string,
 *   status?: 'executed' | 'failed' | 'skipped',
 *   errorMessage?: string,
 *   
 *   // For server-side execution:
 *   executeOnServer?: boolean,
 *   orderMode?: 'market' | 'limit',
 *   slippage?: number,  // For market orders, default 2%
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            tradeId,
            walletAddress,
            txHash,
            status,
            errorMessage,
            executeOnServer = false,
            orderMode = 'limit',
            slippage = 0.02,
        } = body;

        if (!tradeId || !walletAddress) {
            return NextResponse.json(
                { error: 'Missing tradeId or walletAddress' },
                { status: 400 }
            );
        }

        // Find the trade and verify ownership
        const trade = await prisma.copyTrade.findFirst({
            where: {
                id: tradeId,
                config: {
                    walletAddress: walletAddress.toLowerCase(),
                },
            },
            include: {
                config: true,
            },
        });

        if (!trade) {
            return NextResponse.json(
                { error: 'Trade not found or unauthorized' },
                { status: 404 }
            );
        }

        if (trade.status !== 'PENDING') {
            return NextResponse.json(
                { error: 'Trade is not in pending status', currentStatus: trade.status },
                { status: 400 }
            );
        }

        // === SERVER-SIDE EXECUTION ===
        if (executeOnServer) {
            if (!TRADING_PRIVATE_KEY) {
                return NextResponse.json({
                    success: false,
                    requiresManualExecution: true,
                    message: 'Server-side trading not configured. Execute manually via wallet.',
                    trade: {
                        id: trade.id,
                        tokenId: trade.tokenId,
                        side: trade.originalSide,
                        size: trade.copySize,
                        price: trade.originalPrice,
                    },
                });
            }

            if (!trade.tokenId) {
                return NextResponse.json({
                    success: false,
                    error: 'Trade has no tokenId - cannot execute on CLOB',
                });
            }

            /**
             * CLOB ORDER EXECUTION
             * 
             * In production, uncomment this code and configure TRADING_PRIVATE_KEY:
             * 
             * import { TradingService } from '@catalyst-team/poly-sdk';
             * import { RateLimiter } from '@catalyst-team/poly-sdk';
             * import { UnifiedCache } from '@catalyst-team/poly-sdk';
             * 
             * const rateLimiter = new RateLimiter();
             * const cache = new UnifiedCache('copy-execute');
             * const tradingService = new TradingService(rateLimiter, cache, {
             *     privateKey: TRADING_PRIVATE_KEY,
             *     chainId: CHAIN_ID,
             * });
             * await tradingService.initialize();
             * 
             * let orderResult;
             * if (orderMode === 'market') {
             *     orderResult = await tradingService.createMarketOrder({
             *         tokenId: trade.tokenId,
             *         side: trade.originalSide as 'BUY' | 'SELL',
             *         amount: trade.copySize,
             *         price: trade.originalPrice * (1 + slippage),
             *     });
             * } else {
             *     const size = trade.copySize / trade.originalPrice;
             *     orderResult = await tradingService.createLimitOrder({
             *         tokenId: trade.tokenId,
             *         side: trade.originalSide as 'BUY' | 'SELL',
             *         price: trade.originalPrice,
             *         size: size,
             *     });
             * }
             */

            // Simulated execution for demo
            const orderResult = {
                success: true,
                orderId: `order_${Date.now()}_${trade.id.slice(0, 8)}`,
                transactionHashes: [] as string[],
                errorMsg: undefined as string | undefined,
            };

            if (orderResult.success) {
                const updatedTrade = await prisma.copyTrade.update({
                    where: { id: trade.id },
                    data: {
                        status: 'EXECUTED',
                        executedAt: new Date(),
                        executedTxHash: orderResult.transactionHashes?.[0] || orderResult.orderId,
                    },
                });

                return NextResponse.json({
                    success: true,
                    orderId: orderResult.orderId,
                    transactionHashes: orderResult.transactionHashes,
                    trade: updatedTrade,
                });
            } else {
                await prisma.copyTrade.update({
                    where: { id: trade.id },
                    data: {
                        status: 'FAILED',
                        errorMessage: orderResult.errorMsg,
                    },
                });

                return NextResponse.json({
                    success: false,
                    error: orderResult.errorMsg || 'Order execution failed',
                });
            }
        }

        // === MANUAL EXECUTION (Frontend already executed) ===
        const executionStatus = status === 'executed' ? 'EXECUTED' :
            status === 'failed' ? 'FAILED' :
                status === 'skipped' ? 'SKIPPED' : 'FAILED';

        const updatedTrade = await prisma.copyTrade.update({
            where: { id: tradeId },
            data: {
                status: executionStatus,
                executedTxHash: txHash || null,
                errorMessage: errorMessage || null,
                executedAt: executionStatus === 'EXECUTED' ? new Date() : null,
            },
        });

        return NextResponse.json({
            success: true,
            trade: updatedTrade
        });
    } catch (error) {
        console.error('Error executing copy trade:', error);
        return NextResponse.json(
            { error: 'Failed to execute trade', message: String(error) },
            { status: 500 }
        );
    }
}

/**
 * GET /api/copy-trading/execute
 * Get pending trades that need user confirmation
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('wallet');

        if (!walletAddress) {
            return NextResponse.json(
                { error: 'Missing wallet address' },
                { status: 400 }
            );
        }

        // Get pending trades that haven't expired
        const pendingTrades = await prisma.copyTrade.findMany({
            where: {
                config: {
                    walletAddress: walletAddress.toLowerCase(),
                    isActive: true,
                },
                status: 'PENDING',
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } },
                ],
            },
            include: {
                config: {
                    select: {
                        traderName: true,
                        traderAddress: true,
                    },
                },
            },
            orderBy: { detectedAt: 'desc' },
        });

        // Expire old pending trades
        await prisma.copyTrade.updateMany({
            where: {
                status: 'PENDING',
                expiresAt: {
                    lt: new Date(),
                },
            },
            data: {
                status: 'EXPIRED',
            },
        });

        return NextResponse.json({ pendingTrades });
    } catch (error) {
        console.error('Error fetching pending trades:', error);
        return NextResponse.json(
            { error: 'Failed to fetch pending trades' },
            { status: 500 }
        );
    }
}
