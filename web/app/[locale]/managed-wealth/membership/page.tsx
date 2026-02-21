'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/i18n/routing';
import { usePrivyLogin } from '@/lib/privy-login';
import { useManagedWalletAuth } from '@/lib/managed-wealth/wallet-auth-client';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2, Lock, CalendarClock, BadgeDollarSign } from 'lucide-react';
import { toast } from 'sonner';

type MembershipStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

type MembershipRow = {
    id: string;
    planType: 'MONTHLY' | 'QUARTERLY';
    status: MembershipStatus;
    paymentToken: 'USDC' | 'MCN';
    basePriceUsd: number;
    discountRate: number;
    finalPriceUsd: number;
    startsAt: string;
    endsAt: string;
    createdAt: string;
};

export default function ManagedMembershipHistoryPage() {
    const t = useTranslations('ManagedWealth.MembershipHistory');
    const tDashboard = useTranslations('ManagedWealth.Dashboard');
    const { authenticated, ready, login, user, isLoggingIn } = usePrivyLogin();
    const { createWalletAuthHeaders } = useManagedWalletAuth();

    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'ALL' | MembershipStatus>('ALL');
    const [memberships, setMemberships] = useState<MembershipRow[]>([]);

    const planTypeLabel = (planType: 'MONTHLY' | 'QUARTERLY') =>
        planType === 'MONTHLY' ? tDashboard('membership.monthly') : tDashboard('membership.quarterly');

    useEffect(() => {
        const fetchHistory = async () => {
            if (!authenticated || !user?.wallet?.address) {
                setMemberships([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const params = new URLSearchParams({ wallet: user.wallet.address, limit: '100' });
                if (statusFilter !== 'ALL') params.set('status', statusFilter);
                const query = params.toString();
                const path = `/api/managed-membership?${query}`;
                const headers = await createWalletAuthHeaders({
                    walletAddress: user.wallet.address,
                    method: 'GET',
                    pathWithQuery: path,
                });
                const res = await fetch(path, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || t('errors.fetchFailed'));
                setMemberships(data.memberships || []);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : t('errors.fetchFailed'));
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [authenticated, user?.wallet?.address, statusFilter, createWalletAuthHeaders, t]);

    const statusClass = useMemo<Record<MembershipStatus, string>>(() => ({
        ACTIVE: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
        EXPIRED: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
        CANCELLED: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    }), []);

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
                <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#0A0B0E]/80 backdrop-blur-xl p-12 text-center shadow-2xl">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10">
                        <Lock className="h-8 w-8 text-blue-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">{t('unauth.title')}</h1>
                    <p className="mt-4 text-zinc-400">{t('unauth.desc')}</p>
                    <button
                        onClick={login}
                        disabled={isLoggingIn}
                        className="mt-8 rounded-xl bg-blue-600 px-8 py-3 font-semibold text-white transition-all hover:bg-blue-500 disabled:opacity-60"
                    >
                        {isLoggingIn ? t('unauth.connecting') : t('unauth.connect')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-10 min-h-screen">
            <div className="mb-8">
                <Link href="/managed-wealth/my" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    {t('backToDashboard')}
                </Link>
            </div>

            <div className="mb-6">
                <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
                <p className="mt-2 text-zinc-400">{t('subtitle')}</p>
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
                {(['ALL', 'ACTIVE', 'EXPIRED', 'CANCELLED'] as const).map((status) => (
                    <button
                        key={status}
                        type="button"
                        onClick={() => setStatusFilter(status)}
                        className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${statusFilter === status
                            ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                            : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'
                            }`}
                    >
                        {status === 'ALL' ? t('filters.ALL') : t(`filters.${status}`)}
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                {memberships.map((membership) => (
                    <div key={membership.id} className="rounded-xl border border-white/10 bg-[#121417] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="text-white font-semibold">{planTypeLabel(membership.planType)}</div>
                                <div className="text-xs text-zinc-500 mt-1">{membership.id}</div>
                            </div>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass[membership.status]}`}>
                                {t(`status.${membership.status}`)}
                            </span>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
                            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                                <div className="text-xs text-zinc-500">{t('payment')}</div>
                                <div className="mt-1 text-white flex items-center gap-1">
                                    <BadgeDollarSign className="h-4 w-4 text-emerald-400" />
                                    {membership.paymentToken} ${membership.finalPriceUsd.toFixed(2)}
                                </div>
                            </div>
                            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                                <div className="text-xs text-zinc-500">{t('startsAt')}</div>
                                <div className="mt-1 text-zinc-200">{new Date(membership.startsAt).toLocaleString()}</div>
                            </div>
                            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                                <div className="text-xs text-zinc-500">{t('endsAt')}</div>
                                <div className="mt-1 text-zinc-200 flex items-center gap-1">
                                    <CalendarClock className="h-4 w-4 text-blue-400" />
                                    {new Date(membership.endsAt).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {memberships.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-sm text-zinc-500">
                        {t('empty')}
                    </div>
                )}
            </div>
        </div>
    );
}
