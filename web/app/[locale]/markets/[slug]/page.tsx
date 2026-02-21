import { polyClient } from '@/lib/polymarket';
import { notFound } from 'next/navigation';
import { MarketHeader } from '@/components/market-detail/header';
import { MarketChart } from '@/components/market-detail/chart';
import { MarketOrderbook } from '@/components/market-detail/orderbook';
import { MarketTrading } from '@/components/market-detail/trading'; // We will create this

export const revalidate = 60;

interface PageProps {
    params: Promise<{ slug: string }>;
}

export default async function MarketPage({ params }: PageProps) {
    const { slug } = await params;
    const market = await polyClient.gammaApi.getMarketBySlug(slug);

    if (!market) {
        notFound();
    }

    // Fetch initial data for client components
    // We can pass data down or let client components fetch via API routes
    // For simplicity/SEO, we fetch initial data here if possible, 
    // but for K-Lines/Orderbook which are heavy and interactive, maybe client-side or separate?
    // Let's pass the market object to client components and let them fetch details if they need dynamic updates.
    // Actually, K-Lines are historical, so we can fetch initial here too.

    return (
        <div className="container py-8">
            <MarketHeader market={market} />

            <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-8">
                    {/* Chart Section */}
                    <MarketChart market={market} />

                    {/* Description */}
                    {market.description && (
                        <div className="rounded-xl border bg-card p-6">
                            <h3 className="mb-4 text-lg font-semibold">About this market</h3>
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                <p>{market.description}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-8">
                    {/* Trading Interface */}
                    <MarketTrading market={market} />

                    {/* Orderbook */}
                    <MarketOrderbook market={market} />
                </div>
            </div>
        </div>
    );
}
