'use client';

import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';

export type NavPoint = {
    snapshotAt?: string;
    nav?: number;
    equity?: number;
    date?: string; // For simulated data
    value?: number; // For simulated data
    cumulativeReturn?: number | null;
    drawdown?: number | null;
};

interface ManagedNavChartProps {
    data: NavPoint[];
    loading?: boolean;
    height?: number;
    showXAxis?: boolean;
    color?: string;
}

export function ManagedNavChart({
    data,
    loading = false,
    height = 240,
    showXAxis = true,
    color = "#3b82f6"
}: ManagedNavChartProps) {
    const t = useTranslations('ManagedWealth.NavChart');

    const chartData = useMemo(() => {
        return data.map(point => ({
            date: point.snapshotAt || point.date || '',
            // @ts-ignore
            nav: point.nav ?? point.value ?? 1,
            // @ts-ignore
            equity: point.equity ?? point.value ?? 0,
            cumulativeReturn: point.cumulativeReturn,
            // Calculate a normalized value for the chart (start at 100 or 1)
            // @ts-ignore
            value: point.nav ?? point.value ?? 1
        }));
    }, [data]);

    if (loading) {
        return (
            <div className="flex w-full items-center justify-center rounded-xl border border-white/5 bg-white/[0.02]" style={{ height }}>
                <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
            </div>
        );
    }

    if (!chartData.length) {
        return (
            <div className="flex w-full items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02]" style={{ height }}>
                <p className="text-xs text-zinc-500">{t('noData')}</p>
            </div>
        );
    }

    // Calculate min/max for Y-axis domain padding
    const minNav = Math.min(...chartData.map(d => d.value));
    const maxNav = Math.max(...chartData.map(d => d.value));
    const padding = (maxNav - minNav) * 0.1 || 0.01;

    return (
        <div style={{ height, width: '100%', minWidth: 0, minHeight: height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                    <defs>
                        <linearGradient id="colorNav" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="date"
                        hide={!showXAxis}
                        tickFormatter={(val) => {
                            try {
                                return format(new Date(val), 'MM/dd');
                            } catch {
                                return '';
                            }
                        }}
                        tick={{ fontSize: 10, fill: '#71717a' }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={30}
                    />
                    <YAxis
                        domain={[minNav - padding, maxNav + padding]}
                        hide={true}
                    />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                // @ts-ignore
                                const pt = payload[0].payload;
                                return (
                                    <div className="rounded-lg border border-white/10 bg-[#0A0B0E]/90 p-2 text-xs backdrop-blur-md shadow-xl">
                                        <div className="mb-1 text-zinc-400">{format(new Date(pt.date), 'MMM dd, yyyy')}</div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-white">{t('tooltipNav', { value: pt.value.toFixed(4) })}</span>
                                            {pt.cumulativeReturn !== undefined && (
                                                <span className={pt.cumulativeReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                                    {(pt.cumulativeReturn * 100).toFixed(2)}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorNav)"
                        animationDuration={1000}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
