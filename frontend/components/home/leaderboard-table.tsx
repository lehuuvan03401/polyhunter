'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Loader2, Info, RefreshCw } from 'lucide-react';

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

// Client-side cache for trader data (stale-while-revalidate pattern)
const traderCache: Map<string, { data: ActiveTrader[]; timestamp: number }> = new Map();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes
const REFRESH_COOLDOWN = 5 * 60 * 1000; // 5 minutes - rate limit for manual refresh
let lastManualRefresh = 0;

function getCachedData(period: string): ActiveTrader[] | null {
    const cached = traderCache.get(period);
    if (cached) {
        return cached.data;
    }
    return null;
}

function setCachedData(period: string, data: ActiveTrader[]) {
    traderCache.set(period, { data, timestamp: Date.now() });
}

function isCacheStale(period: string): boolean {
    const cached = traderCache.get(period);
    if (!cached) return true;
    return Date.now() - cached.timestamp > CACHE_TTL;
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

import { useTranslations } from 'next-intl';

// ... (previous imports)

export function LeaderboardTable({ initialData }: LeaderboardTableProps) {
    const t = useTranslations('Leaderboard');
    const [period, setPeriod] = useState<Period>('30d');
    const [traders, setTraders] = useState<ActiveTrader[]>(() => {
        // Try to use cached data first, fall back to initialData
        const cached = getCachedData('30d');
        if (cached && cached.length > 0) return cached;
        // Store initialData in cache
        if (initialData.length > 0) {
            setCachedData('30d', initialData);
        }
        return initialData;
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [canRefresh, setCanRefresh] = useState(() => Date.now() - lastManualRefresh > REFRESH_COOLDOWN);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
        const fetchData = async (showLoader: boolean) => {
            if (showLoader) setIsLoading(true);
            else setIsRefreshing(true);

            try {
                const response = await fetch(`/api/traders/active?limit=10&period=${period}`);
                if (response.ok && mountedRef.current) {
                    const data = await response.json();
                    const newTraders = data.traders || [];
                    setTraders(newTraders);
                    setCachedData(period, newTraders);
                }
            } catch (error) {
                console.error('Failed to fetch traders:', error);
            } finally {
                if (mountedRef.current) {
                    setIsLoading(false);
                    setIsRefreshing(false);
                }
            }
        };

        // Check cache first
        const cached = getCachedData(period);
        if (cached && cached.length > 0) {
            // Show cached data immediately
            setTraders(cached);
            setIsLoading(false);

            // Refresh in background if stale
            if (isCacheStale(period)) {
                fetchData(false);
            }
        } else {
            // No cache, show loading and fetch
            fetchData(true);
        }
    }, [period]);

    // Manual refresh handler with rate limiting
    const handleManualRefresh = async () => {
        const now = Date.now();
        if (now - lastManualRefresh < REFRESH_COOLDOWN) {
            return; // Rate limited
        }

        lastManualRefresh = now;
        setCanRefresh(false);
        setIsRefreshing(true);

        try {
            const response = await fetch(`/api/traders/active?limit=10&period=${period}`);
            if (response.ok && mountedRef.current) {
                const data = await response.json();
                const newTraders = data.traders || [];
                setTraders(newTraders);
                setCachedData(period, newTraders);
            }
        } catch (error) {
            console.error('Failed to refresh traders:', error);
        } finally {
            if (mountedRef.current) {
                setIsRefreshing(false);
                // Re-enable refresh button after cooldown
                setTimeout(() => {
                    if (mountedRef.current) setCanRefresh(true);
                }, REFRESH_COOLDOWN);
            }
        }
    };

    return (
        <div className="bg-card border rounded-xl overflow-hidden">
            {/* Header / Tabs */}
            <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                <button
                    onClick={handleManualRefresh}
                    disabled={!canRefresh || isRefreshing}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${canRefresh && !isRefreshing
                        ? 'bg-muted hover:bg-muted/80 text-foreground'
                        : 'bg-muted/50 text-muted-foreground cursor-not-allowed'
                        }`}
                    title={canRefresh ? 'Refresh data' : 'Refresh available in 5 min'}
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
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
                            {p.toUpperCase()} {t('pnl')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-12 gap-2 p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b bg-muted/50">
                <div className="col-span-1 text-center">{t('rank')}</div>
                <div className="col-span-2">{t('trader')}</div>
                <div className="col-span-2 text-right">{period.toUpperCase()} {t('pnl')}</div>
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
                                {t('copyButton')}
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
