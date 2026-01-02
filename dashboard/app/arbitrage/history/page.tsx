'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ArbitrageExecution {
    id: string;
    timestamp: Date;
    market: string;
    type: 'LONG' | 'SHORT';
    profitRate: number;
    amount: number;
    pnl: number;
    status: 'success' | 'failed' | 'partial';
}

// Mock data
const mockExecutions: ArbitrageExecution[] = Array.from({ length: 20 }, (_, i) => ({
    id: `arb-${i}`,
    timestamp: new Date(Date.now() - i * 3600000 * 4),
    market: ['Bitcoin $100k', 'US Election', 'ETH Flip', 'Fed Rate'][i % 4],
    type: Math.random() > 0.5 ? 'LONG' : 'SHORT',
    profitRate: Math.random() * 0.03 + 0.005,
    amount: Math.floor(Math.random() * 2000) + 200,
    pnl: (Math.random() - 0.2) * 100,
    status: Math.random() > 0.2 ? 'success' : Math.random() > 0.5 ? 'partial' : 'failed',
}));

const mockPnLData = Array.from({ length: 30 }, (_, i) => {
    const cumPnl = mockExecutions
        .filter(e => e.timestamp.getTime() > Date.now() - (30 - i) * 86400000)
        .reduce((sum, e) => sum + e.pnl, 0);
    return {
        date: new Date(Date.now() - (30 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        pnl: Math.round(cumPnl + i * 15),
    };
});

export default function ArbitrageHistoryPage() {
    const totalPnL = mockExecutions.reduce((sum, e) => sum + e.pnl, 0);
    const successRate = (mockExecutions.filter(e => e.status === 'success').length / mockExecutions.length) * 100;
    const totalExecutions = mockExecutions.length;
    const avgProfit = totalPnL / totalExecutions;

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto spacious">
                {/* Page Header */}
                <div className="flex items-center justify-between animate-fade-in mb-8">
                    <div>
                        <h1 className="text-4xl font-bold gradient-text mb-2">Arbitrage History</h1>
                        <p className="text-silver-400">Track your arbitrage execution performance</p>
                    </div>
                    <a
                        href="/arbitrage"
                        className="px-4 py-2 bg-gradient-emerald text-white rounded-lg font-medium hover:shadow-glow-emerald transition-all"
                    >
                        ← Back to Scanner
                    </a>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        title="Total PnL"
                        value={formatCurrency(totalPnL)}
                        positive={totalPnL >= 0}
                    />
                    <StatCard
                        title="Success Rate"
                        value={`${successRate.toFixed(1)}%`}
                        positive={successRate >= 70}
                    />
                    <StatCard
                        title="Executions"
                        value={totalExecutions.toString()}
                    />
                    <StatCard
                        title="Avg Profit"
                        value={formatCurrency(avgProfit)}
                        positive={avgProfit >= 0}
                    />
                </div>

                {/* PnL Chart */}
                <Card className="card-elegant mb-8">
                    <CardHeader>
                        <CardTitle className="text-silver-100">Cumulative PnL</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={mockPnLData}>
                                <defs>
                                    <linearGradient id="pnlGradientHistory" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#252525" />
                                <XAxis dataKey="date" stroke="#737373" style={{ fontSize: '11px' }} />
                                <YAxis stroke="#737373" style={{ fontSize: '11px' }} tickFormatter={(v: number) => `$${v}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '8px' }}
                                    formatter={(value: number | undefined) => value !== undefined ? [`$${value.toFixed(2)}`, 'PnL'] : ['', 'PnL']}
                                />
                                <Area type="monotone" dataKey="pnl" stroke="#10B981" strokeWidth={2} fill="url(#pnlGradientHistory)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Execution History */}
                <Card className="card-elegant">
                    <CardHeader>
                        <CardTitle className="text-silver-100">Execution History</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Header */}
                        <div className="grid grid-cols-6 text-xs text-silver-500 uppercase tracking-wide pb-3 border-b border-silver-600/20">
                            <span>Time</span>
                            <span className="col-span-2">Market</span>
                            <span className="text-center">Type</span>
                            <span className="text-right">Amount</span>
                            <span className="text-right">PnL</span>
                        </div>

                        {/* Rows */}
                        <div className="divide-y divide-silver-600/10">
                            {mockExecutions.map((exec, index) => (
                                <div
                                    key={exec.id}
                                    className="grid grid-cols-6 py-4 items-center hover:bg-white/5 transition animate-fade-in"
                                    style={{ animationDelay: `${index * 30}ms` }}
                                >
                                    <span className="text-sm text-silver-400">
                                        {exec.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        <br />
                                        <span className="text-xs text-silver-500">
                                            {exec.timestamp.toLocaleDateString()}
                                        </span>
                                    </span>

                                    <span className="col-span-2 text-silver-200 truncate pr-4">
                                        {exec.market}
                                    </span>

                                    <div className="text-center">
                                        <Badge variant={exec.type === 'LONG' ? 'success' : 'warning'}>
                                            {exec.type}
                                        </Badge>
                                        <br />
                                        <Badge
                                            variant={exec.status === 'success' ? 'success' : exec.status === 'partial' ? 'warning' : 'danger'}
                                            className="text-xs mt-1"
                                        >
                                            {exec.status}
                                        </Badge>
                                    </div>

                                    <span className="text-right font-mono text-silver-200">
                                        {formatCurrency(exec.amount)}
                                        <br />
                                        <span className="text-xs text-emerald-400">+{(exec.profitRate * 100).toFixed(2)}%</span>
                                    </span>

                                    <span className={`text-right font-mono font-bold ${exec.pnl >= 0 ? 'text-emerald-400' : 'text-crimson-400'
                                        }`}>
                                        {exec.pnl >= 0 ? '+' : ''}{formatCurrency(exec.pnl)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatCard({ title, value, positive }: { title: string; value: string; positive?: boolean }) {
    return (
        <Card className="card-elegant">
            <CardContent className="pt-5 pb-5">
                <p className="text-xs text-silver-400 uppercase tracking-wide mb-1">{title}</p>
                <p className={`text-2xl font-bold ${positive === undefined ? 'gradient-text' : positive ? 'text-emerald-400' : 'text-crimson-400'
                    }`}>
                    {value}
                </p>
            </CardContent>
        </Card>
    );
}
