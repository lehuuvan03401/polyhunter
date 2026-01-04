'use client';

import { useState, useEffect } from 'react';
import { GammaMarket } from '@catalyst-team/poly-sdk';
import { MarketCard } from '@/components/market-card';
import { polyClient } from '@/lib/polymarket';
import { Filter, ArrowDownUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MarketsListProps {
    initialMarkets: GammaMarket[];
}

type SortOption = 'volume24hr' | 'liquidity' | 'createdAt';

export function MarketsList({ initialMarkets }: MarketsListProps) {
    const [markets, setMarkets] = useState<GammaMarket[]>(initialMarkets);
    const [loading, setLoading] = useState(false);
    const [sort, setSort] = useState<SortOption>('volume24hr');
    const [offset, setOffset] = useState(initialMarkets.length);
    const [hasMore, setHasMore] = useState(true);

    const loadMore = async () => {
        setLoading(true);
        try {
            const newMarkets = await polyClient.gammaApi.getMarkets({
                active: true,
                closed: false,
                limit: 20,
                offset: offset,
                order: sort,
                ascending: false,
            });

            if (newMarkets.length === 0) {
                setHasMore(false);
            } else {
                setMarkets([...markets, ...newMarkets]);
                setOffset(offset + 20);
            }
        } catch (error) {
            console.error("Failed to load more markets:", error);
            toast.error("Failed to load more markets");
        } finally {
            setLoading(false);
        }
    };

    const handleSortChange = async (newSort: SortOption) => {
        if (newSort === sort) return;
        setSort(newSort);
        setLoading(true);
        setMarkets([]); // Clear current to show loading state or keep old? Better to clear or show loader overlay.

        try {
            const sortedMarkets = await polyClient.gammaApi.getMarkets({
                active: true,
                closed: false,
                limit: 50, // Reset to initial batch size
                offset: 0,
                order: newSort,
                ascending: false,
            });
            setMarkets(sortedMarkets);
            setOffset(sortedMarkets.length);
            setHasMore(true);
        } catch (error) {
            console.error("Failed to sort markets:", error);
            toast.error("Failed to update sort");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Filters Bar */}
            <div className="flex items-center gap-4 border-b border-white/5 pb-4 overflow-x-auto">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mr-2">
                    <ArrowDownUp className="h-4 w-4" /> Sort by:
                </div>

                {[
                    { id: 'volume24hr', label: 'Volume (24h)' },
                    { id: 'liquidity', label: 'Liquidity' },
                    { id: 'createdAt', label: 'Newest' }
                ].map((option) => (
                    <button
                        key={option.id}
                        onClick={() => handleSortChange(option.id as SortOption)}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium transition-colors border",
                            sort === option.id
                                ? "bg-primary/20 border-primary text-primary"
                                : "bg-card border-white/5 hover:border-white/20 hover:bg-white/5"
                        )}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            {/* Grid */}
            {markets.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {markets.map((market) => (
                        <MarketCard key={`${market.id}-${sort}`} market={market} />
                    ))}
                </div>
            ) : (
                !loading && (
                    <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
                        No markets found.
                    </div>
                )
            )}

            {/* Load More & Loader */}
            <div className="flex justify-center pt-8">
                {loading && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
                {!loading && hasMore && markets.length > 0 && (
                    <button
                        onClick={loadMore}
                        className="px-6 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium"
                    >
                        Load More Markets
                    </button>
                )}
                {!hasMore && markets.length > 0 && (
                    <div className="text-sm text-muted-foreground">No more markets to load</div>
                )}
            </div>
        </div>
    );
}
