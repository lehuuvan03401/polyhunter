'use client';

import { Badge } from '@/components/ui/badge';

type TimePeriod = '1D' | '7D' | '30D' | 'ALL';

interface TimePeriodSelectorProps {
    value: TimePeriod;
    onChange: (period: TimePeriod) => void;
}

export function TimePeriodSelector({ value, onChange }: TimePeriodSelectorProps) {
    const periods: TimePeriod[] = ['1D', '7D', '30D', 'ALL'];

    return (
        <div className="flex gap-2">
            {periods.map((period) => (
                <Badge
                    key={period}
                    variant={value === period ? 'success' : 'default'}
                    className="cursor-pointer px-3 py-1.5"
                    onClick={() => onChange(period)}
                >
                    {period}
                </Badge>
            ))}
        </div>
    );
}
