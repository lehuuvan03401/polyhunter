'use client';

import { cn } from '@/lib/utils';

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
    'bg-blue-500',      // Gen 1
    'bg-purple-500',    // Gen 2
    'bg-pink-500',      // Gen 3
    'bg-orange-500',    // Gen 4
    'bg-yellow-500',    // Gen 5+
];

export function GenerationSummaryBar({ data, total, className }: GenerationSummaryBarProps) {
    if (data.length === 0) {
        return (
            <div className={cn("p-4 rounded-xl border border-white/10 bg-white/5", className)}>
                <p className="text-sm text-muted-foreground text-center">No team members yet</p>
            </div>
        );
    }

    return (
        <div className={cn("p-4 rounded-xl border border-white/10 bg-white/5", className)}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-muted-foreground">Generation Breakdown</h4>
                <span className="text-sm text-white font-mono">{total} total</span>
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
