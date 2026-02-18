'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Eye, ShieldCheck, Clock, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ManagedNavChart } from './managed-nav-chart';
import { DisclosurePolicyPill } from './disclosure-policy-pill';
import { ManagedProduct, ManagedTerm } from './subscription-modal';
import { useTranslations } from 'next-intl';
import { useManagedWalletAuth } from '@/lib/managed-wealth/wallet-auth-client';

export type SubscriptionStatus = 'PENDING' | 'RUNNING' | 'MATURED' | 'SETTLED' | 'CANCELLED';

export interface ManagedSubscriptionItemProps {
    walletAddress?: string;
    withdrawGuardrails?: {
        cooldownHours: number;
        earlyWithdrawalFeeRate: number;
        drawdownAlertThreshold: number;
    };
    subscription: {
        id: string;
        status: SubscriptionStatus;
        principal: number;
        isTrial?: boolean;
        trialEndsAt?: string | null;
        createdAt: string;
        startAt?: string | null;
        endAt?: string | null;
        settledAt?: string | null;
        product: ManagedProduct;
        term: ManagedTerm;
        settlement?: {
            principal?: number;
            finalEquity?: number;
            grossPnl?: number;
            performanceFeeRate?: number;
            performanceFee?: number;
            finalPayout: number;
            guaranteedPayout?: number | null;
            reserveTopup?: number;
            settledAt: string;
        } | null;
        navSnapshots: Array<{
            snapshotAt: string;
            nav: number;
            equity: number;
            cumulativeReturn?: number | null;
        }>;
    };
    onViewDetails: (id: string) => void;
}

