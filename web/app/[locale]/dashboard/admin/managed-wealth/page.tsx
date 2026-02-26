'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type ManagedOpsHealthResponse = {
    generatedAt: string;
    allocation: {
        executionScopeSubscriptions: number;
        byStatus: {
            running: number;
            matured: number;
            liquidating: number;
        };
        mappedCount: number;
        unmappedCount: number;
        staleMappingMinutes: number;
        staleUnmapped: Array<{
            subscriptionId: string;
            status: string;
            walletAddress: string;
            createdAt: string;
            ageMinutes: number;
        }>;
    };
    liquidation: {
        totalLiquidating: number;
        inspectedCount: number;
        inspectionLimit: number;
        backlogCount: number;
        readyToSettleCount: number;
        backlogOldestAgeMinutes: number;
        backlog: Array<{
            subscriptionId: string;
            walletAddress: string;
            openPositionsCount: number;
            updatedAt: string;
            ageMinutes: number;
        }>;
    };
    settlementCommissionParity: {
        windowDays: number;
        windowStart: string;
        checkedSettlements: number;
        settlementsWithReferral: number;
        settlementsWithoutReferral: number;
        matchedCount: number;
        missingCount: number;
        feeMismatchCount: number;
        missing: Array<{
            settlementId: string;
            subscriptionId: string;
            walletAddress: string;
            tradeId: string;
            grossPnl: number;
            expectedFee: number;
            settledAt: string;
        }>;
        feeMismatches: Array<{
            settlementId: string;
            subscriptionId: string;
            walletAddress: string;
            tradeId: string;
            expectedFee: number;
            actualFee: number;
            drift: number;
            logCount: number;
        }>;
    };
};

const QUERY = 'windowDays=7&liquidationLimit=200&parityLimit=500';

