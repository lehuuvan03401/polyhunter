'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Info, TrendingUp, Star, RefreshCcw } from 'lucide-react';
import { usePrivyLogin } from '@/lib/privy-login';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';

interface RisingStar {
    address: string;
    name: string | null;
    profileImage?: string;
    activePositions: number;
    recentTrades: number;
    pnl: number;
    volume: number;
    winRate: number;
    profitFactor?: number;
    maxDrawdown?: number;
    volumeWeightedWinRate?: number;
    copyScore: number;
    rank: number;
    dataQuality?: string;
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

interface RisingStarsTableProps {
    limit?: number;
    initialPeriod?: Period;
}

const fetcher = (url: string) => fetch(url).then((res) => {
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
});

export function RisingStarsTable({ limit = 20, initialPeriod = '90d' }: RisingStarsTableProps) {
    const t = useTranslations('SmartMoney.rising');
    const { authenticated, login, isLoggingIn } = usePrivyLogin();
    const [period, setPeriod] = useState<Period>(initialPeriod);

    // Use SWR for caching and "keepPreviousData" behavior
    const { data, error, isLoading, mutate } = useSWR(
        `/api/traders/active?limit=${limit}&period=${period}`,
        fetcher,
        {
            keepPreviousData: true, // Show previous period data while loading new period
            revalidateOnFocus: false,
            dedupingInterval: 60000, // 1 minute cache
        }
    );

    const traders: RisingStar[] = data?.traders || [];

    // Show loading spinner only on initial load (no data yet)
    if (isLoading && !traders.length) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                <p>{t('errorLoad')}</p>
                <button
                    onClick={() => mutate()}
                    className="mt-4 text-blue-500 hover:text-blue-400 inline-flex items-center gap-2"
                >
                    <RefreshCcw className="h-4 w-4" /> {t('retry')}
                </button>
            </div>
        );
    }

    if (!isLoading && traders.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                {t('noActive')}
            </div>
        );
    }

    return (
        <div className="relative w-full overflow-auto">
            {/* Period Tabs */}
            <div className="flex items-center justify-end gap-1 p-3 border-b bg-muted/30">
                {(['7d', '15d', '30d', '90d'] as Period[]).map((p) => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${period === p
                            ? 'bg-yellow-600 text-white shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                            }`}
                    >
                        {p.toUpperCase()}
                    </button>
                ))}
            </div>
            <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                    <tr className="border-b transition-colors hover:bg-muted/50">
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('rank')}</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('trader')}</th>
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">{period.toUpperCase()} {t('pnl')}</th>
                        <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">
                            <MetricTooltip label="PF" description={t('tooltips.pf')} />
                        </th>
                        <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">
                            <MetricTooltip label="DD" description={t('tooltips.dd')} />
                        </th>
                        <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">
                            <MetricTooltip label="WR" description={t('tooltips.wr')} />
                        </th>
                        <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">
                            <MetricTooltip label="Score" description={t('tooltips.score')} />
                        </th>
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">{t('action')}</th>
                    </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                    {traders.map((trader) => (
                        <tr key={trader.address} className="border-b transition-colors hover:bg-muted/50">
                            <td className="p-4 align-middle font-medium whitespace-nowrap">#{trader.rank}</td>
                            <td className="p-4 align-middle font-mono whitespace-nowrap">
                                <Link
                                    href={`/traders/${trader.address}`}
                                    className="hover:text-blue-400 transition-colors hover:underline flex items-center gap-2"
                                    title={trader.name || trader.address}
                                >
                                    <div className="h-7 w-7 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-xs flex-shrink-0">
                                        <Star className="h-3 w-3" />
                                    </div>
                                    {(trader.name || `${trader.address.slice(0, 6)}...${trader.address.slice(-4)}`).length > 16
                                        ? `${(trader.name || `${trader.address.slice(0, 6)}...${trader.address.slice(-4)}`).slice(0, 16)}...`
                                        : (trader.name || `${trader.address.slice(0, 6)}...${trader.address.slice(-4)}`)}
                                </Link>
                            </td>
                            <td className={`p-4 align-middle text-right whitespace-nowrap font-mono ${trader.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {trader.pnl >= 0 ? '+' : ''}{trader.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            {/* Profit Factor */}
                            <td className="p-4 align-middle text-center whitespace-nowrap">
                                <span className={`text-xs font-mono ${(trader.profitFactor ?? 1) >= 2 ? 'text-green-500' : (trader.profitFactor ?? 1) >= 1 ? 'text-yellow-500' : 'text-red-500'}`}>
                                    {(trader.profitFactor ?? 1).toFixed(1)}
                                </span>
                            </td>
                            {/* Max Drawdown */}
                            <td className="p-4 align-middle text-center whitespace-nowrap">
                                <span className={`text-xs font-mono ${(trader.maxDrawdown ?? 0) <= 10 ? 'text-green-500' : (trader.maxDrawdown ?? 0) <= 30 ? 'text-yellow-500' : 'text-red-500'}`}>
                                    {(trader.maxDrawdown ?? 0).toFixed(0)}%
                                </span>
                            </td>
                            {/* Win Rate */}
                            <td className="p-4 align-middle text-center whitespace-nowrap">
                                <span className={`text-xs font-mono ${(trader.volumeWeightedWinRate ?? 50) >= 60 ? 'text-green-500' : (trader.volumeWeightedWinRate ?? 50) >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                                    {(trader.volumeWeightedWinRate ?? 50).toFixed(0)}%
                                </span>
                            </td>
                            {/* Score */}
                            <td className="p-4 align-middle text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-2">
                                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-yellow-500 to-green-500 rounded-full"
                                            style={{ width: `${trader.copyScore}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-mono text-muted-foreground">{trader.copyScore}</span>
                                </div>
                            </td>
                            <td className="p-4 align-middle text-right whitespace-nowrap">
                                {authenticated ? (
                                    <Link
                                        href={`/traders/${trader.address}`}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-medium transition-colors"
                                    >
                                        <TrendingUp className="h-3 w-3" />
                                        {t('follow')}
                                    </Link>
                                ) : (
                                    <button
                                        onClick={login}
                                        disabled={isLoggingIn}
                                        aria-busy={isLoggingIn}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {isLoggingIn ? (
                                            <>
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                {t('connecting')}
                                            </>
                                        ) : (
                                            t('connect')
                                        )}
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
