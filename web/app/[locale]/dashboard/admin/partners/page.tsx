'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronLeft,
    Loader2,
    RefreshCw,
    Settings,
    Shield,
    Trophy,
    Users,
} from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_ELIMINATION_COUNT = 10;

type PartnerConfigResponse = {
    config: {
        id: string;
        maxSeats: number;
        refillPriceUsd: number;
    };
    stats: {
        activeSeatCount: number;
        availableSeatCount: number;
        pendingRefundCount: number;
        refill: {
            isOpen: boolean;
            openSeats: number;
            refillPriceUsd: number;
        };
    };
};

type PartnerSeat = {
    id: string;
    walletAddress: string;
    status: 'ACTIVE' | 'ELIMINATED' | 'REFUND_PENDING' | 'REFUNDED';
    seatFeeUsd: number;
    privilegeLevel: string;
    backendAccess: boolean;
    joinedAt: string;
    monthlyRanks?: Array<{
        monthKey: string;
        rank: number;
        scoreNetDepositUsd: number;
    }>;
};

type PartnerSeatsResponse = {
    seats: PartnerSeat[];
    stats: {
        activeSeatCount: number;
        availableSeatCount: number;
        maxSeats: number;
        pendingRefundCount: number;
        refill: {
            isOpen: boolean;
            openSeats: number;
            refillPriceUsd: number;
        };
    };
};

type PartnerRefund = {
    id: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    amountUsd: number;
    requestedAt: string;
    completedAt?: string | null;
    txHash?: string | null;
    errorMessage?: string | null;
    seat: {
        id: string;
        walletAddress: string;
        status: string;
    };
    elimination: {
        id: string;
        monthKey: string;
        rankAtElimination: number;
        refundDeadlineAt: string;
    };
};

type PartnerRefundsResponse = {
    refunds: PartnerRefund[];
};

type EliminationDryRunResponse = {
    monthKey: string;
    activeSeatCount: number;
    eliminateCount: number;
    eliminationCandidates: Array<{
        id: string;
        walletAddress: string;
        rank: number;
        scoreNetDepositUsd: number;
    }>;
};

