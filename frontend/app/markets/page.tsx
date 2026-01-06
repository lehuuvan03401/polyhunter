import { polyClient } from '@/lib/polymarket';
import { MarketsList } from '@/components/markets-list';
import { GammaMarket } from '@catalyst-team/poly-sdk';

export const revalidate = 60;

export default async function MarketsPage() {
    let markets: GammaMarket[] = [];
    try {
        markets = await polyClient.gammaApi.getMarkets({
            active: true,
            closed: false,
            limit: 50,
            order: 'volume24hr',
            ascending: false,
        });
    } catch (error) {
        console.warn("Failed to fetch markets from Gamma API, trying CLOB fallback...", error);
        try {
            const { markets: clobMarkets } = await polyClient.markets.getClobMarkets();
            markets = clobMarkets.map(m => ({
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
        } catch (clobError) {
            console.error("Failed to fetch markets from CLOB fallback:", clobError);
        }
    }

    return (
        <div className="container py-10">
            <div className="mb-8 space-y-4">
                <h1 className="text-3xl font-bold tracking-tight">Participate in Markets</h1>
                <p className="text-muted-foreground">
                    Explore the top prediction markets by volume.
                </p>
            </div>

            <MarketsList initialMarkets={markets} />
        </div>
    );
}
