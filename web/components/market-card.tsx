import Link from 'next/link';

import { GammaMarket } from '@catalyst-team/poly-sdk';
import { cn } from '@/lib/utils';

// Simple Card components since we didn't install shadcn/ui yet
// I will implement them inline here for simplicity or create a ui folder
// Ideally for a "Premium" look we use the shadcn/ui structure, but I'll write raw tailwind for speed
// unless I want to create the components manually.
// Let's create a basic card structure here.

export interface MarketCardProps {
    market: GammaMarket;
}

export function MarketCard({ market }: MarketCardProps) {
    const yesPrice = market.outcomePrices[0] || 0;
    const noPrice = market.outcomePrices[1] || 0;
    const volume = market.volume24hr || market.volume;

    return (
        <Link href={`/markets/${market.slug}`}>
            <div className="group relative overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all hover:border-primary/50 hover:shadow-md">
                <div className="aspect-[2/1] w-full overflow-hidden bg-muted">
                    {market.image ? (
                        <img
                            src={market.image}
                            alt={market.question}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center bg-secondary/50">
                            <span className="text-4xl">🎲</span>
                        </div>
                    )}
                    {market.active && (
                        <div className="absolute right-2 top-2 rounded-full bg-green-500/90 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
                            Active
                        </div>
                    )}
                </div>

                <div className="p-4">
                    <h3 className="line-clamp-2 text-lg font-semibold tracking-tight transition-colors group-hover:text-primary">
                        {market.question}
                    </h3>

                    <div className="mt-4 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">Volume (24h)</span>
                            <span className="font-mono font-medium">
                                ${volume.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                        </div>

                        <div className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Yes Price</span>
                            <span className={cn(
                                "font-mono text-lg font-bold",
                                yesPrice > 0.5 ? "text-green-500" : "text-red-500"
                            )}>
                                {(yesPrice * 100).toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Probability Bar */}
                <div className="h-1.5 w-full bg-secondary">
                    <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${yesPrice * 100}%` }}
                    />
                </div>
            </div>
        </Link>
    );
}
