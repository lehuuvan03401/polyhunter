'use client';

import { useState } from 'react';
import { MarketCard } from '@/components/markets/market-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMarkets } from '@/lib/hooks/use-markets';

export default function MarketsPage() {
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(12);
    const { data: markets, isLoading, error } = useMarkets(limit, search);

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto spacious">
                {/* Page Header */}
                <div className="flex items-center justify-between animate-fade-in mb-8">
                    <div>
                        <h1 className="text-4xl font-bold gradient-text mb-2">Markets</h1>
                        <p className="text-silver-400">Browse and analyze prediction markets</p>
                    </div>
                    <div className="glass px-4 py-2 rounded-lg border border-silver-600/20">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-subtle" />
                            <span className="text-sm font-medium text-silver-200">
                                {markets?.length || 0} Markets
                            </span>
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="mb-8">
                    <input
                        type="text"
                        placeholder="Search markets..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full px-6 py-4 bg-dark-800 border border-silver-600/30 rounded-xl text-silver-100 placeholder-silver-500 focus:outline-none focus:border-emerald-500/50 transition text-lg"
                    />
                </div>

                {/* Error State */}
                {error && (
                    <Card className="border-crimson-600 mb-8">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3 text-crimson-400">
                                <span className="text-2xl">⚠️</span>
                                <div>
                                    <div className="font-bold">Error Loading Markets</div>
                                    <div className="text-sm text-silver-400">
                                        {error instanceof Error ? error.message : 'Failed to load markets'}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Card key={i} className="card-elegant animate-pulse">
                                <CardContent className="pt-6">
                                    <div className="h-14 bg-white/5 rounded mb-4"></div>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="h-16 bg-white/5 rounded"></div>
                                        <div className="h-16 bg-white/5 rounded"></div>
                                    </div>
                                    <div className="h-10 bg-white/5 rounded"></div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && (!markets || markets.length === 0) && (
                    <div className="glass rounded-xl p-12 text-center card-elegant">
                        <div className="text-6xl mb-6">📊</div>
                        <h2 className="text-2xl font-bold gradient-text mb-4">No Markets Found</h2>
                        <p className="text-silver-400">
                            {search ? `No markets match "${search}"` : 'No markets available at the moment'}
                        </p>
                    </div>
                )}

                {/* Markets Grid */}
                {markets && markets.length > 0 && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {markets.map((market, index) => (
                                <div key={market.conditionId} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                                    <MarketCard market={market} />
                                </div>
                            ))}
                        </div>

                        {/* Load More */}
                        <div className="text-center mt-8">
                            <Button
                                variant="secondary"
                                onClick={() => setLimit(limit + 12)}
                            >
                                Load More Markets
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
