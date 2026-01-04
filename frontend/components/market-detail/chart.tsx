'use client';

import { GammaMarket } from '@catalyst-team/poly-sdk';
import { polyClient } from '@/lib/polymarket';
import { useEffect, useState } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { format } from 'date-fns';

interface MarketChartProps {
    market: GammaMarket;
}

export function MarketChart({ market }: MarketChartProps) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const klines = await polyClient.markets.getKLines(market.conditionId, '1h', { limit: 168 }); // 1 week
                const formatted = klines.map((k) => ({
                    date: new Date(k.timestamp * 1000),
                    price: k.close,
                }));
                setData(formatted);
            } catch (e) {
                console.error('Failed to fetch chart data', e);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [market.conditionId]);

    if (loading) {
        return <div className="flex h-[300px] w-full items-center justify-center rounded-xl border bg-card/50">Loading Chart...</div>;
    }

    if (data.length === 0) {
        return <div className="flex h-[300px] w-full items-center justify-center rounded-xl border bg-card/50">No Chart Data Available</div>;
    }

    return (
        <div className="rounded-xl border bg-card p-6">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h3 className="font-semibold">Price History (YES)</h3>
                    <p className="text-sm text-muted-foreground">Last 7 Days</p>
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="oklch(var(--primary))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="oklch(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(var(--border))" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(d) => format(d, 'MMM d')}
                            stroke="oklch(var(--muted-foreground))"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            domain={[0, 1]}
                            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                            stroke="oklch(var(--muted-foreground))"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'oklch(var(--popover))',
                                border: '1px solid oklch(var(--border))',
                                borderRadius: '8px',
                                color: 'oklch(var(--popover-foreground))'
                            }}
                            labelFormatter={(l) => format(l, 'MMM d, h:mm a')}
                            formatter={(value: number | undefined) => [value ? `${(value * 100).toFixed(1)}%` : '-', 'Price']}
                        />
                        <Area
                            type="monotone"
                            dataKey="price"
                            stroke="oklch(var(--primary))"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorPrice)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
