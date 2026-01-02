'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: string;
    trend?: string;
    trendPositive?: boolean;
    className?: string;
}

export function StatCard({ title, value, icon, trend, trendPositive, className }: StatCardProps) {
    return (
        <Card className={cn("animate-fade-in card-elegant hover:shadow-glow-silver transition-all", className)}>
            <CardContent className="pt-6 pb-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <p className="text-sm text-silver-400 mb-3 uppercase tracking-wide">{title}</p>
                        <div className="text-3xl font-bold gradient-text-emerald">{value}</div>
                    </div>
                    <div className="text-4xl opacity-40">{icon}</div>
                </div>

                {trend && (
                    <div className="flex items-center gap-2 pt-3 border-t border-silver-600/20">
                        <span className={`text-sm font-medium ${trendPositive ? 'text-emerald-400' : 'text-crimson-400'}`}>
                            {trendPositive ? '↑' : '↓'} {trend}
                        </span>
                        <span className="text-xs text-silver-500">vs last period</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
