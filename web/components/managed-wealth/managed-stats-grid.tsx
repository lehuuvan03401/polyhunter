'use client';

import { LucideIcon } from 'lucide-react';

export type StatItem = {
    label: string;
    value: string;
    subValue?: string;
    color?: 'default' | 'blue' | 'emerald' | 'purple' | 'amber';
    icon?: LucideIcon;
};

interface ManagedStatsGridProps {
    stats: StatItem[];
}

export function ManagedStatsGrid({ stats }: ManagedStatsGridProps) {
    const getColorClasses = (color?: string) => {
        switch (color) {
            case 'blue': return {
                bg: 'bg-blue-500/10',
                border: 'border-blue-500/20',
                text: 'text-blue-400',
                icon: 'text-blue-500',
                gradient: 'from-blue-500/10'
            };
            case 'emerald': return {
                bg: 'bg-emerald-500/10',
                border: 'border-emerald-500/20',
                text: 'text-emerald-400',
                icon: 'text-emerald-500',
                gradient: 'from-emerald-500/10'
            };
            case 'purple': return {
                bg: 'bg-purple-500/10',
                border: 'border-purple-500/20',
                text: 'text-purple-400',
                icon: 'text-purple-500',
                gradient: 'from-purple-500/10'
            };
            case 'amber': return {
                bg: 'bg-amber-500/10',
                border: 'border-amber-500/20',
                text: 'text-amber-400',
                icon: 'text-amber-500',
                gradient: 'from-amber-500/10'
            };
            default: return {
                bg: 'bg-white/5',
                border: 'border-white/10',
                text: 'text-zinc-400',
                icon: 'text-zinc-500',
                gradient: 'from-white/5'
            };
        }
    };

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat, i) => {
                const colors = getColorClasses(stat.color);
                const Icon = stat.icon;

                return (
                    <div
                        key={i}
                        className={`relative overflow-hidden rounded-2xl border p-5 backdrop-blur-sm transition-all hover:border-white/20 hover:shadow-lg ${colors.bg} ${colors.border}`}
                    >
                        {/* Gradient Background */}
                        <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${colors.gradient} to-transparent blur-2xl opacity-50`} />

                        <div className="relative z-10 flex justify-between items-start">
                            <div className="min-w-0 flex-1 relative z-10">
                                <div className={`text-sm font-medium ${colors.text} mb-1 flex items-center gap-2 truncate`}>
                                    {stat.label}
                                </div>
                                <div className="text-2xl font-bold tracking-tight text-white truncate">{stat.value}</div>
                                {stat.subValue && (
                                    <div className="mt-1 text-xs font-medium text-zinc-500 flex items-center gap-1.5 truncate">
                                        {stat.subValue}
                                    </div>
                                )}
                            </div>
                            {Icon && (
                                <div className={`rounded-xl p-2.5 bg-white/5 shrink-0 ml-4 ${colors.icon} relative z-10`}>
                                    <Icon className="h-5 w-5" />
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
