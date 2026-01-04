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
        console.error("Failed to fetch markets:", error);
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