export function ManagedSubscriptionItem({
    walletAddress,
    subscription,
    withdrawGuardrails,
    onViewDetails,
}: ManagedSubscriptionItemProps) {
    const t = useTranslations('ManagedWealth.SubscriptionItem');
    const tProducts = useTranslations('ManagedWealth.Products');
    const { createWalletAuthHeaders } = useManagedWalletAuth();
    const [expanded, setExpanded] = useState(false);

    const latest = subscription.navSnapshots?.[0];
    // If settled, use finalPayout, otherwise use current equity from snapshot or principal
    const currentEquity = subscription.status === 'SETTLED' && subscription.settlement?.finalPayout
        ? subscription.settlement.finalPayout
        : (latest?.equity ?? subscription.principal);

    const initialPrincipal = subscription.principal;
    const returnPct = initialPrincipal > 0
        ? ((currentEquity - initialPrincipal) / initialPrincipal)
        : 0;

    const isPositive = returnPct >= 0;

    // Calculate progress based on dates
    const start = subscription.startAt ? new Date(subscription.startAt).getTime() : Date.now();
    const end = subscription.endAt ? new Date(subscription.endAt).getTime() : start + (subscription.term.durationDays * 86400000);
    const now = Date.now();
    const trialEndTs = subscription.trialEndsAt ? new Date(subscription.trialEndsAt).getTime() : null;
    const trialActive = Boolean(subscription.isTrial && subscription.status === 'RUNNING' && trialEndTs && now <= trialEndTs);
    const earlyWithdrawalPolicyApplies = Boolean(
        subscription.status === 'RUNNING'
        && subscription.endAt
        && new Date(subscription.endAt).getTime() > now
        && withdrawGuardrails
    );
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
                            {subscription.status === 'SETTLED' ? <ShieldCheck className="h-6 w-6 text-emerald-500" /> : <TrendingUp className="h-6 w-6" />}
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
                                {trialActive && (
                                    <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/20 uppercase tracking-wide">
                                        <Clock className="h-3 w-3" />
                                        {t('trial')}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-xs font-medium text-zinc-500 mt-1">
                                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${subscription.status === 'RUNNING'
                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                    : subscription.status === 'SETTLED'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-zinc-800 text-zinc-400 border border-white/5'
                                    }`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${subscription.status === 'RUNNING' ? 'bg-blue-400 animate-pulse'
                                        : subscription.status === 'SETTLED' ? 'bg-emerald-400'
                                            : 'bg-zinc-500'
                                        }`} />
                                    {t(`status.${subscription.status}`)}
                                </span>
                                <span>{subscription.term.label} ({subscription.term.durationDays}d)</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="hidden sm:block text-right">
                            <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-0.5">
                                {subscription.status === 'SETTLED' ? t('finalPayout') : t('currentEquity')}
                            </div>
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
                                        {subscription.status === 'SETTLED' ? (
                                            <div className="flex justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
                                                <span className="text-emerald-500">{t('settledDate')}</span>
                                                <span className="text-emerald-400 font-medium">
                                                    {subscription.settlement?.settledAt ? format(new Date(subscription.settlement.settledAt), 'MMM d') : '--'}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between rounded-lg border border-white/5 bg-white/5 p-2">
                                                <span className="text-zinc-500">{t('endDate')}</span>
                                                <span className="text-white">{subscription.endAt ? format(new Date(subscription.endAt), 'MMM d') : '--'}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between rounded-lg border border-white/5 bg-white/5 p-2">
                                            <span className="text-zinc-500">{t('disclosure')}</span>
                                            <DisclosurePolicyPill policy={subscription.product.disclosurePolicy} delayHours={subscription.product.disclosureDelayHours} />
                                        </div>
                                        {trialActive && (
                                            <div className="flex justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                                                <span className="text-amber-300">{t('trialEnds')}</span>
                                                <span className="text-amber-200 font-medium">
                                                    {subscription.trialEndsAt ? format(new Date(subscription.trialEndsAt), 'MMM d, HH:mm') : '--'}
                                                </span>
                                            </div>
                                        )}
                                        {earlyWithdrawalPolicyApplies && (
                                            <div className="col-span-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-xs">
                                                <div className="text-amber-300">{t('withdrawPolicyLabel')}</div>
                                                <div className="mt-1 text-amber-100">
                                                    {t('withdrawPolicyValue', {
                                                        cooldownHours: withdrawGuardrails?.cooldownHours ?? 0,
                                                        feeRate: `${(((withdrawGuardrails?.earlyWithdrawalFeeRate ?? 0) * 100)).toFixed(2)}%`,
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {subscription.status === 'SETTLED' && subscription.settlement && (
                                            <div className="col-span-2 rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
                                                <div className="text-zinc-400">{t('feeBreakdown')}</div>
                                                <div className="mt-1 flex flex-wrap items-center gap-3 text-zinc-200">
                                                    <span>
                                                        {t('performanceFeeLabel')}: ${Number(subscription.settlement.performanceFee ?? 0).toFixed(2)}
                                                    </span>
                                                    <span>
                                                        {t('grossPnlLabel')}: {Number(subscription.settlement.grossPnl ?? 0) >= 0 ? '+' : ''}${Number(subscription.settlement.grossPnl ?? 0).toFixed(2)}
                                                    </span>
                                                    <span>
                                                        {t('netPnlLabel')}: {Number((subscription.settlement.finalPayout ?? 0) - subscription.principal) >= 0 ? '+' : ''}${Number((subscription.settlement.finalPayout ?? 0) - subscription.principal).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onViewDetails(subscription.id);
                                        }}
                                        className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition"
                                    >
                                        <Eye className="h-4 w-4" />
                                        {t('viewAnalysis')}
                                    </button>
                                    {(subscription.status === 'RUNNING' || subscription.status === 'MATURED') && (
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (!walletAddress) {
                                                    alert(t('withdrawFailed'));
                                                    return;
                                                }
                                                if (!confirm(t('confirmWithdraw'))) return;

                                                try {
                                                    const path = `/api/managed-subscriptions/${subscription.id}/withdraw`;
                                                    const executeWithdraw = async (acknowledgeEarlyWithdrawalFee: boolean): Promise<boolean> => {
                                                        const walletHeaders = await createWalletAuthHeaders({
                                                            walletAddress,
                                                            method: 'POST',
                                                            pathWithQuery: path,
                                                        });
                                                        const res = await fetch(path, {
                                                            method: 'POST',
                                                            headers: {
                                                                'Content-Type': 'application/json',
                                                                ...walletHeaders,
                                                            },
                                                            body: JSON.stringify({
                                                                confirm: true,
                                                                walletAddress,
                                                                acknowledgeEarlyWithdrawalFee,
                                                            }),
                                                        });
                                                        const data = await res.json().catch(() => ({})) as Record<string, unknown>;

                                                        if (!res.ok) {
                                                            if (data?.code === 'WITHDRAW_COOLDOWN_ACTIVE') {
                                                                const cooldownEndsAt = data?.cooldownEndsAt
                                                                    ? new Date(String(data.cooldownEndsAt)).toLocaleString()
                                                                    : '--';
                                                                alert(t('withdrawCooldown', { time: cooldownEndsAt }));
                                                                return false;
                                                            }

                                                            if (
                                                                data?.code === 'EARLY_WITHDRAWAL_FEE_ACK_REQUIRED'
                                                                && !acknowledgeEarlyWithdrawalFee
                                                            ) {
                                                                const feeRate = typeof data.earlyWithdrawalFeeRate === 'number'
                                                                    ? `${(data.earlyWithdrawalFeeRate * 100).toFixed(2)}%`
                                                                    : '--';
                                                                const feeAmount = typeof data.earlyWithdrawalFee === 'number'
                                                                    ? `$${data.earlyWithdrawalFee.toFixed(2)}`
                                                                    : '--';
                                                                const payout = typeof data.estimatedPayoutAfterFee === 'number'
                                                                    ? `$${data.estimatedPayoutAfterFee.toFixed(2)}`
                                                                    : '--';
                                                                const accepted = confirm(
                                                                    t('confirmEarlyWithdrawFee', {
                                                                        rate: feeRate,
                                                                        fee: feeAmount,
                                                                        payout,
                                                                    })
                                                                );
                                                                if (!accepted) return false;
                                                                return executeWithdraw(true);
                                                            }

                                                            throw new Error(typeof data?.error === 'string' ? data.error : 'Withdrawal failed');
                                                        }

                                                        return true;
                                                    };

                                                    const completed = await executeWithdraw(false);
                                                    if (!completed) return;

                                                    // Refresh page to show updated status
                                                    window.location.reload();
                                                } catch (error) {
                                                    console.error(error);
                                                    alert(t('withdrawFailed'));
                                                }
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/20 transition"
                                        >
                                            <ShieldCheck className="h-4 w-4" />
                                            {t('withdraw')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
