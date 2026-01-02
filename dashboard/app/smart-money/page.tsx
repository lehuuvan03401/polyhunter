'use client';

import { useState } from 'react';
import { useSmartMoneyLeaderboard } from '@/lib/hooks/use-smart-money';
import { LeaderboardTable } from '@/components/smart-money/leaderboard-table';
import { TimePeriodSelector } from '@/components/ui/time-period-selector';
import { SearchBox } from '@/components/ui/search-box';
import { StatCard } from '@/components/smart-money/stat-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type TimePeriod = '1D' | '7D' | '30D' | 'ALL';

export default function SmartMoneyPage() {
    const [period, setPeriod] = useState<TimePeriod>('30D');
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(20);
    const { data: wallets, isLoading, error } = useSmartMoneyLeaderboard(limit);

    // Filter by search
    const filteredWallets = search && wallets
        ? wallets.filter(w => w.address.toLowerCase().includes(search.toLowerCase()))
        : wallets || [];

    const handleLoadMore = () => {
        setLimit(prev => prev + 20);
    };

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto spacious">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in mb-8">
                    <div>
                        <h1 className="text-4xl font-bold gradient-text mb-2">Smart Money Tracker</h1>
                        <p className="text-silver-400">Track and analyze the strategies of top-performing traders</p>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                        <Link
                            href="/smart-money/copy-trading"
                            className="px-4 py-2 bg-gradient-emerald text-white rounded-lg font-medium hover:shadow-glow-emerald transition-all"
                        >
                            🤖 Copy Trading
                        </Link>
                        <div className="glass px-4 py-2 rounded-lg border border-silver-600/20">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-subtle" />
                                <span className="text-sm font-medium text-silver-200">Live Updates</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <TimePeriodSelector value={period} onChange={setPeriod} />
                    <SearchBox
                        placeholder="Search by wallet address..."
                        onSearch={setSearch}
                        className="w-full md:w-80"
                    />
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        title="Tracked Wallets"
                        value={(wallets?.length || 0).toString()}
                        icon="👛"
                    />
                    <StatCard
                        title="Total Volume"
                        value="$12.5M"
                        icon="💰"
                        trend="15.2%"
                        trendPositive
                    />
                    <StatCard
                        title="Avg Win Rate"
                        value="62.4%"
                        icon="🎯"
                        trend="3.1%"
                        trendPositive
                    />
                    <StatCard
                        title="Top PnL"
                        value="$125K"
                        icon="🏆"
                    />
                </div>

                {/* Error State */}
                {error && (
                    <Card className="border-crimson-600 mb-6">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3 text-crimson-400">
                                <span className="text-2xl">⚠️</span>
                                <div>
                                    <div className="font-bold">Error Loading Data</div>
                                    <div className="text-sm text-silver-400">{error.message}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Leaderboard Table */}
                <LeaderboardTable
                    wallets={filteredWallets}
                    isLoading={isLoading}
                />

                {/* Load More */}
                {wallets && wallets.length >= limit && (
                    <div className="text-center mt-6">
                        <Button variant="secondary" onClick={handleLoadMore}>
                            Load More Wallets
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
