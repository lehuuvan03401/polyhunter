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

    if (config.mode === 'PERCENTAGE' && config.sizeScale) {
        let scaledValue = originalValue * config.sizeScale;

        // For Range mode: clamp between min and max
        if (config.minSizePerTrade && scaledValue < config.minSizePerTrade) {
            scaledValue = config.minSizePerTrade;
        }

        return Math.min(scaledValue, config.maxSizePerTrade);
    }

    return 0;
}

/**
 * POST /api/copy-trading/detect
 * Detect new trades from watched addresses and create pending copy trades
 */
export async function POST(request: NextRequest) {
    try {
        // Optional: verify API key for cron jobs
        const authHeader = request.headers.get('Authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            // Only enforce if CRON_SECRET is set
            if (cronSecret) {
                return NextResponse.json(
                    { error: 'Unauthorized' },
                    { status: 401 }
                );
            }
        }

        // Get all active copy trading configs
        const activeConfigs = await prisma.copyTradingConfig.findMany({
            where: { isActive: true },
        });

        if (activeConfigs.length === 0) {
            return NextResponse.json({
                message: 'No active copy trading configs',
                detected: 0,
            });
        }

        // Group configs by trader address for efficient querying
        const traderAddresses = [...new Set(activeConfigs.map(c => c.traderAddress))];

        let totalDetected = 0;
        let totalCreated = 0;
        const errors: string[] = [];

        // Process each trader address
        for (const traderAddress of traderAddresses) {
            try {
                // Fetch recent activity for this trader
                const activity = await polyClient.wallets.getWalletActivity(traderAddress, 20);

                // Filter to recent trades within detection window
                const now = Date.now();
                const cutoff = now - (DETECTION_WINDOW_SECONDS * 1000);

                const recentTrades = activity.activities.filter(a => {
                    const tradeTime = a.timestamp * 1000;
                    return a.type === 'TRADE' && tradeTime > cutoff;
                });

                if (recentTrades.length === 0) continue;

                // Get configs for this trader
                const configsForTrader = activeConfigs.filter(
                    c => c.traderAddress === traderAddress
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
                        // Check if we already have a copy trade for this exact trade
                        const existing = await prisma.copyTrade.findFirst({
                            where: {
                                configId: config.id,
                                originalTrader: traderAddress,
                                detectedAt: {
                                    gte: new Date(tradeTimeMs - 5000), // 5s tolerance
                                    lte: new Date(tradeTimeMs + 5000),
                                },
                                originalSide: trade.side,
                                originalSize: trade.size,
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
                        const tradeValue = trade.size * trade.price;
                        if (config.minTriggerSize && tradeValue < config.minTriggerSize) {
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
                        const copySize = calculateCopySize(config, trade.size, trade.price);

                        if (copySize <= 0) continue;

                        // Create pending copy trade
                        await prisma.copyTrade.create({
                            data: {
                                configId: config.id,
                                originalTrader: traderAddress,
                                originalSide: copySide, // Use potentially flipped side for COUNTER
                                originalSize: trade.size,
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
