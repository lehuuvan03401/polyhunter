'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Eye, ShieldCheck, Clock, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ManagedNavChart } from './managed-nav-chart';
import { DisclosurePolicyPill } from './disclosure-policy-pill';
import { ManagedProduct, ManagedTerm } from './subscription-modal';
import { useTranslations } from 'next-intl';

export type SubscriptionStatus = 'PENDING' | 'RUNNING' | 'MATURED' | 'SETTLED' | 'CANCELLED';

export interface ManagedSubscriptionItemProps {
    subscription: {
        id: string;
        status: SubscriptionStatus;
        principal: number;
        createdAt: string;
        startAt?: string | null;
        endAt?: string | null;
        settledAt?: string | null;
        product: ManagedProduct;
        term: ManagedTerm;
        navSnapshots: Array<{
            snapshotAt: string;
            nav: number;
            equity: number;
            cumulativeReturn?: number | null;
        }>;
    };
    onViewDetails: (id: string) => void;
}

export function ManagedSubscriptionItem({ subscription, onViewDetails }: ManagedSubscriptionItemProps) {
    const t = useTranslations('ManagedWealth.SubscriptionItem');
    const tProducts = useTranslations('ManagedWealth.Products');
    const [expanded, setExpanded] = useState(false);

    const latest = subscription.navSnapshots?.[0];
    const currentEquity = latest?.equity ?? subscription.principal;
    const returnPct = latest?.cumulativeReturn ?? 0;
    const isPositive = returnPct >= 0;

    // Calculate progress based on dates
    const start = subscription.startAt ? new Date(subscription.startAt).getTime() : Date.now();
    const end = subscription.endAt ? new Date(subscription.endAt).getTime() : start + (subscription.term.durationDays * 86400000);
    const now = Date.now();
    const progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));

    return (
        <motion.div
            layout
            className="rounded-2xl border border-white/10 bg-[#121417] overflow-hidden hover:border-white/20 transition-colors"
        >
            <div className="p-4" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center justify-between gap-4 cursor-pointer">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${subscription.status === 'RUNNING' ? 'border-blue-500/20 bg-blue-500/10 text-blue-400' : 'border-white/5 bg-white/5 text-zinc-500'
                            }`}>
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <h4 className="font-bold text-white text-lg truncate">
                                    {/* @ts-ignore */}
                                    {tProducts(`${subscription.product.strategyProfile}.name`)}
                                </h4>
                                {subscription.product.isGuaranteed && (
                                    <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                                        <ShieldCheck className="h-3 w-3" />
                                        {t('guaranteed')}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-xs font-medium text-zinc-500 mt-1">
                                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${subscription.status === 'RUNNING' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-zinc-800 text-zinc-400 border border-white/5'}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${subscription.status === 'RUNNING' ? 'bg-blue-400 animate-pulse' : 'bg-zinc-500'}`} />
                                    {t(`status.${subscription.status}`)}
                                </span>
                                <span>{subscription.term.label} ({subscription.term.durationDays}d)</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="hidden sm:block text-right">
                            <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-0.5">{t('currentEquity')}</div>
                            <div className="font-mono text-lg font-bold text-white">${currentEquity.toFixed(2)}</div>
                        </div>
                        <div className="hidden sm:block text-right">
                            <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-0.5">{t('return')}</div>
                            <div className={`font-mono text-lg font-bold ${isPositive ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {isPositive ? '+' : ''}{(returnPct * 100).toFixed(2)}%
                            </div>
                        </div>
                        <div className={`rounded-full p-2 hover:bg-white/5 text-zinc-400 transition-all duration-300 ${expanded ? 'rotate-180 bg-white/5 text-white' : ''}`}>
                            <ChevronDown className="h-5 w-5" />
                        </div>
                    </div>
                </div>

                {/* Term Progress Bar */}
                {subscription.status === 'RUNNING' && (
                    <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/5">
                        <motion.div
                            className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, delay: 0.2 }}
                        />
                    </div>
                )}
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/5 bg-[#0A0B0E]/50"
                    >
                        <div className="p-4 grid gap-6 md:grid-cols-2">
                            {/* Chart Section */}
                            <div>
                                <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{t('performance')}</h5>
                                <ManagedNavChart
                                    data={[...(subscription.navSnapshots || [])].reverse()}
                                    height={180}
                                    color={isPositive ? '#10b981' : '#ef4444'}
                                />
                            </div>

                            {/* Details Section */}
                            <div className="space-y-4">
                                <div>
                                    <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{t('subscriptionDetails')}</h5>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="flex justify-between rounded-lg border border-white/5 bg-white/5 p-2">
                                            <span className="text-zinc-500">{t('principal')}</span>
                                            <span className="text-white">${subscription.principal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between rounded-lg border border-white/5 bg-white/5 p-2">
                                            <span className="text-zinc-500">{t('startDate')}</span>
                                            <span className="text-white">{subscription.startAt ? format(new Date(subscription.startAt), 'MMM d') : '--'}</span>
                                        </div>
                                        <div className="flex justify-between rounded-lg border border-white/5 bg-white/5 p-2">
                                            <span className="text-zinc-500">{t('endDate')}</span>
                                            <span className="text-white">{subscription.endAt ? format(new Date(subscription.endAt), 'MMM d') : '--'}</span>
                                        </div>
                                        <div className="flex justify-between rounded-lg border border-white/5 bg-white/5 p-2">
                                            <span className="text-zinc-500">{t('disclosure')}</span>
                                            <DisclosurePolicyPill policy={subscription.product.disclosurePolicy} delayHours={subscription.product.disclosureDelayHours} />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onViewDetails(subscription.id);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition"
                                >
                                    <Eye className="h-4 w-4" />
                                    {t('viewAnalysis')}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
