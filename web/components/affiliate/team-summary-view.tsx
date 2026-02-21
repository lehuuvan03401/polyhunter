'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';

interface TreeMember {
    address: string;
    referralCode?: string;
    tier: string;
    volume: number;
    teamSize: number;
    depth: number;
    zeroLineEarned?: number;
    sunLineEarned?: number;
    children: TreeMember[];
}

interface TeamSummaryViewProps {
    directReferrals: TreeMember[];
    className?: string;
}

import { useTranslations } from 'next-intl';

export function TeamSummaryView({ directReferrals, className }: TeamSummaryViewProps) {
    const t = useTranslations('Affiliate.teamView');
    const [page, setPage] = useState(1);
    const pageSize = 10;

    if (!directReferrals || directReferrals.length === 0) {
        return (
            <div className={cn("text-center py-12 rounded-xl border border-dashed border-white/10 bg-white/5", className)}>
                <div className="h-12 w-12 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-3 text-muted-foreground">
                    <Users className="h-6 w-6" />
                </div>
                <div className="font-medium text-white mb-1">{t('empty')}</div>
                <p className="text-sm text-muted-foreground">{t('share')}</p>
            </div>
        );
    }

    const totalPages = Math.ceil(directReferrals.length / pageSize);
    const paginatedMembers = directReferrals.slice((page - 1) * pageSize, page * pageSize);

    return (
        <div className={cn("space-y-2", className)}>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 px-1">
                {t('headers.directs')} ({directReferrals.length})
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-muted-foreground border-b border-white/5 uppercase text-xs">
                        <tr>
                            <th className="py-2 font-medium pl-2">{t('headers.member')}</th>
                            <th className="py-2 font-medium">{t('headers.rank')}</th>
                            <th className="py-2 font-medium text-right">{t('headers.volume')}</th>
                            <th className="py-2 font-medium text-right pr-2 text-yellow-500">{t('headers.team')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {paginatedMembers.map((ref, idx) => (
                            <tr key={ref.address || idx} className="hover:bg-white/5 transition-colors">
                                <td className="py-2.5 pl-2">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-mono text-muted-foreground">
                                            {ref.address?.slice(2, 4) || '??'}
                                        </div>
                                        <span className="font-mono text-white/80">
                                            {ref.referralCode || `${ref.address?.slice(0, 6)}...${ref.address?.slice(-4)}`}
                                        </span>
                                    </div>
                                </td>
                                <td className="py-2.5">
                                    <span className={cn("text-xs px-1.5 py-0.5 rounded border",
                                        ref.tier === 'ORDINARY' ? 'text-gray-400 border-gray-400/30' :
                                            ref.tier === 'VIP' ? 'text-blue-400 bg-blue-400/10 border-blue-400/30' :
                                                ref.tier === 'ELITE' ? 'text-purple-400 bg-purple-400/10 border-purple-400/30' :
                                                    'text-yellow-400 bg-yellow-400/10 border-yellow-400/30'
                                    )}>{ref.tier}</span>
                                </td>
                                <td className="py-2.5 text-right font-mono text-white/60">
                                    ${(ref.volume || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>
                                <td className="py-2.5 text-right pr-2 font-mono text-yellow-500/80">
                                    {ref.teamSize > 0 ? ref.teamSize : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-3 py-3 mt-2 border-t border-white/5">
                    <div className="text-xs text-muted-foreground">
                        {t('pagination.showing', { start: (page - 1) * pageSize + 1, end: Math.min(page * pageSize, directReferrals.length), total: directReferrals.length })}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-2 py-1 text-xs font-medium rounded hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-muted-foreground transition-colors"
                        >
                            {t('pagination.previous')}
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={cn(
                                        "w-6 h-6 flex items-center justify-center text-xs font-medium rounded transition-colors",
                                        page === p ? "bg-white/10 text-white" : "text-muted-foreground hover:bg-white/5"
                                    )}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-2 py-1 text-xs font-medium rounded hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-muted-foreground transition-colors"
                        >
                            {t('pagination.next')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
