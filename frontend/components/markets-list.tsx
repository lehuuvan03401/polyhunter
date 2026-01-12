'use client';
// Force rebuild

import { useState } from 'react';
import { GammaMarket } from '@catalyst-team/poly-sdk';
import { MarketCard } from '@/components/market-card';
import { MarketListItem } from '@/components/market-list-item';
import { Filter, ArrowDownUp, Loader2, LayoutGrid, List as ListIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MarketsListProps {
    initialMarkets: GammaMarket[];
}

type SortOption = 'volume24hr' | 'liquidity' | 'createdAt';
type ViewMode = 'grid' | 'list';

export function MarketsList({ initialMarkets }: MarketsListProps) {
    const [markets, setMarkets] = useState<GammaMarket[]>(initialMarkets);
    const [loading, setLoading] = useState(false);
    const [sort, setSort] = useState<SortOption>('volume24hr');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [offset, setOffset] = useState(initialMarkets.length);
    const [hasMore, setHasMore] = useState(true);

    const loadMore = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                active: 'true',
                closed: 'false',
                limit: '20',
                offset: offset.toString(),
                order: sort,
                ascending: 'false',
            });

            const response = await fetch(`/api/markets?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch markets');

            const newMarkets = await response.json();

            if (newMarkets.length === 0) {
                setHasMore(false);
            } else {
                setMarkets(prev => {
                    const existingIds = new Set(prev.map(m => m.id));
                    const uniqueNewMarkets = newMarkets.filter((m: GammaMarket) => !existingIds.has(m.id));
                    return [...prev, ...uniqueNewMarkets];
                });
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
        setMarkets([]);

        try {
            const params = new URLSearchParams({
                active: 'true',
                closed: 'false',
                limit: '50',
                offset: '0',
                order: newSort,
                ascending: 'false',
            });

            const response = await fetch(`/api/markets?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch markets');

            const sortedMarkets = await response.json();

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
            {/* Filters & View Toggle Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">

                {/* Sort Options */}
                <div className="flex items-center gap-4 overflow-x-auto">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mr-2 whitespace-nowrap">
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
                                "px-4 py-2 rounded-full text-sm font-medium transition-colors border whitespace-nowrap",
                                sort === option.id
                                    ? "bg-primary/20 border-primary text-primary"
                                    : "bg-card border-white/5 hover:border-white/20 hover:bg-white/5"
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center bg-card border border-white/5 rounded-lg p-1">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={cn(
                            "p-2 rounded-md transition-colors",
                            viewMode === 'grid'
                                ? "bg-white/10 text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                        )}
                        title="Grid View"
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={cn(
                            "p-2 rounded-md transition-colors",
                            viewMode === 'list'
                                ? "bg-white/10 text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                        )}
                        title="List View"
                    >
                        <ListIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {markets.length > 0 ? (
                <div className={cn(
                    viewMode === 'grid'
                        ? "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                        : "flex flex-col gap-3"
                )}>
                    {markets.map((market, index) => (
                        viewMode === 'grid'
                            ? <MarketCard key={`${market.id || index}-${sort}-${index}`} market={market} />
                            : <MarketListItem key={`${market.id || index}-${sort}-${index}`} market={market} />
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
