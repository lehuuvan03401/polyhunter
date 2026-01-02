'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

interface Market {
    conditionId: string;
    slug: string;
    question: string;
    yesPrice: number;
    noPrice: number;
    volume24h: number;
    liquidity: number;
    endDate?: string;
}

interface MarketCardProps {
    market: Market;
}

export function MarketCard({ market }: MarketCardProps) {
    const yesPercent = Math.round(market.yesPrice * 100);
    const noPercent = Math.round(market.noPrice * 100);

    return (
        <Link href={`/markets/${market.slug}`}>
            <Card className="card-elegant hover:shadow-glow-silver transition-all cursor-pointer h-full">
                <CardContent className="pt-6">
                    {/* Question */}
                    <h3 className="text-lg font-semibold text-silver-100 mb-4 line-clamp-2 min-h-[56px]">
                        {market.question}
                    </h3>

                    {/* Prices */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                            <p className="text-xs text-silver-400 mb-1">YES</p>
                            <p className="text-2xl font-bold text-emerald-400">{yesPercent}¢</p>
                        </div>
                        <div className="text-center p-3 bg-crimson-500/10 rounded-lg border border-crimson-500/20">
                            <p className="text-xs text-silver-400 mb-1">NO</p>
                            <p className="text-2xl font-bold text-crimson-400">{noPercent}¢</p>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-sm">
                        <div>
                            <p className="text-silver-500">24h Volume</p>
                            <p className="font-semibold text-silver-200">{formatCurrency(market.volume24h, 0)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-silver-500">Liquidity</p>
                            <p className="font-semibold text-silver-200">{formatCurrency(market.liquidity, 0)}</p>
                        </div>
                    </div>

                    {/* End Date */}
                    {market.endDate && (
                        <div className="mt-4 pt-4 border-t border-silver-600/20">
                            <Badge variant="info" className="text-xs">
                                Ends: {new Date(market.endDate).toLocaleDateString()}
                            </Badge>
                        </div>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}
