/**
 * Copy Trading Detection API
 * 
 * This endpoint is called periodically (by cron job / Vercel cron) to:
 * 1. Fetch recent trades from watched trader addresses
 * 2. Match against active copy trading configs
 * 3. Create pending copy trades for user confirmation
 * 
 * Designed to be called by a cron job every 30-60 seconds
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { polyClient } from '@/lib/polymarket';

// Time window to look for new trades (in seconds)
const DETECTION_WINDOW_SECONDS = 120; // 2 minutes

// Expiry time for pending trades (user has this long to confirm)
const PENDING_EXPIRY_MINUTES = 10;

/**
 * Calculate copy size based on config and original trade
 */
function calculateCopySize(
    config: {
        mode: string;
        sizeScale: number | null;
        fixedAmount: number | null;
        maxSizePerTrade: number;
        minSizePerTrade?: number | null;
    },
    originalSize: number,
    originalPrice: number
): number {
    const originalValue = originalSize * originalPrice;

    if (config.mode === 'FIXED_AMOUNT' && config.fixedAmount) {
        return Math.min(config.fixedAmount, config.maxSizePerTrade);
    }

    // PROPORTIONAL 模式：以原单名义价值做缩放。
    const scaledValue = originalValue * (config.sizeScale || 1);

    // 区间约束：最终金额必须落在 [minSizePerTrade, maxSizePerTrade] 内。
    const minSize = config.minSizePerTrade ?? 0;
    const clampedValue = Math.max(minSize, Math.min(scaledValue, config.maxSizePerTrade));

    return clampedValue;
}

function normalizeTradeSizing(
    config: { tradeSizeMode?: string | null },
    rawSize: number,
    price: number
): { tradeShares: number; tradeNotional: number } {
    const mode = config.tradeSizeMode || 'SHARES';
    if (mode === 'NOTIONAL') {
        const tradeNotional = rawSize;
        const tradeShares = price > 0 ? tradeNotional / price : 0;
        return { tradeShares, tradeNotional };
    }

    const tradeShares = rawSize;
    const tradeNotional = tradeShares * price;
    return { tradeShares, tradeNotional };
}

// Secret for cron job authentication
const CRON_SECRET = process.env.CRON_SECRET || 'dev-cron-secret';

/**
 * POST /api/copy-trading/detect
 * Detect new trades and create pending copy trades
 * 
 * Called by cron job with Authorization header
 */
