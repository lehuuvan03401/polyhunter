'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/i18n/routing';
import { usePrivyLogin } from '@/lib/privy-login';
import { Eye, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { DisclosurePolicyPill } from '@/components/managed-wealth/disclosure-policy-pill';

type ManagedSubscriptionItem = {
    id: string;
    status: 'PENDING' | 'RUNNING' | 'MATURED' | 'SETTLED' | 'CANCELLED';
    principal: number;
    createdAt: string;
    startAt?: string | null;
    endAt?: string | null;
    settledAt?: string | null;
    product: {
        id: string;
        slug: string;
        name: string;
        strategyProfile: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
        isGuaranteed: boolean;
        disclosurePolicy: 'TRANSPARENT' | 'DELAYED';
        disclosureDelayHours: number;
    };
    term: {
        id: string;
        label: string;
        durationDays: number;
        targetReturnMin: number;
        targetReturnMax: number;
        maxDrawdown: number;
    };
    navSnapshots: Array<{
        snapshotAt: string;
        nav: number;
        equity: number;
        cumulativeReturn?: number | null;
        drawdown?: number | null;
    }>;
    settlement?: {
        id: string;
        status: string;
        finalPayout?: number | null;
        reserveTopup?: number | null;
        settledAt?: string | null;
    } | null;
};

type NavDetail = {
    summary: {
        latestNav: number;
        latestEquity: number;
        cumulativeReturn: number;
        maxDrawdown: number;
        peakNav: number;
        points: number;
    };
    snapshots: Array<{
        snapshotAt: string;
        nav: number;
        equity: number;
        cumulativeReturn?: number | null;
        drawdown?: number | null;
    }>;
};

export default function MyManagedWealthPage() {
    const { authenticated, ready, login, user, isLoggingIn } = usePrivyLogin();

    const [loading, setLoading] = useState(true);
    const [subscriptions, setSubscriptions] = useState<ManagedSubscriptionItem[]>([]);
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'RUNNING' | 'MATURED' | 'SETTLED'>('ALL');
    const [activeSubscriptionId, setActiveSubscriptionId] = useState<string | null>(null);
    const [navDetail, setNavDetail] = useState<NavDetail | null>(null);
    const [navLoading, setNavLoading] = useState(false);

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

    useEffect(() => {
        const fetchNav = async () => {
            if (!activeSubscriptionId || !user?.wallet?.address) {
                setNavDetail(null);
                return;
            }

            setNavLoading(true);
            try {
                const res = await fetch(`/api/managed-subscriptions/${activeSubscriptionId}/nav?wallet=${user.wallet.address}&limit=100`);
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || 'Failed to fetch NAV');
                setNavDetail({ summary: data.summary, snapshots: data.snapshots });
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Failed to fetch NAV');
            } finally {
                setNavLoading(false);
            }
        };

        fetchNav();
    }, [activeSubscriptionId, user?.wallet?.address]);

    const totals = useMemo(() => {
        return subscriptions.reduce(
            (acc, sub) => {
                const latest = sub.navSnapshots?.[0];
                const equity = latest?.equity ?? sub.principal;
                acc.principal += sub.principal;
                acc.equity += equity;
                return acc;
            },
            { principal: 0, equity: 0 }
        );
    }, [subscriptions]);

    if (!ready || loading) {
        return (
            <div className="container py-10">
                <div className="flex items-center justify-center">
                    <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div className="container py-10">
                <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-card/50 p-10 text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10">
                        <Lock className="h-10 w-10 text-blue-400" />
                    </div>
                    <h1 className="text-3xl font-bold">My Managed Positions</h1>
                    <p className="mt-3 text-muted-foreground">Connect your wallet to view subscriptions, NAV and settlement records.</p>
                    <button
                        onClick={login}
                        disabled={isLoggingIn}
                        className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                    >
                        {isLoggingIn ? 'Connecting...' : 'Connect wallet'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-10">
            <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">My Managed Positions</h1>
                    <p className="mt-2 text-muted-foreground">Track lifecycle, NAV, disclosure policy and settlement results.</p>
                </div>
                <Link href="/managed-wealth" className="rounded-lg border border-white/10 px-3 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-white">
                    Explore products
                </Link>
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <Stat label="Subscriptions" value={`${subscriptions.length}`} />
                <Stat label="Principal" value={`$${totals.principal.toFixed(2)}`} />
                <Stat label="Current Equity" value={`$${totals.equity.toFixed(2)}`} />
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
                {(['ALL', 'RUNNING', 'MATURED', 'SETTLED'] as const).map((status) => (
                    <button
                        key={status}
                        type="button"
                        onClick={() => setStatusFilter(status)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusFilter === status
                                ? 'border-blue-500/60 bg-blue-500/20 text-blue-200'
                                : 'border-white/10 bg-white/5 text-muted-foreground hover:text-white'
                            }`}
                    >
                        {status}
                    </button>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
                <div className="space-y-3 lg:col-span-3">
                    {subscriptions.map((sub) => {
                        const latest = sub.navSnapshots?.[0];
                        const cumulative = Number(latest?.cumulativeReturn ?? 0);
                        const pnlColor = cumulative >= 0 ? 'text-emerald-300' : 'text-red-300';

                        return (
                            <div key={sub.id} className="rounded-2xl border border-white/10 bg-[#121417] p-4">
                                <div className="mb-3 flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-semibold text-white">{sub.product.name}</div>
                                        <div className="mt-1 text-xs text-muted-foreground">{sub.term.label} ({sub.term.durationDays}d) · {sub.status}</div>
                                    </div>
                                    <DisclosurePolicyPill policy={sub.product.disclosurePolicy} delayHours={sub.product.disclosureDelayHours} />
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                                        <div className="text-muted-foreground">Principal</div>
                                        <div className="font-semibold text-white">${sub.principal.toFixed(2)}</div>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                                        <div className="text-muted-foreground">Equity</div>
                                        <div className="font-semibold text-white">${(latest?.equity ?? sub.principal).toFixed(2)}</div>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                                        <div className="text-muted-foreground">Return</div>
                                        <div className={`font-semibold ${pnlColor}`}>{(cumulative * 100).toFixed(2)}%</div>
                                    </div>
                                </div>

                                <div className="mt-3 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setActiveSubscriptionId(sub.id)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-white"
                                    >
                                        <Eye className="h-3.5 w-3.5" />
                                        View NAV
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {subscriptions.length === 0 && (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-muted-foreground">
                            No subscriptions found for current filter.
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#121417] p-4 lg:col-span-2">
                    <h2 className="text-sm font-semibold text-white">NAV Detail</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Select a subscription to inspect latest NAV trajectory.</p>

                    {navLoading ? (
                        <div className="mt-6 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                        </div>
                    ) : navDetail ? (
                        <>
                            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                                <Stat label="Latest NAV" value={navDetail.summary.latestNav.toFixed(4)} compact />
                                <Stat label="Cumulative" value={`${(navDetail.summary.cumulativeReturn * 100).toFixed(2)}%`} compact />
                                <Stat label="Max Drawdown" value={`${(navDetail.summary.maxDrawdown * 100).toFixed(2)}%`} compact />
                                <Stat label="Points" value={`${navDetail.summary.points}`} compact />
                            </div>

                            <div className="mt-4 max-h-[360px] space-y-1 overflow-auto rounded-lg border border-white/10 bg-black/20 p-2">
                                {navDetail.snapshots.slice(-30).map((point) => (
                                    <div key={point.snapshotAt} className="flex items-center justify-between rounded px-2 py-1 text-xs text-muted-foreground hover:bg-white/5">
                                        <span>{new Date(point.snapshotAt).toLocaleString()}</span>
                                        <span className="font-mono text-white">{point.nav.toFixed(4)}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="mt-6 rounded-lg border border-dashed border-white/10 p-6 text-center text-xs text-muted-foreground">
                            Choose one subscription from the list.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
    return (
        <div className={`rounded-lg border border-white/10 bg-white/5 ${compact ? 'p-2' : 'p-3'}`}>
            <div className="text-[11px] text-muted-foreground">{label}</div>
            <div className="mt-0.5 text-sm font-semibold text-white">{value}</div>
        </div>
    );
}
