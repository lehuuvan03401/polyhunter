'use client';

import { useWalletProfile } from '@/lib/hooks/use-smart-money';
import { WalletHeader } from '@/components/smart-money/wallet-header';
import { StatCard } from '@/components/smart-money/stat-card';
import { PnLChart } from '@/components/smart-money/pnl-chart';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatPercent } from '@/lib/utils';

export default function WalletDetailClient({ address }: { address: string }) {
    const { data: wallet, isLoading, error } = useWalletProfile(address);

    if (isLoading) {
        return (
            <div className="min-h-screen">
                <div className="max-w-7xl mx-auto spacious">
                    <div className="glass rounded-xl p-12 text-center animate-pulse card-elegant">
                        <div className="text-4xl mb-4">⏳</div>
                        <p className="text-silver-400">Loading wallet profile...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !wallet) {
        return (
            <div className="min-h-screen">
                <div className="max-w-7xl mx-auto spacious">
                    <Card className="border-crimson-600">
                        <CardContent className="pt-6 text-center">
                            <div className="text-4xl mb-4">❌</div>
                            <h2 className="text-xl font-bold gradient-text mb-2">Error Loading Wallet</h2>
                            <p className="text-silver-400">
                                {error instanceof Error ? error.message : 'Failed to load wallet data'}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto spacious">
                {/* Wallet Header */}
                <div className="mb-8">
                    <WalletHeader
                        address={address}
                        score={wallet.score}
                        pnl={wallet.pnl}
                        rank={wallet.rank}
                        isSmartMoney={wallet.isSmartMoney}
                    />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        title="Total Volume"
                        value={formatCurrency(wallet.volume || 0, 0)}
                        icon="💰"
                        trend="12.5%"
                        trendPositive
                    />
                    <StatCard
                        title="Win Rate"
                        value={formatPercent(wallet.winRate || 0.5)}
                        icon="🎯"
                        trend="5.2%"
                        trendPositive
                    />
                    <StatCard
                        title="Total Trades"
                        value={wallet.trades || 0}
                        icon="📊"
                        trend="8 trades"
                        trendPositive
                    />
                    <StatCard
                        title="Avg Position Size"
                        value={formatCurrency(wallet.avgPositionSize || 0)}
                        icon="📈"
                    />
                </div>

                {/* PnL Chart */}
                <div className="mb-8">
                    <PnLChart />
                </div>

                {/* Trade History Placeholder */}
                <Card className="animate-fade-in card-elegant mb-8" style={{ animationDelay: '300ms' }}>
                    <CardContent className="pt-6">
                        <div className="text-center py-12">
                            <div className="text-4xl mb-4">📜</div>
                            <h3 className="text-xl font-bold gradient-text mb-2">Trade History</h3>
                            <p className="text-silver-400">Coming soon - detailed trade history and analysis</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Performance Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="animate-fade-in card-elegant" style={{ animationDelay: '400ms' }}>
                        <CardContent className="pt-6">
                            <h3 className="text-lg font-bold gradient-text mb-6">Best Markets</h3>
                            <div className="space-y-4">
                                <MetricRow label="Politics" value="+$2,450" positive />
                                <MetricRow label="Sports" value="+$1,820" positive />
                                <MetricRow label="Crypto" value="-$320" positive={false} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="animate-fade-in card-elegant" style={{ animationDelay: '500ms' }}>
                        <CardContent className="pt-6">
                            <h3 className="text-lg font-bold gradient-text mb-6">Trading Style</h3>
                            <div className="space-y-4">
                                <MetricRow label="Avg Hold Time" value="2.5 days" />
                                <MetricRow label="Max Drawdown" value="-15.2%" />
                                <MetricRow label="Sharpe Ratio" value="1.85" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function MetricRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-silver-600/10 last:border-0">
            <span className="text-silver-400">{label}</span>
            <span className={`font-semibold ${positive === undefined ? 'text-silver-200' : positive ? 'text-emerald-400' : 'text-crimson-400'
                }`}>
                {value}
            </span>
        </div>
    );
}
