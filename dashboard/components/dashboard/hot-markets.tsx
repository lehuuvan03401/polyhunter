"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMarkets } from '@/lib/hooks/use-markets';

export function HotMarkets() {
    const { data: hotMarkets } = useMarkets({ limit: 5 });

    if (!hotMarkets) return null;

    return (
        <Card className="h-full bg-[#1a1d24] border-slate-800 shadow-none">
            <CardHeader className="pb-3 border-b border-slate-800/50">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium text-slate-200">🔥 Hot Markets</CardTitle>
                    <Link href="/markets" className="text-xs text-blue-500 hover:text-blue-400">View All</Link>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-slate-800/50">
                    {hotMarkets.map((market) => (
                        <Link
                            key={market.conditionId}
                            href={`/markets/${market.slug}`}
                            className="flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors group"
                        >
                            <div className="flex-1 min-w-0 pr-4">
                                <p className="text-sm text-slate-300 font-medium truncate group-hover:text-blue-400 transition-colors">
                                    {market.question}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-slate-500">Vol: ${market.volume24h.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <Badge variant="success" className="h-6">
                                    YE {(market.yesPrice * 100).toFixed(0)}¢
                                </Badge>
                                <Badge variant="danger" className="h-6">
                                    NO {(market.noPrice * 100).toFixed(0)}¢
                                </Badge>
                            </div>
                        </Link>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
