'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

interface CopyTradingStatsProps {
    isActive: boolean;
    stats?: {
        tradesDetected: number;
        tradesExecuted: number;
        successRate: number;
        totalPnL: number;
        activeTime: number; // in seconds
    };
}

export function CopyTradingStats({ isActive, stats }: CopyTradingStatsProps) {
    const defaultStats = {
        tradesDetected: 0,
        tradesExecuted: 0,
        successRate: 0,
        totalPnL: 0,
        activeTime: 0,
    };

    const s = stats || defaultStats;

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
                title="Trades Detected"
                value={s.tradesDetected.toString()}
                icon="👁️"
                active={isActive}
            />
            <StatCard
                title="Trades Executed"
                value={s.tradesExecuted.toString()}
                icon="⚡"
                active={isActive}
            />
            <StatCard
                title="Success Rate"
                value={`${s.successRate.toFixed(1)}%`}
                icon="🎯"
                active={isActive}
                highlight={s.successRate >= 70}
            />
            <StatCard
                title="Total PnL"
                value={formatCurrency(s.totalPnL)}
                icon="💰"
                active={isActive}
                positive={s.totalPnL >= 0}
            />
        </div>
    );
}

function StatCard({
    title,
    value,
    icon,
    active,
    highlight = false,
    positive
}: {
    title: string;
    value: string;
    icon: string;
    active: boolean;
    highlight?: boolean;
    positive?: boolean;
}) {
    return (
        <Card className={`card-elegant transition-all ${active ? 'border-emerald-500/30' : ''}`}>
            <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{icon}</span>
                    {active && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                </div>
                <p className="text-xs text-silver-400 uppercase tracking-wide mb-1">{title}</p>
                <p className={`text-2xl font-bold ${positive !== undefined
                        ? positive ? 'text-emerald-400' : 'text-crimson-400'
                        : highlight ? 'text-emerald-400' : 'gradient-text'
                    }`}>
                    {value}
                </p>
            </CardContent>
        </Card>
    );
}
