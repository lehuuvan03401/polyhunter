'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { usePrivyLogin } from '@/lib/privy-login';
import { useManagedWalletAuth } from '@/lib/managed-wealth/wallet-auth-client';
import {
    AlertCircle,
    ArrowLeft,
    BarChart3,
    CheckCircle2,
    GitBranch,
    Loader2,
    RefreshCw,
    Shield,
    Sparkles,
    Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

type ParticipationAccountResponse = {
    account: {
        status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
        preferredMode: 'FREE' | 'MANAGED' | null;
        isRegistrationComplete: boolean;
        registrationCompletedAt: string | null;
        activatedAt: string | null;
    } | null;
    netDeposits: {
        depositUsd: number;
        withdrawUsd: number;
        netUsd: number;
        depositMcn: number;
        withdrawMcn: number;
        netMcnEquivalent: number;
    };
    eligibility: {
        freeQualified: boolean;
        managedQualified: boolean;
        thresholds: {
            FREE: number;
            MANAGED: number;
        };
    };
};

type ParticipationLevelsResponse = {
    progress: {
        level: string;
        dividendRate: number;
        teamNetDepositUsd: number;
        selfNetDepositUsd: number;
        directTeamWalletCount: number;
        nextLevel: string | null;
        nextLevelThresholdUsd: number | null;
        remainingToNextUsd: number;
    } | null;
    latestSnapshot: {
        snapshotDate: string;
        level: string;
        dividendRate: number;
    } | null;
};

type ParticipationPromotionResponse = {
    progress: {
        promotionLevel: string;
        directLegCount: number;
        leftNetDepositUsd: number;
        rightNetDepositUsd: number;
        weakZoneNetDepositUsd: number;
        strongZoneNetDepositUsd: number;
        nextLevel: string | null;
        nextLevelThresholdUsd: number | null;
        nextLevelGapUsd: number;
    } | null;
    latestSnapshot: {
        snapshotDate: string;
        promotionLevel: string;
        nextLevel: string | null;
    } | null;
};

type ParticipationDashboardData = {
    account: ParticipationAccountResponse;
    levels: ParticipationLevelsResponse;
    promotion: ParticipationPromotionResponse;
};

type WalletHeadersFactory = (params: {
    walletAddress: string;
    method: string;
    pathWithQuery: string;
}) => Promise<Record<string, string>>;

async function fetchJson<T>(path: string, headers: Record<string, string>): Promise<T> {
    const res = await fetch(path, {
        headers,
        cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error || `Failed to load ${path}`);
    }
    return data as T;
}

async function loadParticipationDashboard(
    walletAddress: string,
    createWalletAuthHeaders: WalletHeadersFactory
): Promise<ParticipationDashboardData> {
    const accountPath = `/api/participation/account?wallet=${encodeURIComponent(walletAddress)}`;
    const levelsPath = `/api/participation/levels?wallet=${encodeURIComponent(walletAddress)}`;
    const promotionPath = `/api/participation/promotion?wallet=${encodeURIComponent(walletAddress)}`;

    const [accountHeaders, levelsHeaders, promotionHeaders] = await Promise.all([
        createWalletAuthHeaders({
            walletAddress,
            method: 'GET',
            pathWithQuery: accountPath,
        }),
        createWalletAuthHeaders({
            walletAddress,
            method: 'GET',
            pathWithQuery: levelsPath,
        }),
        createWalletAuthHeaders({
            walletAddress,
            method: 'GET',
            pathWithQuery: promotionPath,
        }),
    ]);

    const [account, levels, promotion] = await Promise.all([
        fetchJson<ParticipationAccountResponse>(accountPath, accountHeaders),
        fetchJson<ParticipationLevelsResponse>(levelsPath, levelsHeaders),
        fetchJson<ParticipationPromotionResponse>(promotionPath, promotionHeaders),
    ]);

    return { account, levels, promotion };
}

function formatUsd(value: number): string {
    return `$${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatDate(value: string | null | undefined): string {
    if (!value) return '--';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '--';
    return parsed.toLocaleString();
}

export default function ParticipationPage() {
    const { authenticated, ready, login, user, isLoggingIn } = usePrivyLogin();
    const { createWalletAuthHeaders } = useManagedWalletAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [dashboard, setDashboard] = useState<ParticipationDashboardData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function run(initialLoad: boolean) {
            if (!authenticated || !user?.wallet?.address) {
                if (!cancelled) {
                    setDashboard(null);
                    setError(null);
                    setLoading(false);
                    setRefreshing(false);
                }
                return;
            }

            if (!cancelled) {
                if (initialLoad) {
                    setLoading(true);
                } else {
                    setRefreshing(true);
                }
                setError(null);
            }

            try {
                const data = await loadParticipationDashboard(
                    user.wallet.address,
                    createWalletAuthHeaders
                );
                if (!cancelled) {
                    setDashboard(data);
                }
            } catch (fetchError) {
                if (!cancelled) {
                    const message = fetchError instanceof Error
                        ? fetchError.message
                        : 'Failed to load participation dashboard';
                    setError(message);
                    toast.error(message);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        }

        void run(true);

        return () => {
            cancelled = true;
        };
    }, [authenticated, user?.wallet?.address, createWalletAuthHeaders]);

    const handleRefresh = async () => {
        if (!user?.wallet?.address || refreshing) return;

        setRefreshing(true);
        setError(null);
        try {
            const data = await loadParticipationDashboard(
                user.wallet.address,
                createWalletAuthHeaders
            );
            setDashboard(data);
        } catch (fetchError) {
            const message = fetchError instanceof Error
                ? fetchError.message
                : 'Failed to load participation dashboard';
            setError(message);
            toast.error(message);
        } finally {
            setRefreshing(false);
        }
    };

    if (!ready || loading) {
        return (
            <div className="container py-20 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div className="container py-20">
                <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#0A0B0E]/80 p-12 text-center shadow-2xl">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10">
                        <Shield className="h-8 w-8 text-blue-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Participation Dashboard</h1>
                    <p className="mt-4 text-zinc-400">
                        Connect your wallet to view participation status, level progress, and double-zone promotion.
                    </p>
                    <button
                        onClick={login}
                        disabled={isLoggingIn}
                        className="mt-8 rounded-xl bg-blue-600 px-8 py-3 font-semibold text-white transition-all hover:bg-blue-500 disabled:opacity-60"
                    >
                        {isLoggingIn ? 'Connecting...' : 'Connect Wallet'}
                    </button>
                </div>
            </div>
        );
    }

    const account = dashboard?.account.account;
    const netDeposits = dashboard?.account.netDeposits;
    const eligibility = dashboard?.account.eligibility;
    const levelProgress = dashboard?.levels.progress;
    const promotionProgress = dashboard?.promotion.progress;

    return (
        <div className="container py-10 min-h-screen">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <Link href="/affiliate" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors group">
                        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                        Back to affiliate center
                    </Link>
                    <div className="mt-4 flex items-center gap-3">
                        <div className="rounded-2xl bg-blue-500/10 p-3">
                            <Sparkles className="h-6 w-6 text-blue-300" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Participation Dashboard</h1>
                            <p className="mt-1 text-zinc-400">
                                Track activation, capital thresholds, V-level progress, and double-zone promotion in one place.
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10 disabled:opacity-60"
                >
                    {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                </button>
            </div>

            {error ? (
                <div className="mb-6 flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatusCard
                    icon={<Shield className="h-5 w-5 text-blue-300" />}
                    title="Account Status"
                    value={account?.status ?? 'NOT_REGISTERED'}
                    note={account?.preferredMode ? `Mode: ${account.preferredMode}` : 'Mode not selected'}
                />
                <StatusCard
                    icon={<Wallet className="h-5 w-5 text-emerald-300" />}
                    title="Net Qualified Capital"
                    value={netDeposits ? `${netDeposits.netMcnEquivalent.toFixed(2)} MCN` : '--'}
                    note={netDeposits ? `${formatUsd(netDeposits.netUsd)} net USD equivalent` : 'No funding yet'}
                />
                <StatusCard
                    icon={<BarChart3 className="h-5 w-5 text-violet-300" />}
                    title="Current V Level"
                    value={levelProgress?.level ?? 'NONE'}
                    note={levelProgress
                        ? `Dividend ${(levelProgress.dividendRate * 100).toFixed(0)}%`
                        : 'No level snapshot yet'}
                />
                <StatusCard
                    icon={<GitBranch className="h-5 w-5 text-amber-300" />}
                    title="Promotion Progress"
                    value={promotionProgress?.promotionLevel ?? 'NONE'}
                    note={promotionProgress
                        ? `Direct legs ${promotionProgress.directLegCount}`
                        : 'No promotion snapshot yet'}
                />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <Panel title="Activation & Eligibility" subtitle="Registration, activation, and capital threshold readiness.">
                    <MetricRow
                        label="Registration"
                        value={account?.isRegistrationComplete ? 'Complete' : 'Pending'}
                    />
                    <MetricRow
                        label="Activated At"
                        value={formatDate(account?.activatedAt)}
                    />
                    <MetricRow
                        label="Registered At"
                        value={formatDate(account?.registrationCompletedAt)}
                    />
                    <MetricRow
                        label={`FREE >= ${eligibility?.thresholds.FREE ?? 100}U`}
                        value={eligibility?.freeQualified ? 'Qualified' : 'Not yet'}
                        positive={Boolean(eligibility?.freeQualified)}
                    />
                    <MetricRow
                        label={`MANAGED >= ${eligibility?.thresholds.MANAGED ?? 500}U`}
                        value={eligibility?.managedQualified ? 'Qualified' : 'Not yet'}
                        positive={Boolean(eligibility?.managedQualified)}
                    />
                </Panel>

                <Panel title="Level Snapshot" subtitle="Daily V-level evaluation based on team net deposits.">
                    <MetricRow
                        label="Self Net Deposit"
                        value={levelProgress ? formatUsd(levelProgress.selfNetDepositUsd) : '--'}
                    />
                    <MetricRow
                        label="Team Net Deposit"
                        value={levelProgress ? formatUsd(levelProgress.teamNetDepositUsd) : '--'}
                    />
                    <MetricRow
                        label="Direct Team Wallets"
                        value={levelProgress ? String(levelProgress.directTeamWalletCount) : '--'}
                    />
                    <MetricRow
                        label="Next Level"
                        value={levelProgress?.nextLevel ?? 'MAX'}
                    />
                    <MetricRow
                        label="Gap to Next"
                        value={levelProgress ? formatUsd(levelProgress.remainingToNextUsd) : '--'}
                    />
                    <MetricRow
                        label="Latest Snapshot"
                        value={formatDate(dashboard?.levels.latestSnapshot?.snapshotDate)}
                    />
                </Panel>

                <Panel title="Double-Zone Promotion" subtitle="Track weak-zone progress and next-level gap.">
                    <MetricRow
                        label="Left Zone"
                        value={promotionProgress ? formatUsd(promotionProgress.leftNetDepositUsd) : '--'}
                    />
                    <MetricRow
                        label="Right Zone"
                        value={promotionProgress ? formatUsd(promotionProgress.rightNetDepositUsd) : '--'}
                    />
                    <MetricRow
                        label="Weak Zone"
                        value={promotionProgress ? formatUsd(promotionProgress.weakZoneNetDepositUsd) : '--'}
                    />
                    <MetricRow
                        label="Strong Zone"
                        value={promotionProgress ? formatUsd(promotionProgress.strongZoneNetDepositUsd) : '--'}
                    />
                    <MetricRow
                        label="Next Promotion Level"
                        value={promotionProgress?.nextLevel ?? 'MAX'}
                    />
                    <MetricRow
                        label="Gap to Next"
                        value={promotionProgress ? formatUsd(promotionProgress.nextLevelGapUsd) : '--'}
                    />
                </Panel>

                <Panel title="Recommended Next Actions" subtitle="Use the current state to decide what to do next.">
                    <ActionItem
                        done={Boolean(account?.isRegistrationComplete)}
                        text="Complete participation registration first."
                    />
                    <ActionItem
                        done={Boolean(eligibility?.freeQualified)}
                        text="Reach the FREE threshold to activate basic participation."
                    />
                    <ActionItem
                        done={Boolean(eligibility?.managedQualified)}
                        text="Reach the MANAGED threshold before managed custody workflows."
                    />
                    <ActionItem
                        done={Boolean(account?.preferredMode === 'MANAGED' && account?.status === 'ACTIVE')}
                        text="Switch to MANAGED mode if you want custody-based execution."
                    />
                    <div className="mt-4 flex flex-wrap gap-3">
                        <Link href="/managed-wealth" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors">
                            Open Managed Wealth
                        </Link>
                        <Link href="/affiliate/rules" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors">
                            View Policy Rules
                        </Link>
                    </div>
                </Panel>
            </div>
        </div>
    );
}

function StatusCard({
    icon,
    title,
    value,
    note,
}: {
    icon: ReactNode;
    title: string;
    value: string;
    note: string;
}) {
    return (
        <div className="rounded-2xl border border-white/10 bg-[#0F1115] p-5">
            <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">{title}</span>
                {icon}
            </div>
            <div className="mt-4 text-2xl font-semibold text-white">{value}</div>
            <div className="mt-2 text-sm text-zinc-500">{note}</div>
        </div>
    );
}

function Panel({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle: string;
    children: ReactNode;
}) {
    return (
        <section className="rounded-3xl border border-white/10 bg-[#0A0B0E]/80 p-6">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
            <div className="mt-5 space-y-3">{children}</div>
        </section>
    );
}

function MetricRow({
    label,
    value,
    positive,
}: {
    label: string;
    value: string;
    positive?: boolean;
}) {
    return (
        <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
            <span className="text-sm text-zinc-400">{label}</span>
            <span className={`text-sm font-medium ${positive ? 'text-emerald-300' : 'text-white'}`}>
                {value}
            </span>
        </div>
    );
}

function ActionItem({
    done,
    text,
}: {
    done: boolean;
    text: string;
}) {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
            <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${done ? 'text-emerald-300' : 'text-zinc-600'}`} />
            <span className={`${done ? 'text-zinc-400 line-through' : 'text-zinc-200'} text-sm`}>
                {text}
            </span>
        </div>
    );
}
