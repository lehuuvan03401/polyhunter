'use client';

import { useState } from 'react';
import { LeaderboardTable } from '@/components/smart-money/leaderboard-table';
import { useSmartMoneyLeaderboard } from '@/lib/hooks/use-smart-money';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SmartMoneyPage() {
    const [limit, setLimit] = useState(50);
    const { data: wallets, isLoading, error } = useSmartMoneyLeaderboard(limit);

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto spacious">
                {/* Page Header */}
                <div className="flex items-center justify-between animate-fade-in mb-8">
                    <div>
                        <h1 className="text-4xl font-bold gradient-text mb-2">Smart Money Tracker</h1>
                        <p className="text-silver-400">Track and analyze the strategies of top-performing traders</p>
                    </div>
                    <div className="glass px-4 py-2 rounded-lg border border-silver-600/20">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-subtle" />
                            <span className="text-sm font-medium text-silver-200">Live Updates</span>
                        </div>
                    </div>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        title="Top Traders"
                        value={wallets?.length.toString() || '0'}
                        icon="👥"
                    />
                    <StatCard
                        title="Avg Score"
                        value={wallets ? Math.round(wallets.reduce((sum, w) => sum + (w.score || 0), 0) / wallets.length).toString() : '0'}
                        icon="⭐"
                    />
                    <StatCard
                        title="Total Volume"
                        value={wallets ? `$${(wallets.reduce((sum, w) => sum + (w.volume || 0), 0) / 1000000).toFixed(1)}M` : '$0'}
                        icon="💰"
                    />
                    <StatCard
                        title="Avg Win Rate"
                        value={wallets ? `${Math.round(wallets.reduce((sum, w) => sum + ((w.winRate || 0.5) * 100), 0) / wallets.length)}%` : '0%'}
                        icon="📈"
                    />
                </div>

                {/* Error State */}
                {error && (
                    <Card className="border-crimson-600 mb-8">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3 text-crimson-400">
                                <span className="text-2xl">⚠️</span>
                                <div>
                                    <div className="font-bold">Error Loading Data</div>
                                    <div className="text-sm text-silver-400">{error instanceof Error ? error.message : 'Failed to load leaderboard'}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Leaderboard Table */}
                <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
                    <LeaderboardTable wallets={wallets || []} isLoading={isLoading} />
                </div>

                {/* Load More */}
                {wallets && wallets.length >= limit && (
                    <div className="text-center mt-8">
                        <Button
                            variant="secondary"
                            onClick={() => setLimit(limit + 50)}
                        >
                            Load More Traders
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: string }) {
    return (
        <Card className="card-elegant hover:shadow-glow-silver transition-all">
            <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-silver-400 mb-1">{title}</p>
                        <p className="text-2xl font-bold gradient-text-emerald">{value}</p>
                    </div>
                    <div className="text-3xl opacity-50">{icon}</div>
                </div>
            </CardContent>
        </Card>
    );
}
