import { NextRequest, NextResponse } from 'next/server';
import { polyClient } from '@/lib/polymarket';
import { GammaMarket } from '@catalyst-team/poly-sdk';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const order = searchParams.get('order') || 'volume24hr';
    const ascending = searchParams.get('ascending') === 'true';
    const active = searchParams.get('active') !== 'false'; // Default true
    const closed = searchParams.get('closed') === 'true';

    try {
        console.log("Fetching markets from Gamma API via Server Route...");
        const markets = await polyClient.gammaApi.getMarkets({
            limit,
            offset,
            order,
            ascending,
            active,
            closed
        });
        return NextResponse.json(markets);
    } catch (error) {
        console.warn("Gamma API failed in API route, falling back to CLOB...", error);

        try {
            // Fallback to CLOB
            // Note: CLOB API pagination works with next_cursor, which is different from offset.
            // For this fallback, we might just fetch the latest markets.
            // Since we can't easily map offset/limit to cursor without maintaining state,
            // we'll make a best effort to fetch markets.

            const { markets: clobMarkets } = await polyClient.markets.getClobMarkets();

            // Map to GammaMarket format
            let mappedMarkets: GammaMarket[] = clobMarkets.map(m => ({
                id: m.conditionId,
                conditionId: m.conditionId,
                slug: m.marketSlug,
                question: m.question,
                description: m.description,
                outcomes: m.tokens.map(t => t.outcome),
                outcomePrices: m.tokens.map(t => t.price),
                volume: 0,
                volume24hr: 0,
                liquidity: 0,
                endDate: m.endDateIso ? new Date(m.endDateIso) : new Date(),
                active: m.active,
                closed: m.closed,
                image: m.image,
                icon: m.icon,
                tags: [],
            } as GammaMarket));

            // Basic in-memory sorting/pagination to mimic API behavior for the fallback
            // This is not efficient for large datasets but acceptable for fallback
            if (order === 'createdAt') {
                // CLOB markets don't strictly have createdAt, but we can assume order returned implies recency or use conditionId?
                // Actually, let's just reverse if they came in some order.
                // Or just ignore sort for fallback.
            }

            // Apply pagination manually on the fetched batch
            const slicedMarkets = mappedMarkets.slice(offset, offset + limit);

            return NextResponse.json(slicedMarkets);

        } catch (clobError) {
            console.error("CLOB fallback failed:", clobError);
            // Return empty list instead of 500 to prevent UI crash
            return NextResponse.json([]);
        }
    }
}