export default function AdminManagedWealthOpsPage() {
    const { ready, authenticated } = usePrivy();
    const { wallets } = useWallets();
    const adminWallet = wallets[0]?.address || '';

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ManagedOpsHealthResponse | null>(null);

    const adminHeaders = useMemo(() => ({
        'x-admin-wallet': adminWallet,
    }), [adminWallet]);

    const fetchHealth = useCallback(async () => {
        if (!adminWallet) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/managed-settlement/health?${QUERY}`, {
                headers: adminHeaders,
            });
            const body = await res.json() as ManagedOpsHealthResponse & { error?: string };
            if (!res.ok) {
                throw new Error(body.error || 'Failed to fetch managed ops health');
            }
            setData(body);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to fetch managed ops health');
        } finally {
            setLoading(false);
        }
    }, [adminHeaders, adminWallet]);

    if (!ready || !authenticated) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <p className="text-gray-400">Please connect wallet to access managed operations.</p>
            </div>
        );
    }

    const hasAlerts = Boolean(
        data
        && (
            data.allocation.unmappedCount > 0
            || data.liquidation.backlogCount > 0
            || data.settlementCommissionParity.missingCount > 0
            || data.settlementCommissionParity.feeMismatchCount > 0
        )
    );

    return (
        <div className="min-h-screen bg-gray-950 py-8 px-4">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Managed Wealth Ops</h1>
                        <p className="text-sm text-gray-400 mt-1">
                            Allocation mapping, liquidation backlog, and settlement fee parity.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/dashboard/admin"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Link>
                        <button
                            onClick={fetchHealth}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-60"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>

                {hasAlerts && (
                    <div className="rounded-xl border border-amber-700/40 bg-amber-900/20 px-4 py-3 text-amber-200 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5" />
                        <p className="text-sm">
                            Managed loop has actionable alerts. Check backlog and parity tables below.
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        title="Mapped Execution"
                        value={data ? `${data.allocation.mappedCount}` : '--'}
                        subtitle={data ? `Total ${data.allocation.executionScopeSubscriptions}` : 'Load data'}
                    />
                    <StatCard
                        title="Unmapped Execution"
                        value={data ? `${data.allocation.unmappedCount}` : '--'}
                        subtitle={data ? `Stale >= ${data.allocation.staleMappingMinutes}m` : 'Load data'}
                        danger={Boolean(data && data.allocation.unmappedCount > 0)}
                    />
                    <StatCard
                        title="Liquidation Backlog"
                        value={data ? `${data.liquidation.backlogCount}` : '--'}
                        subtitle={data ? `Oldest ${data.liquidation.backlogOldestAgeMinutes}m` : 'Load data'}
                        danger={Boolean(data && data.liquidation.backlogCount > 0)}
                    />
                    <StatCard
                        title="Parity Issues"
                        value={data ? `${data.settlementCommissionParity.missingCount + data.settlementCommissionParity.feeMismatchCount}` : '--'}
                        subtitle={data ? `Window ${data.settlementCommissionParity.windowDays}d` : 'Load data'}
                        danger={Boolean(data && (data.settlementCommissionParity.missingCount + data.settlementCommissionParity.feeMismatchCount) > 0)}
                    />
                </div>

                <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
                    <h2 className="text-white font-semibold mb-3">Stale Unmapped Subscriptions</h2>
                    {!data || data.allocation.staleUnmapped.length === 0 ? (
                        <p className="text-sm text-gray-400">No stale unmapped subscriptions.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-gray-400 border-b border-gray-800">
                                    <tr>
                                        <th className="py-2">Subscription</th>
                                        <th className="py-2">Status</th>
                                        <th className="py-2">Wallet</th>
                                        <th className="py-2">Age</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-200">
                                    {data.allocation.staleUnmapped.map((item) => (
                                        <tr key={item.subscriptionId} className="border-b border-gray-800/70">
                                            <td className="py-2 font-mono text-xs">{item.subscriptionId}</td>
                                            <td className="py-2">{item.status}</td>
                                            <td className="py-2 font-mono text-xs">{item.walletAddress}</td>
                                            <td className="py-2">{item.ageMinutes}m</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
                    <h2 className="text-white font-semibold mb-3">Liquidation Backlog</h2>
                    {!data || data.liquidation.backlog.length === 0 ? (
                        <p className="text-sm text-gray-400">No liquidating subscriptions with open positions.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-gray-400 border-b border-gray-800">
                                    <tr>
                                        <th className="py-2">Subscription</th>
                                        <th className="py-2">Wallet</th>
                                        <th className="py-2">Open Positions</th>
                                        <th className="py-2">Age</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-200">
                                    {data.liquidation.backlog.map((item) => (
                                        <tr key={item.subscriptionId} className="border-b border-gray-800/70">
                                            <td className="py-2 font-mono text-xs">{item.subscriptionId}</td>
                                            <td className="py-2 font-mono text-xs">{item.walletAddress}</td>
                                            <td className="py-2">{item.openPositionsCount}</td>
                                            <td className="py-2">{item.ageMinutes}m</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
                    <h2 className="text-white font-semibold mb-3">Settlement Profit Fee Parity</h2>
                    {!data ? (
                        <p className="text-sm text-gray-400">Load data to inspect parity status.</p>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                <MetricLine label="Checked settlements" value={String(data.settlementCommissionParity.checkedSettlements)} />
                                <MetricLine label="Missing profit fee logs" value={String(data.settlementCommissionParity.missingCount)} danger={data.settlementCommissionParity.missingCount > 0} />
                                <MetricLine label="Fee mismatches" value={String(data.settlementCommissionParity.feeMismatchCount)} danger={data.settlementCommissionParity.feeMismatchCount > 0} />
                            </div>
                            {data.settlementCommissionParity.missing.length > 0 && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-left text-gray-400 border-b border-gray-800">
                                            <tr>
                                                <th className="py-2">Subscription</th>
                                                <th className="py-2">Wallet</th>
                                                <th className="py-2">Expected Fee</th>
                                                <th className="py-2">Gross PnL</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-gray-200">
                                            {data.settlementCommissionParity.missing.map((item) => (
                                                <tr key={item.settlementId} className="border-b border-gray-800/70">
                                                    <td className="py-2 font-mono text-xs">{item.subscriptionId}</td>
                                                    <td className="py-2 font-mono text-xs">{item.walletAddress}</td>
                                                    <td className="py-2">{item.expectedFee.toFixed(4)}</td>
                                                    <td className="py-2">{item.grossPnl.toFixed(4)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </section>

                {data && (
                    <p className="text-xs text-gray-500">
                        Last updated: {new Date(data.generatedAt).toLocaleString()}
                    </p>
                )}
            </div>
        </div>
    );
}

function StatCard(props: {
    title: string;
    value: string;
    subtitle: string;
    danger?: boolean;
}) {
    return (
        <div className={`rounded-xl border p-4 ${props.danger ? 'border-red-800 bg-red-950/20' : 'border-gray-800 bg-gray-900/70'}`}>
            <p className="text-xs uppercase tracking-wide text-gray-400">{props.title}</p>
            <p className={`text-2xl font-bold mt-1 ${props.danger ? 'text-red-300' : 'text-white'}`}>{props.value}</p>
            <p className="text-xs text-gray-500 mt-1">{props.subtitle}</p>
        </div>
    );
}

function MetricLine(props: {
    label: string;
    value: string;
    danger?: boolean;
}) {
    return (
        <div className="rounded-lg border border-gray-800 bg-gray-950/70 px-3 py-2">
            <p className="text-gray-400 text-xs">{props.label}</p>
            <p className={`mt-1 font-semibold ${props.danger ? 'text-red-300' : 'text-white'}`}>{props.value}</p>
        </div>
    );
}
