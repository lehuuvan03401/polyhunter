'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface AnalyticsData {
    totalVolume: number;
    totalTrades: number;
    winRate: number;
    profitFactor: number;
    avgTradeSize: number;
    maxDrawdown: number;
    dailyPnL: Array<{ date: string; pnl: number }>;
    marketBreakdown: Array<{ name: string; value: number; color: string }>;
}

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard title="Total Volume" value={formatCurrency(data.totalVolume, 0)} icon="💰" />
                <StatCard title="Total Trades" value={data.totalTrades.toString()} icon="📊" />
                <StatCard title="Win Rate" value={`${data.winRate.toFixed(1)}%`} icon="🎯" highlight={data.winRate >= 60} />
                <StatCard title="Profit Factor" value={data.profitFactor.toFixed(2)} icon="📈" highlight={data.profitFactor > 1.5} />
                <StatCard title="Avg Trade" value={formatCurrency(data.avgTradeSize)} icon="💵" />
                <StatCard title="Max Drawdown" value={`${data.maxDrawdown.toFixed(1)}%`} icon="📉" negative />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* PnL Chart */}
                <Card className="card-elegant lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-silver-100">Daily PnL</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={data.dailyPnL}>
                                <defs>
                                    <linearGradient id="pnlGradientAnalytics" x1="0" y1="0" x2="0" y2="1">
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
                                <Area type="monotone" dataKey="pnl" stroke="#10B981" strokeWidth={2} fill="url(#pnlGradientAnalytics)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Market Breakdown */}
                <Card className="card-elegant">
                    <CardHeader>
                        <CardTitle className="text-silver-100">Market Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={data.marketBreakdown}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    dataKey="value"
                                    paddingAngle={2}
                                >
                                    {data.marketBreakdown.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '8px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 mt-4">
                            {data.marketBreakdown.map((item) => (
                                <div key={item.name} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-silver-300">{item.name}</span>
                                    </div>
                                    <span className="text-silver-400">{item.value}%</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatCard({
    title,
    value,
    icon,
    highlight = false,
    negative = false,
}: {
    title: string;
    value: string;
    icon: string;
    highlight?: boolean;
    negative?: boolean;
}) {
    return (
        <Card className="card-elegant">
            <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xl">{icon}</span>
                </div>
                <p className="text-xs text-silver-400 uppercase tracking-wide mb-1">{title}</p>
                <p className={`text-xl font-bold ${negative ? 'text-crimson-400' : highlight ? 'text-emerald-400' : 'gradient-text'
                    }`}>
                    {value}
                </p>
            </CardContent>
        </Card>
    );
}

// Mock data generator
export function generateMockAnalytics(): AnalyticsData {
    const dailyPnL = [];
    let cumPnL = 0;
    for (let i = 30; i >= 0; i--) {
        cumPnL += (Math.random() - 0.45) * 100;
        dailyPnL.push({
            date: new Date(Date.now() - i * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            pnl: Math.round(cumPnL),
        });
    }

    return {
        totalVolume: 125000,
        totalTrades: 342,
        winRate: 62.4,
        profitFactor: 1.85,
        avgTradeSize: 365,
        maxDrawdown: 12.3,
        dailyPnL,
        marketBreakdown: [
            { name: 'Politics', value: 35, color: '#10B981' },
            { name: 'Sports', value: 28, color: '#737373' },
            { name: 'Crypto', value: 22, color: '#34D399' },
            { name: 'Other', value: 15, color: '#525252' },
        ],
    };
}