export async function POST(request: NextRequest) {
    try {
        // Verify cron secret (optional in dev)
        if (process.env.NODE_ENV === 'production') {
            const authHeader = request.headers.get('Authorization');
            if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
                return NextResponse.json(
                    { error: 'Unauthorized' },
                    { status: 401 }
                );
            }
        }

        // 只扫描激活配置，停用策略不会进入检测链路。
        const activeConfigs = await prisma.copyTradingConfig.findMany({
            where: { isActive: true },
        });

        if (activeConfigs.length === 0) {
            return NextResponse.json({
                message: 'No active copy trading configs',
                detected: 0,
            });
        }

        // Type alias for config items
        type ConfigType = typeof activeConfigs[number];

        // 按 trader 聚合后再拉 activity，避免重复调用同一个地址的历史接口。
        const traderAddresses = [...new Set(activeConfigs.map((c: ConfigType) => c.traderAddress))];

        let totalDetected = 0;
        let totalCreated = 0;
        const errors: string[] = [];

        // Process each trader address
        for (const traderAddress of traderAddresses) {
            try {
                // Fetch recent activity for this trader
                const activity = await polyClient.wallets.getWalletActivity(traderAddress, 20);

                // 仅处理窗口内 trade，避免旧事件重复灌入 pending 队列。
                const now = Date.now();
                const cutoff = now - (DETECTION_WINDOW_SECONDS * 1000);

                const recentTrades = activity.activities.filter(a => {
                    const tradeTime = a.timestamp * 1000;
                    return a.type === 'TRADE' && tradeTime > cutoff;
                });

                if (recentTrades.length === 0) continue;

                // Get configs for this trader
                const configsForTrader = activeConfigs.filter(
                    (c: ConfigType) => c.traderAddress === traderAddress
                );

                // Process each recent trade
                for (const trade of recentTrades) {
                    totalDetected++;

                    // Validate timestamp - skip if invalid
                    const tradeTimeMs = typeof trade.timestamp === 'number'
                        ? (trade.timestamp > 1e12 ? trade.timestamp : trade.timestamp * 1000)
                        : Date.now();

                    // Skip if timestamp is too far in future or past (sanity check)
                    const now = Date.now();
                    if (tradeTimeMs > now + 60000 || tradeTimeMs < now - 24 * 60 * 60 * 1000) {
                        continue; // Invalid timestamp, skip
                    }

                    for (const config of configsForTrader) {
                        const { tradeShares, tradeNotional } = normalizeTradeSizing(config, trade.size, trade.price);

                        // 幂等去重：用（config+trader+时间容差+方向+仓位）近似识别同一 leader 成交。
                        const existing = await prisma.copyTrade.findFirst({
                            where: {
                                configId: config.id,
                                originalTrader: traderAddress,
                                detectedAt: {
                                    gte: new Date(tradeTimeMs - 5000), // 5s tolerance
                                    lte: new Date(tradeTimeMs + 5000),
                                },
                                originalSide: trade.side,
                                originalSize: tradeShares,
                            },
                        });

                        if (existing) continue; // Already processed

                        // ========================================
                        // Apply Filters
                        // ========================================

                        // Filter 1: Side filter (BUY/SELL only)
                        if (config.sideFilter && trade.side !== config.sideFilter) {
                            continue; // Side doesn't match filter
                        }

                        // Filter 2: Minimum trigger size ($)
                        if (config.minTriggerSize && tradeNotional < config.minTriggerSize) {
                            continue; // Below minimum trigger size
                        }

                        // Filter 3: Max odds (skip trades on highly likely outcomes)
                        // maxOdds is stored as decimal (e.g., 0.85 = 85%)
                        if (config.maxOdds && trade.price > config.maxOdds) {
                            continue; // Price/odds too high, skip
                        }

                        // Filter 4: Direction handling (COPY vs COUNTER)
                        // For COUNTER mode, we flip the trade side
                        let copySide = trade.side;
                        if (config.direction === 'COUNTER') {
                            copySide = trade.side === 'BUY' ? 'SELL' : 'BUY';
                        }

                        // Calculate copy size
                        const copySize = calculateCopySize(config, tradeShares, trade.price);

                        if (copySize <= 0) continue;

                        // 检测阶段只写 PENDING，不直接执行，执行由 worker/API 分支负责。
                        await prisma.copyTrade.create({
                            data: {
                                configId: config.id,
                                originalTrader: traderAddress,
                                originalSide: copySide, // Use potentially flipped side for COUNTER
                                leaderSide: trade.side,
                                originalSize: tradeShares,
                                originalPrice: trade.price,
                                marketSlug: trade.slug || null,
                                conditionId: trade.conditionId || null,
                                tokenId: trade.asset || null,
                                outcome: trade.outcome || null,
                                copySize,
                                status: 'PENDING',
                                expiresAt: new Date(Date.now() + PENDING_EXPIRY_MINUTES * 60 * 1000),
                            },
                        });

                        totalCreated++;
                    }
                }
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                errors.push(`Failed to process ${traderAddress}: ${errorMsg}`);
            }
        }

        return NextResponse.json({
            message: 'Detection complete',
            tradersChecked: traderAddresses.length,
            tradesDetected: totalDetected,
            copyTradesCreated: totalCreated,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        console.error('Error in copy trading detection:', error);
        return NextResponse.json(
            { error: 'Detection failed' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/copy-trading/detect
 * Get detection status and stats
 */
export async function GET() {
    try {
        const activeConfigs = await prisma.copyTradingConfig.count({
            where: { isActive: true },
        });

        const pendingTrades = await prisma.copyTrade.count({
            where: { status: 'PENDING' },
        });

        const recentExecuted = await prisma.copyTrade.count({
            where: {
                status: 'EXECUTED',
                executedAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
                },
            },
        });

        const uniqueTraders = await prisma.copyTradingConfig.groupBy({
            by: ['traderAddress'],
            where: { isActive: true },
        });

        return NextResponse.json({
            activeConfigs,
            uniqueTraders: uniqueTraders.length,
            pendingTrades,
            recentExecuted24h: recentExecuted,
        });
    } catch (error) {
        console.error('Error fetching detection stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stats' },
            { status: 500 }
        );
    }
}
