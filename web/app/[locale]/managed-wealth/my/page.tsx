'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/i18n/routing';
import { usePrivyLogin } from '@/lib/privy-login';
import { ArrowLeft, Loader2, Lock, TrendingUp, Wallet, PieChart, Plus, Receipt, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { ManagedSubscriptionItem, ManagedSubscriptionItemProps } from '@/components/managed-wealth/managed-subscription-item';
import { ManagedStatsGrid, StatItem } from '@/components/managed-wealth/managed-stats-grid';
import { ManagedTransactionHistory } from '@/components/managed-wealth/managed-transaction-history';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useManagedWalletAuth } from '@/lib/managed-wealth/wallet-auth-client';

export default function MyManagedWealthPage() {
    const t = useTranslations('ManagedWealth.Dashboard');
    const { authenticated, ready, login, user, isLoggingIn } = usePrivyLogin();
    const { createWalletAuthHeaders } = useManagedWalletAuth();

    const [loading, setLoading] = useState(true);
    const [subscriptions, setSubscriptions] = useState<ManagedSubscriptionItemProps['subscription'][]>([]);
    const [withdrawGuardrails, setWithdrawGuardrails] = useState<{
        cooldownHours: number;
        earlyWithdrawalFeeRate: number;
        drawdownAlertThreshold: number;
    } | null>(null);
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'RUNNING' | 'MATURED' | 'SETTLED'>('ALL');
    const [activeTab, setActiveTab] = useState<'positions' | 'history'>('positions');
    const [membershipLoading, setMembershipLoading] = useState(false);
    const [membershipPaymentToken, setMembershipPaymentToken] = useState<'USDC' | 'MCN'>('USDC');
    const [membershipPlans, setMembershipPlans] = useState<Array<{
        planType: 'MONTHLY' | 'QUARTERLY';
        label: string;
        durationDays: number;
        basePriceUsd: number;
        prices: {
            USDC: number;
            MCN: number;
        };
        mcnDiscountRate: number;
    }>>([]);
    const [activeMembership, setActiveMembership] = useState<{
        id: string;
        planType: 'MONTHLY' | 'QUARTERLY';
        paymentToken: 'USDC' | 'MCN';
        finalPriceUsd: number;
        startsAt: string;
        endsAt: string;
        status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
    } | null>(null);
    const [activeMembershipAlert, setActiveMembershipAlert] = useState<{
        isExpiringSoon: boolean;
        remainingHours: number;
        remainingDays: number;
    } | null>(null);
    const planTypeLabel = (planType: 'MONTHLY' | 'QUARTERLY') =>
        planType === 'MONTHLY' ? t('membership.monthly') : t('membership.quarterly');

    useEffect(() => {
        const fetchSubscriptions = async () => {
            if (!authenticated || !user?.wallet?.address) {
                setSubscriptions([]);
                setWithdrawGuardrails(null);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const params = new URLSearchParams({ wallet: user.wallet.address });
                if (statusFilter !== 'ALL') params.set('status', statusFilter);
                const query = params.toString();
                const path = `/api/managed-subscriptions?${query}`;
                const walletHeaders = await createWalletAuthHeaders({
                    walletAddress: user.wallet.address,
                    method: 'GET',
                    pathWithQuery: path,
                });

                const res = await fetch(path, {
                    headers: walletHeaders,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || t('errors.fetchFailed'));
                setSubscriptions(data.subscriptions || []);
                setWithdrawGuardrails(data.withdrawGuardrails || null);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : t('errors.fetchFailed'));
            } finally {
                setLoading(false);
            }
        };

        fetchSubscriptions();
    }, [authenticated, user?.wallet?.address, statusFilter, createWalletAuthHeaders, t]);

    useEffect(() => {
        const fetchMembership = async () => {
            if (!authenticated || !user?.wallet?.address) {
                setActiveMembership(null);
                setActiveMembershipAlert(null);
                setMembershipPlans([]);
                return;
            }

            setMembershipLoading(true);
            try {
                const plansRes = await fetch('/api/managed-membership/plans');
                const plansData = await plansRes.json();
                if (!plansRes.ok) throw new Error(plansData?.error || t('errors.fetchFailed'));
                setMembershipPlans(plansData.plans || []);

                const query = new URLSearchParams({ wallet: user.wallet.address }).toString();
                const path = `/api/managed-membership?${query}`;
                const walletHeaders = await createWalletAuthHeaders({
                    walletAddress: user.wallet.address,
                    method: 'GET',
                    pathWithQuery: path,
                });
                const membershipRes = await fetch(path, { headers: walletHeaders });
                const membershipData = await membershipRes.json();
                if (!membershipRes.ok) throw new Error(membershipData?.error || t('errors.fetchFailed'));
                setActiveMembership(membershipData.activeMembership || null);
                setActiveMembershipAlert(membershipData.activeMembershipAlert || null);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : t('errors.fetchFailed'));
            } finally {
                setMembershipLoading(false);
            }
        };

        fetchMembership();
    }, [authenticated, user?.wallet?.address, createWalletAuthHeaders, t]);

    const createMembership = async (planType: 'MONTHLY' | 'QUARTERLY') => {
        if (!user?.wallet?.address) {
            toast.error(t('errors.fetchFailed'));
            return;
        }
        setMembershipLoading(true);
        try {
            const path = '/api/managed-membership';
            const walletHeaders = await createWalletAuthHeaders({
                walletAddress: user.wallet.address,
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
                    walletAddress: user.wallet.address,
                    planType,
                    paymentToken: membershipPaymentToken,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || t('errors.fetchFailed'));

            setActiveMembership(data.membership || null);
            toast.success(t('membership.purchaseSuccess'));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('errors.fetchFailed'));
        } finally {
            setMembershipLoading(false);
        }
    };

    const stats = useMemo<StatItem[]>(() => {
        const totalPrincipal = subscriptions.reduce((acc, sub) => acc + sub.principal, 0);

        const totalEquity = subscriptions.reduce((acc, sub) => {
            const latest = sub.navSnapshots?.[0];
            return acc + (latest?.equity ?? sub.principal);
        }, 0);

        const activeCount = subscriptions.filter(s => s.status === 'RUNNING').length;
        const totalPnl = totalEquity - totalPrincipal;
        const pnlPct = totalPrincipal > 0 ? (totalPnl / totalPrincipal) * 100 : 0;
        const isPositive = pnlPct >= 0;

        return [
            {
                label: t('stats.activeCapital'),
                value: `$${totalPrincipal.toFixed(2)}`,
                subValue: t('stats.activePositions', { count: activeCount }),
                color: 'blue',
                icon: Wallet
            },
            {
                label: t('stats.currentEquity'),
                value: `$${totalEquity.toFixed(2)}`,
                subValue: t('stats.estimatedValue'),
                color: 'purple',
                icon: PieChart
            },
            {
                label: t('stats.totalPnl'),
                value: `${isPositive ? '+' : ''}${pnlPct.toFixed(2)}%`,
                subValue: `$${totalPnl.toFixed(2)}`,
                color: isPositive ? 'emerald' : 'amber', // Using amber for negative instead of red for softer look or add red support
                icon: TrendingUp
            }
        ];
    }, [subscriptions]);

    if (!ready || loading) {
        return (
            <div className="container py-20 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div className="container py-20 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
                <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#0A0B0E]/80 backdrop-blur-xl p-12 text-center shadow-2xl">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                        <Lock className="h-8 w-8 text-blue-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">{t('unauth.title')}</h1>
                    <p className="mt-4 text-zinc-400">{t('unauth.desc')}</p>
                    <button
                        onClick={login}
                        disabled={isLoggingIn}
                        className="mt-8 rounded-xl bg-blue-600 px-8 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 hover:shadow-blue-500/40 disabled:opacity-60"
                    >
                        {isLoggingIn ? t('unauth.connecting') : t('unauth.connect')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-10 min-h-screen relative">
            <div className="absolute top-0 right-0 -z-10 h-[500px] w-[500px] bg-emerald-500/5 blur-[100px] rounded-full" />

            <div className="mb-10">
                <Link href="/managed-wealth" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors mb-6 group">
                    <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                    {t('backToMarketplace')}
                </Link>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-bold text-white tracking-tight">{t('title')}</h1>
                        <p className="mt-2 text-lg text-zinc-400">{t('subtitle')}</p>
                    </div>
                    <Link
                        href="/managed-wealth"
                        className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Plus className="h-4 w-4" />
                        {t('browseTypes')}
                    </Link>
                </div>
            </div>

            <ManagedStatsGrid stats={stats} />

            <div className="mt-12 relative z-10">
                <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-white font-semibold">
                                <Sparkles className="h-4 w-4 text-amber-400" />
                                {t('membership.title')}
                            </div>
                            <p className="text-xs text-zinc-400 mt-1">{t('membership.desc')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setMembershipPaymentToken('USDC')}
                                className={`rounded-full px-3 py-1 text-xs border transition ${membershipPaymentToken === 'USDC'
                                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                                    : 'border-white/10 text-zinc-400 hover:text-white'
                                    }`}
                            >
                                USDC
                            </button>
                            <button
                                type="button"
                                onClick={() => setMembershipPaymentToken('MCN')}
                                className={`rounded-full px-3 py-1 text-xs border transition ${membershipPaymentToken === 'MCN'
                                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                                    : 'border-white/10 text-zinc-400 hover:text-white'
                                    }`}
                            >
                                MCN
                            </button>
                        </div>
                    </div>

                    <div className="mt-3 text-xs text-zinc-400">
                        {activeMembership ? (
                            <div className="flex flex-col gap-2">
                                <span>
                                    {t('membership.activeUntil')} {new Date(activeMembership.endsAt).toLocaleString()}
                                </span>
                                <span>
                                    {t('membership.activePlan')}: {planTypeLabel(activeMembership.planType)}
                                </span>
                                {activeMembershipAlert?.isExpiringSoon && (
                                    <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
                                        <AlertTriangle className="h-3 w-3" />
                                        {t('membership.expiringSoon', { days: activeMembershipAlert.remainingDays })}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span>{t('membership.noActive')}</span>
                        )}
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {membershipPlans.map((plan) => (
                            <button
                                key={plan.planType}
                                type="button"
                                disabled={membershipLoading || Boolean(activeMembership)}
                                onClick={() => createMembership(plan.planType)}
                                className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left hover:border-white/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <div className="text-sm font-semibold text-white">{planTypeLabel(plan.planType)}</div>
                                <div className="text-xs text-zinc-400 mt-1">{plan.durationDays}d</div>
                                <div className="text-sm text-emerald-300 mt-2">
                                    ${membershipPaymentToken === 'MCN' ? plan.prices.MCN : plan.prices.USDC}
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="mt-4">
                        <Link
                            href="/managed-wealth/membership"
                            className="text-xs text-blue-300 hover:text-blue-200 transition-colors"
                        >
                            {t('membership.viewHistory')}
                        </Link>
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="flex items-center gap-1 mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-1 w-fit">
                    {(['positions', 'history'] as const).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`relative flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${activeTab === tab
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                        >
                            {tab === 'positions' ? <Wallet className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                            {t(`tabs.${tab}`)}
                        </button>
                    ))}
                </div>

                {activeTab === 'positions' ? (
                    <>
                        {/* Status Filters */}
                        <div className="flex flex-wrap items-center gap-2 mb-6">
                            {(['ALL', 'RUNNING', 'MATURED', 'SETTLED'] as const).map((status) => (
                                <button
                                    key={status}
                                    type="button"
                                    onClick={() => setStatusFilter(status)}
                                    className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${statusFilter === status
                                        ? 'border-blue-500 bg-blue-500/10 text-blue-400 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]'
                                        : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white'
                                        }`}
                                >
                                    {/* @ts-ignore */}
                                    {status === 'ALL' ? t('filters.all') : t(`filters.${status.toLowerCase()}`)}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-4">
                            <AnimatePresence mode="popLayout">
                                {subscriptions.map((sub) => (
                                    <ManagedSubscriptionItem
                                        key={sub.id}
                                        subscription={sub}
                                        walletAddress={user?.wallet?.address}
                                        withdrawGuardrails={withdrawGuardrails ?? undefined}
                                        onViewDetails={(id) => console.log('View details', id)}
                                    />
                                ))}
                            </AnimatePresence>

                            {subscriptions.length === 0 && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center"
                                >
                                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                                        <Wallet className="h-6 w-6 text-zinc-600" />
                                    </div>
                                    <h3 className="text-lg font-medium text-white">{t('empty.title')}</h3>
                                    <p className="mt-1 text-sm text-zinc-500">{t('empty.desc')}</p>
                                </motion.div>
                            )}
                        </div>
                    </>
                ) : (
                    <ManagedTransactionHistory walletAddress={user?.wallet?.address || ''} />
                )}
            </div>
        </div>
    );
}
