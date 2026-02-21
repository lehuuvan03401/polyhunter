
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { parseMarketSlug } from '@/lib/utils';
import { createTTLCache } from '@/lib/server-cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RESPONSE_TTL_MS = 20000;
const responseCache = createTTLCache<any>();

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    try {
        const cacheKey = `trade-history:${walletAddress.toLowerCase()}`;
        const responsePayload = await responseCache.getOrSet(cacheKey, RESPONSE_TTL_MS, async () => {
            const history = await prisma.copyTrade.findMany({
                where: {
                    config: {
                        walletAddress: walletAddress.toLowerCase()
                    },
                    status: 'EXECUTED'
                },
                orderBy: {
                    detectedAt: 'desc'
                },
                take: 100
            });

            // Map to standard format matching getWalletActivity
            return history.map(trade => ({
                transactionHash: trade.txHash || `sim-${trade.id}`,
                timestamp: Math.floor(new Date(trade.detectedAt).getTime() / 1000),
                side: trade.originalSide, // 'BUY' or 'SELL'
                outcome: trade.outcome,
                title: parseMarketSlug(trade.marketSlug, trade.tokenId),
                marketSlug: trade.marketSlug, // Pass slug for linking
                size: trade.copySize,
                price: trade.copyPrice || trade.originalPrice,
                simulated: true
            }));
        });

        return NextResponse.json(responsePayload);
    } catch (error) {
        console.error('Error fetching history:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
