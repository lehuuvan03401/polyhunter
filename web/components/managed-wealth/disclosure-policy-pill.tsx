'use client';

import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

type DisclosurePolicy = 'TRANSPARENT' | 'DELAYED';

interface DisclosurePolicyPillProps {
    policy: DisclosurePolicy;
    delayHours?: number | null;
    className?: string;
}

export function DisclosurePolicyPill({ policy, delayHours = 0, className }: DisclosurePolicyPillProps) {
    const t = useTranslations('ManagedWealth.DisclosurePill');
    const hours = Number(delayHours ?? 0);
    if (policy === 'DELAYED') {
        return (
            <span
                className={cn(
                    'inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-[11px] font-medium text-yellow-300',
                    className
                )}
            >
                <EyeOff className="h-3 w-3" />
                {t('delayed')}{hours > 0 ? ` (${hours}h)` : ''}
            </span>
        );
    }

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300',
                className
            )}
        >
            <Eye className="h-3 w-3" />
            {t('realtime')}
        </span>
    );
}
