'use client';

import { MarketsList } from '@/components/markets-list';
import { GammaMarket } from '@catalyst-team/poly-sdk';
import { usePrivy } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { Lock, TrendingUp, BarChart3, Search } from 'lucide-react';

export function MarketsPage() {
    const { authenticated, ready, login } = usePrivy();
    const [markets, setMarkets] = useState<GammaMarket[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // 只在已登录时才获取数据
        if (!authenticated) {
            return;
        }

        const fetchMarkets = async () => {
            setIsLoading(true);
            let fetchedMarkets: GammaMarket[] = [];
            try {
                // Use server-side API route to avoid CORS issues
                const response = await fetch('/api/markets?active=true&closed=false&limit=50&order=volume24hr&ascending=false');
                if (!response.ok) {
                    throw new Error(`API responded with status ${response.status}`);
                }
                fetchedMarkets = await response.json();
            } catch (error) {
                console.error("Failed to fetch markets from API:", error);
            }
            setMarkets(fetchedMarkets);
            setIsLoading(false);
        };

        fetchMarkets();
    }, [authenticated]);

    if (!ready) {
        return (
            <div className="container py-10">
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div className="container py-10">
                <div className="mb-8 space-y-4 text-center">
                    <h1 className="text-4xl font-bold tracking-tight">Participate in Markets</h1>
                    <p className="text-muted-foreground text-lg">
                        Explore the top prediction markets by volume.
                    </p>
                </div>

                <div className="max-w-4xl mx-auto">
                    <div className="rounded-2xl border border-white/10 bg-card/50 p-12 text-center">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <Lock className="h-10 w-10 text-blue-400" />
                        </div>
                        <h2 className="text-2xl font-bold mb-3">Connect Your Wallet to View Markets</h2>
                        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                            Access the complete list of active prediction markets on Polymarket.
                            View market details, prices, and start trading with a single click.
                        </p>

                        <div className="grid md:grid-cols-3 gap-6 mb-8">
                            <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-green-500/10 flex items-center justify-center">
                                    <TrendingUp className="h-5 w-5 text-green-400" />
                                </div>
                                <h3 className="font-semibold mb-1">50+ Active Markets</h3>
                                <p className="text-xs text-muted-foreground">Live prediction markets</p>
                            </div>
                            <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <BarChart3 className="h-5 w-5 text-blue-400" />
                                </div>
                                <h3 className="font-semibold mb-1">Real-time Prices</h3>
                                <p className="text-xs text-muted-foreground">Live price updates</p>
                            </div>
                            <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <Search className="h-5 w-5 text-purple-400" />
                                </div>
                                <h3 className="font-semibold mb-1">Easy Trading</h3>
                                <p className="text-xs text-muted-foreground">One-click trading</p>
                            </div>
                        </div>

                        <button
                            onClick={login}
                            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
                        >
                            Connect Wallet to View Markets
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-10">
            <div className="mb-8 space-y-4 text-center">
                <h1 className="text-4xl font-bold tracking-tight">Participate in Markets</h1>
                <p className="text-muted-foreground text-lg">
                    Explore the top prediction markets by volume.
                </p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
                </div>
            ) : (
                <MarketsList initialMarkets={markets} />
            )}
        </div>
    );
}

export default MarketsPage;
