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
        taskStatus: {
            pending: number;
            retrying: number;
            blocked: number;
            failed: number;
        };
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

type ManagedLiquidationTask = {
    id: string;
    subscriptionId: string;
    walletAddress: string;
    copyConfigId: string | null;
    tokenId: string;
    requestedShares: number;
    avgEntryPrice: number;
    indicativePrice: number | null;
    notionalUsd: number | null;
    status: 'PENDING' | 'RETRYING' | 'BLOCKED' | 'COMPLETED' | 'FAILED';
    attemptCount: number;
    lastAttemptAt: string | null;
    nextRetryAt: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    updatedAt: string;
    isDue: boolean;
};

type ManagedLiquidationTasksResponse = {
    generatedAt: string;
    summary: {
        totalCount: number;
        dueCount: number;
        byStatus: {
            pending: number;
            retrying: number;
            blocked: number;
            completed: number;
            failed: number;
        };
    };
    tasks: ManagedLiquidationTask[];
};

const QUERY = 'windowDays=7&liquidationLimit=200&parityLimit=500';
const TASK_QUERY = 'statuses=PENDING,RETRYING,BLOCKED,FAILED&limit=100';

export default function AdminManagedWealthOpsPage() {
    const { ready, authenticated } = usePrivy();
    const { wallets } = useWallets();
    const adminWallet = wallets[0]?.address || '';

    const [loading, setLoading] = useState(false);
    const [taskLoading, setTaskLoading] = useState(false);
    const [taskActionId, setTaskActionId] = useState<string | null>(null);
    const [data, setData] = useState<ManagedOpsHealthResponse | null>(null);
    const [tasksData, setTasksData] = useState<ManagedLiquidationTasksResponse | null>(null);

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

    const fetchTasks = useCallback(async () => {
        if (!adminWallet) return;
        setTaskLoading(true);
        try {
            const res = await fetch(`/api/managed-liquidation/tasks?${TASK_QUERY}`, {
                headers: adminHeaders,
            });
            const body = await res.json() as ManagedLiquidationTasksResponse & { error?: string };
            if (!res.ok) {
                throw new Error(body.error || 'Failed to fetch liquidation tasks');
            }
            setTasksData(body);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to fetch liquidation tasks');
        } finally {
            setTaskLoading(false);
        }
    }, [adminHeaders, adminWallet]);

    const refreshAll = useCallback(async () => {
        await Promise.all([fetchHealth(), fetchTasks()]);
    }, [fetchHealth, fetchTasks]);

    const mutateTask = useCallback(async (
        taskId: string,
        action: 'retry' | 'requeue' | 'fail'
    ) => {
        if (!adminWallet) return;
        const actionKey = `${action}:${taskId}`;
        setTaskActionId(actionKey);
        try {
            const reason = action === 'fail' ? 'manually failed by admin' : undefined;
            const res = await fetch('/api/managed-liquidation/tasks', {
                method: 'POST',
                headers: {
                    ...adminHeaders,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action,
                    taskIds: [taskId],
                    ...(action === 'retry' ? { delaySeconds: 0 } : {}),
                    ...(reason ? { reason } : {}),
                }),
            });
            const body = await res.json() as { error?: string; updatedCount?: number };
            if (!res.ok) {
                throw new Error(body.error || 'Failed to update liquidation task');
            }
            if ((body.updatedCount ?? 0) <= 0) {
                toast.warning('Task state did not change');
            } else {
                toast.success('Task updated');
            }
            await Promise.all([fetchHealth(), fetchTasks()]);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update liquidation task');
        } finally {
            setTaskActionId(null);
        }
    }, [adminHeaders, adminWallet, fetchHealth, fetchTasks]);

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
            || data.liquidation.taskStatus.blocked > 0
            || data.liquidation.taskStatus.failed > 0
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
                            onClick={refreshAll}
                            disabled={loading || taskLoading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-60"
                        >
                            <RefreshCw className={`w-4 h-4 ${(loading || taskLoading) ? 'animate-spin' : ''}`} />
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
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <h2 className="text-white font-semibold">Liquidation Task Queue</h2>
                        <button
                            onClick={fetchTasks}
                            disabled={taskLoading}
                            className="px-3 py-1 rounded-md bg-gray-800 text-gray-200 text-xs hover:bg-gray-700 disabled:opacity-60"
                        >
                            Refresh Tasks
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 text-sm">
                        <MetricLine label="Pending" value={String(tasksData?.summary.byStatus.pending ?? 0)} />
                        <MetricLine label="Retrying" value={String(tasksData?.summary.byStatus.retrying ?? 0)} />
                        <MetricLine label="Blocked" value={String(tasksData?.summary.byStatus.blocked ?? 0)} danger={(tasksData?.summary.byStatus.blocked ?? 0) > 0} />
                        <MetricLine label="Failed" value={String(tasksData?.summary.byStatus.failed ?? 0)} danger={(tasksData?.summary.byStatus.failed ?? 0) > 0} />
                        <MetricLine label="Due Now" value={String(tasksData?.summary.dueCount ?? 0)} />
                    </div>
                    {!tasksData || tasksData.tasks.length === 0 ? (
                        <p className="text-sm text-gray-400">No actionable liquidation tasks.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-gray-400 border-b border-gray-800">
                                    <tr>
                                        <th className="py-2">Subscription</th>
                                        <th className="py-2">Token</th>
                                        <th className="py-2">Status</th>
                                        <th className="py-2">Attempts</th>
                                        <th className="py-2">Next Retry</th>
                                        <th className="py-2">Error</th>
                                        <th className="py-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-200">
                                    {tasksData.tasks.map((task) => (
                                        <tr key={task.id} className="border-b border-gray-800/70 align-top">
                                            <td className="py-2 font-mono text-xs">{task.subscriptionId}</td>
                                            <td className="py-2 font-mono text-xs">{task.tokenId}</td>
                                            <td className="py-2">
                                                <span className={`px-2 py-0.5 rounded-full text-xs ${task.status === 'FAILED' || task.status === 'BLOCKED' ? 'bg-red-900/40 text-red-200' : 'bg-gray-800 text-gray-200'}`}>
                                                    {task.status}
                                                </span>
                                            </td>
                                            <td className="py-2">{task.attemptCount}</td>
                                            <td className="py-2 text-xs">
                                                {task.nextRetryAt ? new Date(task.nextRetryAt).toLocaleString() : 'now'}
                                            </td>
                                            <td className="py-2 text-xs text-gray-400 max-w-[280px]">
                                                {task.errorCode || task.errorMessage || '--'}
                                            </td>
                                            <td className="py-2">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => mutateTask(task.id, 'retry')}
                                                        disabled={Boolean(taskActionId)}
                                                        className="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-500 disabled:opacity-50"
                                                    >
                                                        {taskActionId === `retry:${task.id}` ? 'Retrying...' : 'Retry'}
                                                    </button>
                                                    <button
                                                        onClick={() => mutateTask(task.id, 'requeue')}
                                                        disabled={Boolean(taskActionId)}
                                                        className="px-2 py-1 rounded bg-gray-700 text-gray-100 text-xs hover:bg-gray-600 disabled:opacity-50"
                                                    >
                                                        {taskActionId === `requeue:${task.id}` ? 'Requeueing...' : 'Requeue'}
                                                    </button>
                                                    <button
                                                        onClick={() => mutateTask(task.id, 'fail')}
                                                        disabled={Boolean(taskActionId)}
                                                        className="px-2 py-1 rounded bg-red-700 text-red-100 text-xs hover:bg-red-600 disabled:opacity-50"
                                                    >
                                                        {taskActionId === `fail:${task.id}` ? 'Failing...' : 'Fail'}
                                                    </button>
                                                </div>
                                            </td>
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

                {(data || tasksData) && (
                    <p className="text-xs text-gray-500">
                        Last updated: {new Date((data?.generatedAt || tasksData?.generatedAt) as string).toLocaleString()}
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
