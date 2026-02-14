'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/i18n/routing';
import { usePrivyLogin } from '@/lib/privy-login';
import { ArrowLeft, Loader2, Lock, TrendingUp, Wallet, PieChart, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ManagedSubscriptionItem, ManagedSubscriptionItemProps } from '@/components/managed-wealth/managed-subscription-item';
import { ManagedStatsGrid, StatItem } from '@/components/managed-wealth/managed-stats-grid';
import { AnimatePresence, motion } from 'framer-motion';

export default function MyManagedWealthPage() {
    const { authenticated, ready, login, user, isLoggingIn } = usePrivyLogin();

    const [loading, setLoading] = useState(true);
    const [subscriptions, setSubscriptions] = useState<ManagedSubscriptionItemProps['subscription'][]>([]);
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'RUNNING' | 'MATURED' | 'SETTLED'>('ALL');

    useEffect(() => {
        const fetchSubscriptions = async () => {
            if (!authenticated || !user?.wallet?.address) {
                setSubscriptions([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const params = new URLSearchParams({ wallet: user.wallet.address });
                if (statusFilter !== 'ALL') params.set('status', statusFilter);

                const res = await fetch(`/api/managed-subscriptions?${params.toString()}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || 'Failed to fetch subscriptions');
                setSubscriptions(data.subscriptions || []);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Failed to fetch subscriptions');
            } finally {
                setLoading(false);
            }
        };

        fetchSubscriptions();
    }, [authenticated, user?.wallet?.address, statusFilter]);

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
                label: 'Active Capital',
                value: `$${totalPrincipal.toFixed(2)}`,
                subValue: `${activeCount} active positions`,
                color: 'blue',
                icon: Wallet
            },
            {
                label: 'Current Equity',
                value: `$${totalEquity.toFixed(2)}`,
                subValue: 'Estimated total value',
                color: 'purple',
                icon: PieChart
            },
            {
                label: 'Total PnL',
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
                    <h1 className="text-3xl font-bold text-white">My Managed Positions</h1>
                    <p className="mt-4 text-zinc-400">Connect your wallet to view your active strategies, track performance in real-time, and manage your settlements.</p>
                    <button
                        onClick={login}
                        disabled={isLoggingIn}
                        className="mt-8 rounded-xl bg-blue-600 px-8 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 hover:shadow-blue-500/40 disabled:opacity-60"
                    >
                        {isLoggingIn ? 'Connecting...' : 'Connect Wallet'}
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
                    Back to Marketplace
                </Link>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-bold text-white tracking-tight">My Dashboard</h1>
                        <p className="mt-2 text-lg text-zinc-400">Track and manage your automated wealth strategies.</p>
                    </div>
                    <Link
                        href="/managed-wealth"
                        className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Plus className="h-4 w-4" />
                        Browse New Strategies
                    </Link>
                </div>
            </div>

            <ManagedStatsGrid stats={stats} />

            <div className="mt-12 relative z-10">
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
                            {status === 'ALL' ? 'All Positions' : status}
                        </button>
                    ))}
                </div>

                <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                        {subscriptions.map((sub) => (
                            <ManagedSubscriptionItem
                                key={sub.id}
                                subscription={sub}
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
                            <h3 className="text-lg font-medium text-white">No positions found</h3>
                            <p className="mt-1 text-sm text-zinc-500">You don't have any subscriptions matching this filter.</p>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
