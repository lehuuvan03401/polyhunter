import { polyClient } from '@/lib/polymarket';
import { MarketCard } from '@/components/market-card'; // Fix relative import if needed, assuming alias works for internal files
import { ArrowRight, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { GammaMarket } from '@catalyst-team/poly-sdk'; // Relative import for type


// Revalidate every 60 seconds
export const revalidate = 60;

export default async function Home() {
  // Fetch trending markets
  // We use try/catch to handle errors gracefully if SDK isn't fully configured
  let trendingMarkets: GammaMarket[] = [];
  try {
    trendingMarkets = await polyClient.gammaApi.getTrendingMarkets(12);
  } catch (error) {
    console.error("Failed to fetch trending markets:", error);
  }

  return (
    <div className="container py-10">
      <section className="mb-12 space-y-4 text-center sm:text-left">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          The Global <span className="text-primary">Prediction Market</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Trade on the world's most highly debated topics. crypto, politics, sports, and current events.
        </p>
      </section>

      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Trending Now</h2>
        </div>
        <Link href="/markets" className="group flex items-center text-sm font-medium text-primary hover:underline">
          View All <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {trendingMarkets.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {trendingMarkets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
          No markets found or API error.
        </div>
      )}
    </div>
  );
}