function currentMonthKey(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

export default function AdminPartnerOpsPage() {
    const { ready, authenticated } = usePrivy();
    const { wallets } = useWallets();
    const adminWallet = wallets[0]?.address || '';

    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<PartnerConfigResponse | null>(null);
    const [seats, setSeats] = useState<PartnerSeat[]>([]);
    const [refunds, setRefunds] = useState<PartnerRefund[]>([]);

    const [refillPriceInput, setRefillPriceInput] = useState('0');

    const [monthKey, setMonthKey] = useState(currentMonthKey());
    const [eliminateCount, setEliminateCount] = useState(String(DEFAULT_ELIMINATION_COUNT));
    const [dryRunResult, setDryRunResult] = useState<EliminationDryRunResponse | null>(null);

    const [refundTxHash, setRefundTxHash] = useState<Record<string, string>>({});
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

    const setLoadingKey = (key: string, value: boolean) => {
        setActionLoading((prev) => ({ ...prev, [key]: value }));
    };

    const adminHeaders = useMemo(() => ({
        'x-admin-wallet': adminWallet,
    }), [adminWallet]);

    const fetchAll = useCallback(async () => {
        if (!adminWallet) return;
        setLoading(true);
        try {
            const [configRes, seatsRes, refundsRes] = await Promise.all([
                fetch('/api/partners/config', { headers: adminHeaders }),
                fetch(`/api/partners/seats?monthKey=${encodeURIComponent(monthKey)}`, { headers: adminHeaders }),
                fetch('/api/partners/refunds?status=PENDING', { headers: adminHeaders }),
            ]);

            const [configData, seatsData, refundsData] = await Promise.all([
                configRes.json() as Promise<PartnerConfigResponse>,
                seatsRes.json() as Promise<PartnerSeatsResponse>,
                refundsRes.json() as Promise<PartnerRefundsResponse>,
            ]);

            if (!configRes.ok) {
                throw new Error((configData as { error?: string }).error || 'Failed to fetch config');
            }
            if (!seatsRes.ok) {
                throw new Error((seatsData as { error?: string }).error || 'Failed to fetch seats');
            }
            if (!refundsRes.ok) {
                throw new Error((refundsData as { error?: string }).error || 'Failed to fetch refunds');
            }

            setConfig(configData);
            setSeats(seatsData.seats);
            setRefunds(refundsData.refunds);
            setRefillPriceInput(String(configData.config.refillPriceUsd));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to fetch partner ops data');
        } finally {
            setLoading(false);
        }
    }, [adminHeaders, adminWallet, monthKey]);

    const updateConfig = async () => {
        if (!adminWallet) return;

        const refillPriceUsd = Number(refillPriceInput);

        if (!Number.isFinite(refillPriceUsd) || refillPriceUsd < 0) {
            toast.error('refillPriceUsd must be non-negative');
            return;
        }

        setLoadingKey('updateConfig', true);
        try {
            const res = await fetch('/api/partners/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...adminHeaders,
                },
                body: JSON.stringify({
                    refillPriceUsd,
                }),
            });
            const data = await res.json() as PartnerConfigResponse & { error?: string };
            if (!res.ok) {
                throw new Error(data.error || 'Failed to update config');
            }

            toast.success('Partner config updated');
            setConfig(data);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update config');
        } finally {
            setLoadingKey('updateConfig', false);
        }
    };

    const runEliminationDryRun = async () => {
        if (!adminWallet) return;

        const count = Number(eliminateCount) || DEFAULT_ELIMINATION_COUNT;
        setLoadingKey('dryRun', true);
        try {
            const res = await fetch('/api/partners/cycle/eliminate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...adminHeaders,
                },
                body: JSON.stringify({
                    monthKey,
                    eliminateCount: count,
                    dryRun: true,
                }),
            });
            const data = await res.json() as EliminationDryRunResponse & { error?: string };
            if (!res.ok) {
                throw new Error(data.error || 'Failed to run dry-run');
            }
            setDryRunResult(data);
            toast.success('Elimination dry-run completed');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to run dry-run');
        } finally {
            setLoadingKey('dryRun', false);
        }
    };

    const runEliminationExecute = async () => {
        if (!adminWallet) return;
        if (!window.confirm(`Execute elimination for ${monthKey}? This operation should run once per month.`)) {
            return;
        }

        const count = Number(eliminateCount) || DEFAULT_ELIMINATION_COUNT;
        setLoadingKey('executeElimination', true);
        try {
            const res = await fetch('/api/partners/cycle/eliminate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...adminHeaders,
                },
                body: JSON.stringify({
                    monthKey,
                    eliminateCount: count,
                    dryRun: false,
                    reason: 'admin-manual-monthly-cycle',
                }),
            });
            const data = await res.json() as { error?: string };
            if (!res.ok) {
                throw new Error(data.error || 'Failed to execute elimination');
            }

            toast.success('Elimination cycle executed');
            await fetchAll();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to execute elimination');
        } finally {
            setLoadingKey('executeElimination', false);
        }
    };

    const completeRefund = async (refundId: string) => {
        const txHash = refundTxHash[refundId]?.trim();
        if (!txHash) {
            toast.error('txHash is required to complete refund');
            return;
        }

        setLoadingKey(`refund-${refundId}`, true);
        try {
            const res = await fetch('/api/partners/refunds', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...adminHeaders,
                },
                body: JSON.stringify({
                    refundId,
                    action: 'COMPLETE',
                    txHash,
                }),
            });
            const data = await res.json() as { error?: string };
            if (!res.ok) {
                throw new Error(data.error || 'Failed to complete refund');
            }

            toast.success('Refund marked completed');
            await fetchAll();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to complete refund');
        } finally {
            setLoadingKey(`refund-${refundId}`, false);
        }
    };

    if (!ready || !authenticated) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <p className="text-gray-400">Please connect wallet to access partner operations.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 py-8 px-4">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <Link
                            href="/dashboard/admin"
                            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Back to Admin Dashboard
                        </Link>
                        <h1 className="mt-2 text-2xl font-bold text-white flex items-center gap-2">
                            <Shield className="h-6 w-6 text-blue-400" />
                            Global Partner Operations
                        </h1>
                        <p className="text-sm text-gray-400 mt-1">
                            Seat governance, elimination cycle, and refund SLA handling.
                        </p>
                    </div>

                    <button
                        onClick={fetchAll}
                        disabled={loading || !adminWallet}
                        className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Refresh
                    </button>
                </div>

                {!adminWallet && (
                    <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">
                        Admin wallet not detected. Connect an admin wallet that exists in `ADMIN_WALLETS`.
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard title="Active Seats" value={config?.stats.activeSeatCount ?? 0} icon={<Users className="h-4 w-4" />} />
                    <StatCard title="Open Seats" value={config?.stats.availableSeatCount ?? 0} icon={<Trophy className="h-4 w-4" />} />
                    <StatCard title="Pending Refunds" value={config?.stats.pendingRefundCount ?? 0} icon={<AlertTriangle className="h-4 w-4" />} />
                    <StatCard title="Refill Price" value={`$${(config?.config.refillPriceUsd ?? 0).toLocaleString()}`} icon={<Settings className="h-4 w-4" />} />
                </div>

                <section className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
                    <h2 className="text-lg font-semibold text-white">Seat Config</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <span className="text-xs text-gray-400">Max Seats (Immutable)</span>
                            <div className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-300">
                                {config?.config.maxSeats ?? 100}
                            </div>
                        </div>
                        <label className="space-y-1">
                            <span className="text-xs text-gray-400">Refill Price (USD)</span>
                            <input
                                value={refillPriceInput}
                                onChange={(e) => setRefillPriceInput(e.target.value)}
                                className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
                            />
                        </label>
                        <div className="flex items-end">
                            <button
                                onClick={updateConfig}
                                disabled={actionLoading.updateConfig || !adminWallet}
                                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                            >
                                {actionLoading.updateConfig ? 'Saving...' : 'Update Config'}
                            </button>
                        </div>
                    </div>
                </section>

                <section className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
                    <h2 className="text-lg font-semibold text-white">Monthly Elimination</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <label className="space-y-1">
                            <span className="text-xs text-gray-400">Month Key</span>
                            <input
                                value={monthKey}
                                onChange={(e) => setMonthKey(e.target.value)}
                                placeholder="YYYY-MM"
                                className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-xs text-gray-400">Eliminate Count</span>
                            <input
                                value={eliminateCount}
                                onChange={(e) => setEliminateCount(e.target.value)}
                                className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
                            />
                        </label>
                        <div className="flex items-end">
                            <button
                                onClick={runEliminationDryRun}
                                disabled={actionLoading.dryRun || !adminWallet}
                                className="w-full rounded-md bg-gray-700 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-600 disabled:opacity-50"
                            >
                                {actionLoading.dryRun ? 'Running...' : 'Dry Run'}
                            </button>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={runEliminationExecute}
                                disabled={actionLoading.executeElimination || !adminWallet}
                                className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                            >
                                {actionLoading.executeElimination ? 'Executing...' : 'Execute'}
                            </button>
                        </div>
                    </div>

                    {dryRunResult && (
                        <div className="rounded-lg border border-gray-700 bg-gray-950 p-4 space-y-3">
                            <div className="text-sm text-gray-300">
                                Dry-run result for <span className="font-mono">{dryRunResult.monthKey}</span>: eliminate {dryRunResult.eliminateCount} / active {dryRunResult.activeSeatCount}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-gray-400 border-b border-gray-800">
                                            <th className="text-left py-2">Wallet</th>
                                            <th className="text-left py-2">Rank</th>
                                            <th className="text-left py-2">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dryRunResult.eliminationCandidates.map((row) => (
                                            <tr key={row.id} className="border-b border-gray-900 text-gray-200">
                                                <td className="py-2 font-mono text-xs">{row.walletAddress}</td>
                                                <td className="py-2">#{row.rank}</td>
                                                <td className="py-2">{row.scoreNetDepositUsd.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </section>

                <section className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
                    <h2 className="text-lg font-semibold text-white">Pending Refund Queue</h2>
                    {refunds.length === 0 ? (
                        <div className="text-sm text-gray-400">No pending refunds.</div>
                    ) : (
                        <div className="space-y-3">
                            {refunds.map((refund) => {
                                const key = `refund-${refund.id}`;
                                return (
                                    <div key={refund.id} className="rounded-lg border border-gray-800 bg-gray-950 p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <p className="text-sm text-white font-semibold">{refund.seat.walletAddress}</p>
                                                <p className="text-xs text-gray-400">
                                                    {refund.elimination.monthKey} • rank #{refund.elimination.rankAtElimination} • ${refund.amountUsd.toLocaleString()}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    deadline: {new Date(refund.elimination.refundDeadlineAt).toLocaleString()}
                                                </p>
                                            </div>
                                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs text-yellow-300 border border-yellow-500/30">
                                                <AlertTriangle className="h-3 w-3" />
                                                PENDING
                                            </span>
                                        </div>

                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <input
                                                value={refundTxHash[refund.id] || ''}
                                                onChange={(e) => setRefundTxHash((prev) => ({ ...prev, [refund.id]: e.target.value }))}
                                                placeholder="Refund tx hash"
                                                className="min-w-[280px] flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-white"
                                            />
                                            <button
                                                onClick={() => completeRefund(refund.id)}
                                                disabled={actionLoading[key]}
                                                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                            >
                                                {actionLoading[key] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                                Mark Completed
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
                    <h2 className="text-lg font-semibold text-white">Seat Snapshot ({monthKey})</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-800 text-gray-400">
                                    <th className="text-left py-2">Wallet</th>
                                    <th className="text-left py-2">Status</th>
                                    <th className="text-left py-2">Level</th>
                                    <th className="text-left py-2">Rank</th>
                                    <th className="text-left py-2">Seat Fee</th>
                                </tr>
                            </thead>
                            <tbody>
                                {seats.map((seat) => {
                                    const rank = seat.monthlyRanks?.[0];
                                    return (
                                        <tr key={seat.id} className="border-b border-gray-900 text-gray-200">
                                            <td className="py-2 font-mono text-xs">{seat.walletAddress}</td>
                                            <td className="py-2">{seat.status}</td>
                                            <td className="py-2">{seat.privilegeLevel}</td>
                                            <td className="py-2">{rank ? `#${rank.rank}` : '-'}</td>
                                            <td className="py-2">${seat.seatFeeUsd.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="text-xs text-gray-400 flex items-center gap-1.5">{icon}{title}</div>
            <div className="mt-1 text-2xl font-bold text-white">{value}</div>
        </div>
    );
}
