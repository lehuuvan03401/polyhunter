
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { parseMarketSlug } from '@/lib/utils';
import { createTTLCache } from '@/lib/server-cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RESPONSE_TTL_MS = 15000;
const responseCache = createTTLCache<any>();

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    try {
        const cacheKey = `trade-history:${walletAddress.toLowerCase()}`;
        const cachedResponse = responseCache.get(cacheKey);
        if (cachedResponse) {
            return NextResponse.json(cachedResponse);
        }

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
        const formattedHistory = history.map(trade => ({
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

        responseCache.set(cacheKey, formattedHistory, RESPONSE_TTL_MS);
        return NextResponse.json(formattedHistory);
    } catch (error) {
        console.error('Error fetching history:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
