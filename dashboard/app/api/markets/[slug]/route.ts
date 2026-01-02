import { NextRequest, NextResponse } from 'next/server';
import { getGammaClient, getReadOnlySDK } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await context.params;

        // Use SDK's GammaApiClient for market details
        const gammaClient = getGammaClient();
        const sdk = getReadOnlySDK();

        // Get market info by slug
        const markets = await gammaClient.getMarkets({ slug, limit: 1 });
        const market = markets[0];

        if (!market) {
            return NextResponse.json(
                { success: false, error: 'Market not found' },
                { status: 404 }
            );
        }

        // Get orderbook using SDK's market service
        let orderbook = null;
        try {
            orderbook = await sdk.markets.getProcessedOrderbook(market.conditionId);
        } catch (e) {
            console.warn('Could not fetch orderbook:', e);
        }

        return NextResponse.json({
            success: true,
            data: {
                market: {
                    conditionId: market.conditionId,
                    slug: market.slug,
                    question: market.question,
                    description: market.description,
                    yesPrice: market.outcomePrices?.[0] || 0.5,
                    noPrice: market.outcomePrices?.[1] || 0.5,
                    volume24h: market.volume24hr || 0,
                    liquidity: market.liquidity || 0,
                    endDate: market.endDate,
                    active: market.active,
                    closed: market.closed,
                },
                orderbook,
            }
        });

    } catch (error) {
        console.error('Error fetching market details:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch market details'
            },
            { status: 500 }
        );
    }
}
