'use client';

import { cn } from '@/lib/utils';

import { useTranslations } from 'next-intl';

interface GenerationData {
    generation: number;
    count: number;
    percentage: number;
}

interface GenerationSummaryBarProps {
    data: GenerationData[];
    total: number;
    className?: string;
}

const GENERATION_COLORS = [
    'bg-green-500',      // Gen 1 (Direct - Money)
    'bg-yellow-400',     // Gen 2
    'bg-yellow-500',     // Gen 3
    'bg-yellow-600',     // Gen 4
    'bg-yellow-700',     // Gen 5+
];

export function GenerationSummaryBar({ data, total, className }: GenerationSummaryBarProps) {
    const t = useTranslations('Affiliate.teamView');

    if (data.length === 0) {
        return (
            <div className={cn("p-4 rounded-xl border border-white/10 bg-white/5", className)}>
                <p className="text-sm text-muted-foreground text-center">{t('empty')}</p>
            </div>
        );
    }

    return (
        <div className={cn("p-4 rounded-xl border border-white/10 bg-white/5", className)}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-muted-foreground">{t('breakdown')}</h4>
                <span className="text-sm text-white font-mono">{t('total', { count: total })}</span>
            </div>

            {/* Bar Chart */}
            <div className="flex gap-1 h-8 mb-4 rounded-lg overflow-hidden bg-white/5">
                {data.map((gen, idx) => (
                    <div
                        key={gen.generation}
                        className={cn(
                            "relative flex items-center justify-center transition-all",
                            GENERATION_COLORS[Math.min(idx, GENERATION_COLORS.length - 1)]
                        )}
                        style={{ width: `${Math.max(gen.percentage, 5)}%` }}
                        title={`Gen ${gen.generation}: ${gen.count} (${gen.percentage}%)`}
                    >
                        {gen.percentage >= 10 && (
                            <span className="text-xs font-bold text-white/90">{gen.count}</span>
                        )}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3">
                {data.map((gen, idx) => (
                    <div key={gen.generation} className="flex items-center gap-2">
                        <div className={cn(
                            "w-3 h-3 rounded",
                            GENERATION_COLORS[Math.min(idx, GENERATION_COLORS.length - 1)]
                        )} />
                        <span className="text-xs text-muted-foreground">
                            Gen {gen.generation}: <span className="text-white font-medium">{gen.count}</span>
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
