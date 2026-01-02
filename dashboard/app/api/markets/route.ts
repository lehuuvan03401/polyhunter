import { NextRequest, NextResponse } from 'next/server';
import { getGammaClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const active = searchParams.get('active') !== 'false';

        // Use SDK's GammaApiClient for market listings
        const gammaClient = getGammaClient();

        // Get markets list using SDK's verified implementation
        const allMarkets = await gammaClient.getMarkets({
            active,
            limit: 100
        });

        // Filter by search if provided and map to simpler format
        const markets = allMarkets
            .filter(m => !search || m.question?.toLowerCase().includes(search.toLowerCase()))
            .slice(0, limit)
            .map(m => ({
                conditionId: m.conditionId,
                slug: m.slug || m.conditionId,
                question: m.question || 'Unknown Market',
                description: m.description,
                yesPrice: m.outcomePrices?.[0] || 0.5,
                noPrice: m.outcomePrices?.[1] || 0.5,
                volume24h: m.volume24hr || 0,
                liquidity: m.liquidity || 0,
                endDate: m.endDate,
                active: m.active,
                closed: m.closed,
            }));

        return NextResponse.json({
            success: true,
            data: markets,
            metadata: {
                count: markets.length,
                total: allMarkets.length,
                timestamp: Date.now(),
            }
        });

    } catch (error) {
        console.error('Error fetching markets:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch markets'
            },
            { status: 500 }
        );
    }
}
