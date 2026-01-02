"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSmartMoneyLeaderboard } from '@/lib/hooks/use-smart-money';
import { shortenAddress, formatCurrency } from '@/lib/utils'; // Assuming formatCurrency is available

export function TopTraders() {
    const { data: topTraders } = useSmartMoneyLeaderboard(5);

    if (!topTraders) return null;

    return (
        <Card className="h-full bg-[#1a1d24] border-slate-800 shadow-none">
            <CardHeader className="pb-3 border-b border-slate-800/50">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium text-slate-200">🏆 Top Smart Money</CardTitle>
                    <Link href="/smart-money" className="text-xs text-blue-500 hover:text-blue-400">View Leaderboard</Link>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-slate-800/50">
                    {topTraders.map((trader, index) => (
                        <Link
                            key={trader.address}
                            href={`/smart-money/${trader.address}`}
                            className="flex items-center justify-between p-3 px-4 hover:bg-slate-800/30 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-600 w-4">{index + 1}</span>
                                <Avatar className="size-8 border border-slate-700">
                                    <AvatarFallback className="text-xs bg-slate-800 text-slate-400">
                                        {trader.address.slice(2, 4)}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-sm font-medium text-slate-300 font-mono">
                                        {shortenAddress(trader.address)}
                                    </p>
                                    <p className="text-xs text-slate-500">Win Rate: {trader.winRate}%</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-emerald-500 tabular-nums">
                                    +{formatCurrency(trader.pnl)}
                                </p>
                                <p className="text-xs text-slate-500">PnL</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
