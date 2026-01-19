'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, Info } from 'lucide-react';

export interface ActiveTrader {
    address: string;
    name: string | null;
    profileImage?: string;
    activePositions: number;
    recentTrades: number;
    lastTradeTime: number;
    pnl: number;
    volume: number;
    winRate: number;
    // Scientific metrics
    profitFactor?: number;
    maxDrawdown?: number;
    volumeWeightedWinRate?: number;
    sharpeRatio?: number;
    copyFriendliness?: number;
    dataQuality?: 'full' | 'limited' | 'insufficient';
    copyScore: number;
    rank: number;
}

// Tooltip component for metric explanations
function MetricTooltip({ label, description }: { label: string; description: string }) {
    return (
        <div className="group relative inline-flex items-center gap-1 cursor-help">
            <span>{label}</span>
            <Info className="h-3 w-3 text-muted-foreground" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border rounded text-xs text-popover-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {description}
            </div>
        </div>
    );
}

type Period = '7d' | '15d' | '30d' | '90d';

interface LeaderboardTableProps {
    initialData: ActiveTrader[];
}

export function LeaderboardTable({ initialData }: LeaderboardTableProps) {
    const [period, setPeriod] = useState<Period>('7d');
    const [traders, setTraders] = useState<ActiveTrader[]>(initialData);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Skip fetching for initial 7d render if we want to rely on initialData
        // But if user clicks back to 7d, we might want to re-fetch or use cache.
        // For simplicity, we'll fetch when period changes, except maybe the very first mount if period is default.
        // Actually, let's just fetch when period changes.

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/traders/active?limit=10&period=${period}`);
                if (response.ok) {
                    const data = await response.json();
                    setTraders(data.traders || []);
                }
            } catch (error) {
                console.error('Failed to fetch traders:', error);
            } finally {
                setIsLoading(false);
            }
        };

        // If it's the first render and period is 7d, we might already have data from props.
        // We can optimize this later, for now let's just fetch to be consistent 
        // OR checks if initialData matches the period.
        // As a simple start, we can just allow re-fetching or check if it's the specific transition.
        if (period === '7d' && initialData.length > 0 && traders === initialData) {
            // Do nothing if we're on default and have data
            return;
        }

        fetchData();
    }, [period]);

    return (
        <div className="bg-card border rounded-xl overflow-hidden">
            {/* Header / Tabs */}
            <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                    {/* Title or other Left side content could go here */}
                </div>
                <div className="flex bg-muted rounded-lg p-1">
                    {(['7d', '15d', '30d', '90d'] as Period[]).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${period === p
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                }`}
                        >
                            {p.toUpperCase()} PnL
                        </button>
                    ))}
                </div>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-12 gap-2 p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b bg-muted/50">
                <div className="col-span-1 text-center">Rank</div>
                <div className="col-span-2">Trader</div>
                <div className="col-span-2 text-right">{period.toUpperCase()} PnL</div>
                <div className="col-span-1 text-center">
                    <MetricTooltip label="PF" description="Profit Factor: Total gains / Total losses. >2 is excellent" />
                </div>
                <div className="col-span-1 text-center">
                    <MetricTooltip label="DD" description="Max Drawdown: Largest peak-to-trough decline" />
                </div>
                <div className="col-span-1 text-center">
                    <MetricTooltip label="WR" description="Volume-Weighted Win Rate" />
                </div>
                <div className="col-span-2 text-center">
                    <MetricTooltip label="Score" description="Scientific copy score based on risk-adjusted metrics" />
                </div>
                <div className="col-span-2 text-right">Action</div>
            </div>

            {/* Content */}
            <div className="relative min-h-[400px]">
                {isLoading && (
                    <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 backdrop-blur-[1px]">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                )}

                {traders.length > 0 ? traders.map((trader) => (
                    <div key={trader.address} className="grid grid-cols-12 gap-2 p-4 border-b last:border-0 hover:bg-white/5 items-center transition-colors">
                        <div className="col-span-1 text-center font-bold text-muted-foreground">#{trader.rank}</div>
                        <div className="col-span-2 flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs flex-shrink-0">
                                {trader.address.substring(2, 4).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <Link href={`/traders/${trader.address}`} className="font-medium text-sm truncate hover:text-blue-400 transition-colors">
                                    {trader.name || `${trader.address.slice(0, 6)}...`}
                                </Link>
                            </div>
                        </div>
                        <div className={`col-span-2 text-right font-mono font-medium ${trader.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {trader.pnl >= 0 ? '+' : ''}{trader.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        {/* Profit Factor */}
                        <div className="col-span-1 text-center">
                            <span className={`text-xs font-mono ${(trader.profitFactor ?? 1) >= 2 ? 'text-green-500' : (trader.profitFactor ?? 1) >= 1 ? 'text-yellow-500' : 'text-red-500'}`}>
                                {(trader.profitFactor ?? 1).toFixed(1)}
                            </span>
                        </div>
                        {/* Max Drawdown */}
                        <div className="col-span-1 text-center">
                            <span className={`text-xs font-mono ${(trader.maxDrawdown ?? 0) <= 10 ? 'text-green-500' : (trader.maxDrawdown ?? 0) <= 30 ? 'text-yellow-500' : 'text-red-500'}`}>
                                {(trader.maxDrawdown ?? 0).toFixed(0)}%
                            </span>
                        </div>
                        {/* Win Rate */}
                        <div className="col-span-1 text-center">
                            <span className={`text-xs font-mono ${(trader.volumeWeightedWinRate ?? 50) >= 60 ? 'text-green-500' : (trader.volumeWeightedWinRate ?? 50) >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                                {(trader.volumeWeightedWinRate ?? 50).toFixed(0)}%
                            </span>
                        </div>
                        {/* Scientific Score */}
                        <div className="col-span-2 text-center">
                            <div className="inline-flex items-center gap-2">
                                <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-yellow-500 to-green-500 rounded-full"
                                        style={{ width: `${trader.copyScore}%` }}
                                    />
                                </div>
                                <span className="text-sm font-mono text-muted-foreground">{trader.copyScore}</span>
                            </div>
                        </div>
                        <div className="col-span-2 text-right">
                            <Link href={`/traders/${trader.address}`} className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors inline-block">
                                Copy
                            </Link>
                        </div>
                    </div>
                )) : (
                    <div className="p-8 text-center text-muted-foreground">No active traders found for this period.</div>
                )}
            </div>
        </div>
    );
}
