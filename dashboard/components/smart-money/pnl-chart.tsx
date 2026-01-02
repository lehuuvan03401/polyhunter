'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PnLChartProps {
    data?: Array<{ date: string; pnl: number }>;
}

export function PnLChart({ data }: PnLChartProps) {
    // Mock data if none provided
    const chartData = data || generateMockData();

    const isPositive = chartData[chartData.length - 1]?.pnl >= 0;

    return (
        <Card className="animate-fade-in card-elegant" style={{ animationDelay: '200ms' }}>
            <CardHeader>
                <CardTitle className="text-silver-100">PnL Over Time</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="5%"
                                    stopColor={isPositive ? '#10B981' : '#EF4444'}
                                    stopOpacity={0.3}
                                />
                                <stop
                                    offset="95%"
                                    stopColor={isPositive ? '#10B981' : '#EF4444'}
                                    stopOpacity={0}
                                />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#252525" />
                        <XAxis
                            dataKey="date"
                            stroke="#737373"
                            style={{ fontSize: '12px' }}
                        />
                        <YAxis
                            stroke="#737373"
                            style={{ fontSize: '12px' }}
                            tickFormatter={(value: number) => `$${value}`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1A1A1A',
                                border: '1px solid rgba(115, 115, 115, 0.2)',
                                borderRadius: '8px',
                                fontSize: '12px',
                            }}
                            formatter={(value: number | undefined) => value !== undefined ? [`$${value.toFixed(2)}`, 'PnL'] : ['', 'PnL']}
                        />
                        <Area
                            type="monotone"
                            dataKey="pnl"
                            stroke={isPositive ? '#10B981' : '#EF4444'}
                            strokeWidth={2}
                            fill="url(#pnlGradient)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

function generateMockData() {
    const data = [];
    let pnl = 0;
    const days = 30;

    for (let i = 0; i < days; i++) {
        pnl += (Math.random() - 0.45) * 500; // Slight upward bias
        data.push({
            date: new Date(Date.now() - (days - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            pnl: Math.round(pnl),
        });
    }

    return data;
}
