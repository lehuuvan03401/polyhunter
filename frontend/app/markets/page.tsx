import { polyClient } from '@/lib/polymarket';
import { MarketCard } from '@/components/market-card';
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

            {markets.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {markets.map((market) => (
                        <MarketCard key={market.id} market={market} />
                    ))}
                </div>
            ) : (
                <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
                    No markets found.
                </div>
            )}
        </div>
    );
}
