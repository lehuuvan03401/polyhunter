'use client';

import { GammaMarket } from '@catalyst-team/poly-sdk';
import Link from 'next/link';
import { formatUSD } from '@/lib/utils';

interface MarketListItemProps {
    market: GammaMarket;
}

export function MarketListItem({ market }: MarketListItemProps) {
    const defaultImage = '/placeholder-market.png'; // Or some default asset
    const imageSrc = market.image || market.icon || defaultImage;

    return (
        <Link href={`/markets/${market.slug}`} className="block group">
            <div className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-card hover:bg-white/5 transition-colors">
                {/* Image */}
                <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-white/5">
                    {imageSrc && (
                        <img
                            src={imageSrc}
                            alt={market.question}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = defaultImage;
                                (e.target as HTMLImageElement).style.display = 'none'; // simple fallback
                            }}
                        />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {market.question}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                        {market.description}
                    </p>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-8 text-right flex-shrink-0">
                    <div className="hidden sm:block">
                        <div className="text-xs text-muted-foreground">Volume (24h)</div>
                        <div className="text-sm font-medium font-mono">
                            {formatUSD(market.volume24hr || 0)}
                        </div>
                    </div>

                    {/* Outcome Prices (Simplified for List) */}
                    <div className="flex gap-2">
                        {market.outcomes && market.outcomePrices && (
                            <div className="flex items-center gap-2">
                                <div className="text-xs">
                                    <span className="text-muted-foreground">Yes</span>
                                    <span className="ml-1 text-emerald-500 font-medium">
                                        {Math.round((market.outcomePrices[0] || 0) * 100)}%
                                    </span>
                                </div>
                                <div className="text-xs">
                                    <span className="text-muted-foreground">No</span>
                                    <span className="ml-1 text-red-500 font-medium">
                                        {Math.round((market.outcomePrices[1] || 0) * 100)}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
}
