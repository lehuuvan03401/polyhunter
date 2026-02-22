import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseMarketSlug, parseOutcome } from '@/lib/utils';
import { Prisma } from '@prisma/client';
import { createTTLCache } from '@/lib/server-cache';
import { resolveCopyTradingWalletContext } from '@/lib/copy-trading/request-wallet';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RESPONSE_TTL_MS = 20000;
const responseCache = createTTLCache<any>();

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'REDEEMED' | 'SETTLED_LOSS' | 'ALL' | 'COUNTS';
    const walletCheck = resolveCopyTradingWalletContext(request, {
        queryWallet: searchParams.get('wallet'),
    });
    if (!walletCheck.ok) {
        return NextResponse.json({ error: walletCheck.error }, { status: walletCheck.status });
    }
    const normalizedWallet = walletCheck.wallet;

    // 1. Find Config ID for user
    // 1. Find ALL Config IDs for user (to support multiple simulations/traders)
    const configs = await prisma.copyTradingConfig.findMany({
        where: { walletAddress: normalizedWallet },
        select: { id: true }
    });

    if (configs.length === 0) {
        return NextResponse.json([]);
    }

    const configIds = configs.map(c => c.id);

    try {
        const cacheKey = `history:${normalizedWallet}:${type || 'ALL'}`;
        const responsePayload = await responseCache.getOrSet(cacheKey, RESPONSE_TTL_MS, async () => {
            // Query filters
            let whereClause: Prisma.CopyTradeWhereInput = {
                configId: { in: configIds },
                status: 'EXECUTED'
            };

            if (type === 'COUNTS') {
            const redeemedCount = await prisma.copyTrade.count({
                where: {
                    configId: { in: configIds },
                    status: 'EXECUTED',
                    OR: [
                        { originalSide: 'REDEEM' }, // Actual Redeems
                        { AND: [{ originalTrader: { in: ['POLYMARKET_SETTLEMENT', 'PROTOCOL'] } }, { originalPrice: 1 }] } // Simulated Wins
                    ]
                }
            });
            // Loss = Sell by Settlement with 0 price OR Sell with 'loss' hash
            const lostCount = await prisma.copyTrade.count({
                where: {
                    configId: { in: configIds },
                    status: 'EXECUTED',
                    OR: [
                        { AND: [{ originalTrader: { in: ['POLYMARKET_SETTLEMENT', 'PROTOCOL'] } }, { originalPrice: 0 }] }, // Settlement Loss
                        { AND: [{ originalSide: 'SELL' }, { txHash: { contains: 'loss' } }] } // Explicit Loss
                    ]
                }
            });
                return {
                    REDEEMED: redeemedCount,
                    SETTLED_LOSS: lostCount
                };
            }

            if (type === 'REDEEMED') {
                whereClause = {
                    ...whereClause,
                    OR: [
                        { originalSide: 'REDEEM' },
                        { AND: [{ originalTrader: { in: ['POLYMARKET_SETTLEMENT', 'PROTOCOL'] } }, { originalPrice: 1 }] }
                    ]
                };
            } else if (type === 'SETTLED_LOSS') {
                whereClause = {
                    ...whereClause,
                    OR: [
                        { AND: [{ originalTrader: { in: ['POLYMARKET_SETTLEMENT', 'PROTOCOL'] } }, { originalPrice: 0 }] },
                        { AND: [{ originalSide: 'SELL' }, { txHash: { contains: 'loss' } }] }
                    ]
                };
            } else {
                // ALL history (both types)
                whereClause = {
                    ...whereClause,
                    OR: [
                        { originalSide: 'REDEEM' },
                        { AND: [{ originalTrader: { in: ['POLYMARKET_SETTLEMENT', 'PROTOCOL'] } }, { originalPrice: 0 }] },
                        { AND: [{ originalSide: 'SELL' }, { txHash: { contains: 'loss' } }] }
                    ]
                };
            }

            const trades = await prisma.copyTrade.findMany({
                where: whereClause,
                orderBy: { executedAt: 'desc' },
                take: 50 // Limit to recent 50
            });

            const lossTradesNeedingFallback = trades.filter((t) => {
                const isLoss = (t.originalTrader === 'POLYMARKET_SETTLEMENT' || t.originalTrader === 'PROTOCOL')
                    ? t.originalPrice === 0
                    : (t.originalSide === 'SELL' && (t.txHash || '').includes('loss'));
                return isLoss && (!t.originalSize || t.originalSize <= 0) && !!t.realizedPnL;
            });

            const fallbackPriceMap = new Map<string, number>();
            const lossTokenIds = Array.from(new Set(lossTradesNeedingFallback.map(t => t.tokenId).filter((id): id is string => !!id)));
            if (lossTokenIds.length > 0) {
                const buyTrades = await prisma.copyTrade.findMany({
                    where: {
                        configId: { in: configIds },
                        tokenId: { in: lossTokenIds },
                        originalSide: 'BUY',
                        executedAt: { not: null }
                    },
                    orderBy: { executedAt: 'desc' },
                    select: { tokenId: true, executedAt: true, copyPrice: true, originalPrice: true }
                });

                const buysByToken = new Map<string, typeof buyTrades>();
                buyTrades.forEach((t) => {
                    if (!t.tokenId) return;
                    const list = buysByToken.get(t.tokenId) || [];
                    list.push(t);
                    buysByToken.set(t.tokenId, list);
                });

                lossTradesNeedingFallback.forEach((t) => {
                    if (!t.tokenId || !t.configId || !t.executedAt) return;
                    const executedAt = t.executedAt;
                    const key = `${t.configId}:${t.tokenId}:${executedAt.getTime()}`;
                    if (fallbackPriceMap.has(key)) return;
                    const candidates = buysByToken.get(t.tokenId) || [];
                    const lastBuy = candidates.find((b) => b.executedAt && b.executedAt <= executedAt);
                    const price = lastBuy?.copyPrice ?? lastBuy?.originalPrice ?? 0;
                    if (price > 0) {
                        fallbackPriceMap.set(key, price);
                    }
                });
            }

        // Map to Position interface structure for UI compatibility
        const positions = trades.map(t => {
            const unitPrice = t.copyPrice ?? t.originalPrice ?? 0;
            const proceeds = t.copySize || 0;
            const pnlAbs = t.realizedPnL || 0;
            const usdcSize = (unitPrice === 0 && proceeds === 0 && pnlAbs < 0) ? Math.abs(pnlAbs) : proceeds;
            let sizeShares = unitPrice > 0 ? (proceeds / unitPrice) : 0;
            if (sizeShares <= 0 && (t.originalSize || 0) > 0) {
                sizeShares = t.originalSize;
            }
            if (sizeShares <= 0 && pnlAbs < 0 && t.tokenId && t.executedAt) {
                const fallbackKey = `${t.configId}:${t.tokenId}:${t.executedAt.getTime()}`;
                const fallbackPrice = fallbackPriceMap.get(fallbackKey);
                if (fallbackPrice && fallbackPrice > 0) {
                    sizeShares = Math.abs(pnlAbs) / fallbackPrice;
                }
            }

            return ({
            id: t.id, // Unique Trade ID
            tokenId: t.tokenId || t.id, // Fallback ID
            slug: t.marketSlug,
            title: parseMarketSlug(t.marketSlug, t.tokenId || ''),
            outcome: parseOutcome(t.outcome),
            size: sizeShares, // Shares (fallback to originalSize if price==0)
            usdcSize: usdcSize,
            avgPrice: 0, // Computed below
            curPrice: unitPrice, // Settlement Price (1.0 or 0.0)
            percentPnl: 0, // Computed below
            pnlAbs: t.realizedPnL,
            estValue: proceeds,
            totalCost: 0, // Calculated below
            simulated: true,
            status: (t.originalSide === 'REDEEM' || ((t.originalTrader === 'POLYMARKET_SETTLEMENT' || t.originalTrader === 'PROTOCOL') && t.originalPrice === 1.0)) ? 'SETTLED_WIN' : 'SETTLED_LOSS',
            timestamp: t.executedAt ? new Date(t.executedAt).getTime() : Date.now()
        });
        });

        // Refine PnL % calculation
        positions.forEach(p => {
            const proceeds = p.estValue || 0;
            const pnl = p.pnlAbs || 0;
            let cost = proceeds - pnl;
            if (cost === 0 && p.curPrice === 0 && pnl < 0) {
                cost = Math.abs(pnl);
            }
            p.totalCost = cost;

            if (p.size > 0) {
                p.avgPrice = cost / p.size;
            }

            if (cost > 0) {
                p.percentPnl = pnl / cost;
            }
        });

            return positions;
        });

        return NextResponse.json(responsePayload);

    } catch (error) {
        console.error('Error fetching history:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
