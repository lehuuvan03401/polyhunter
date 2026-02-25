'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    PARTICIPATION_STRATEGY_LABEL_KEYS,
    PARTICIPATION_STRATEGIES,
    type ParticipationStrategyValue,
} from '@/lib/participation-program/rules';

type ManagedMatrixRow = {
    principalBand: 'A' | 'B' | 'C';
    minPrincipalUsd: number;
    maxPrincipalUsd: number;
    termDays: number;
    strategyProfile: ParticipationStrategyValue;
    returnMin: number;
    returnMax: number;
    returnUnit: 'PERCENT' | 'MULTIPLIER';
    displayRange?: string;
};

type ParticipationRulesResponse = {
    version: string;
    fundingChannels: string[];
    strategies: ParticipationStrategyValue[];
    servicePeriodsDays: number[];
    minimums: {
        FREE: number;
        MANAGED: number;
        unit: string;
    };
    feePolicy: {
        onlyProfitFee: boolean;
        noProfitNoFee: boolean;
        realizedProfitFeeRate: number;
    };
    settlementPolicy?: {
        usdtRulesUseMcnEquivalent?: boolean;
    };
    managedReturnMatrixByBand?: Record<'A' | 'B' | 'C', ManagedMatrixRow[]>;
};

type ManagedExternalRulesSectionProps = {
    className?: string;
};

const BAND_ORDER: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];

const FUNDING_CHANNEL_LABELS: Record<string, string> = {
    EXCHANGE: 'Exchange Funding',
    TP_WALLET: 'TP Wallet Funding',
};

function formatRange(row: ManagedMatrixRow): string {
    if (row.displayRange) {
        return row.displayRange;
    }
    if (row.returnUnit === 'MULTIPLIER') {
        return `${row.returnMin.toFixed(2)}x - ${row.returnMax.toFixed(2)}x`;
    }
    const min = row.returnMin.toFixed(2).replace(/\.00$/, '');
    const max = row.returnMax.toFixed(2).replace(/\.00$/, '');
    return `${min}% - ${max}%`;
}

function buildBandTableRows(rows: ManagedMatrixRow[]) {
    const byTerm = new Map<number, { termDays: number; ranges: Record<ParticipationStrategyValue, string> }>();

    for (const row of rows) {
        const existing = byTerm.get(row.termDays) ?? {
            termDays: row.termDays,
            ranges: {
                CONSERVATIVE: '-',
                MODERATE: '-',
                AGGRESSIVE: '-',
            },
        };

        existing.ranges[row.strategyProfile] = formatRange(row);
        byTerm.set(row.termDays, existing);
    }

    return Array.from(byTerm.values()).sort((a, b) => a.termDays - b.termDays);
}

function formatTerm(days: number): string {
    if (days === 1) return '1-day trial';
    return `${days} days`;
}

export function ManagedExternalRulesSection({ className }: ManagedExternalRulesSectionProps) {
    const [rules, setRules] = useState<ParticipationRulesResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadRules() {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/participation/rules', { cache: 'no-store' });
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data?.error || 'Failed to fetch participation rules');
                }
                if (!cancelled) {
                    setRules(data as ParticipationRulesResponse);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to fetch participation rules');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        loadRules();
        return () => {
            cancelled = true;
        };
    }, []);

    const servicePeriods = useMemo(
        () => (rules ? [...rules.servicePeriodsDays].sort((a, b) => a - b).map(formatTerm) : []),
        [rules]
    );

    return (
        <section className={cn('rounded-3xl border border-white/10 bg-[#0A0B0E]/60 p-6 md:p-8', className)}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-white">Official Participation Rules</h2>
                    <p className="mt-1 text-sm text-zinc-400">
                        Formal external version for entry thresholds, fee policy, and managed return matrix.
                    </p>
                </div>
                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                    {rules?.version ? `v${rules.version}` : 'latest'}
                </span>
            </div>

            {isLoading ? (
                <div className="mt-6 flex items-center gap-2 text-sm text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading official policy rules...
                </div>
            ) : null}

            {error ? (
                <div className="mt-6 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            ) : null}

            {rules ? (
                <>
                    <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <RuleCard
                            title="Funding Channels"
                            value={rules.fundingChannels.map((channel) => FUNDING_CHANNEL_LABELS[channel] ?? channel).join(' / ')}
                            note="USDT-denominated rules are settled through MCN-equivalent channels."
                        />
                        <RuleCard
                            title="Activation Gate"
                            value="Registration + Qualified Funding"
                            note={`FREE >= ${rules.minimums.FREE}U, MANAGED >= ${rules.minimums.MANAGED}U (MCN equivalent)`}
                        />
                        <RuleCard
                            title="Service Periods"
                            value={servicePeriods.join(' / ')}
                            note={`Strategies: ${rules.strategies
                                .map((strategy) => PARTICIPATION_STRATEGY_LABEL_KEYS[strategy])
                                .join(' / ')}`}
                        />
                        <RuleCard
                            title="Profit Fee"
                            value={`${(rules.feePolicy.realizedProfitFeeRate * 100).toFixed(0)}% on realized profit`}
                            note="No profit => no fee."
                        />
                        <RuleCard
                            title="FREE Mode"
                            value="User-controlled execution scope"
                            note="Platform cannot move principal outside authorization."
                        />
                        <RuleCard
                            title="MANAGED Mode"
                            value="Custody authorization required"
                            note="Explicit authorization proof and audit trail are required."
                        />
                    </div>

                    <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                            <ShieldCheck className="h-4 w-4" />
                            Asset safety boundary
                        </div>
                        <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                            <li>1. User assets remain in user account/wallet through the full lifecycle.</li>
                            <li>2. Platform has no authority to transfer user principal in FREE mode.</li>
                            <li>3. MANAGED actions are limited to explicit custody authorization scope.</li>
                        </ul>
                    </div>

                    <div className="mt-8 space-y-5">
                        <h3 className="text-base font-semibold text-white">Managed Package Yield Matrix</h3>

                        {BAND_ORDER.map((band) => {
                            const rows = rules.managedReturnMatrixByBand?.[band] ?? [];
                            if (rows.length === 0) {
                                return null;
                            }

                            const tableRows = buildBandTableRows(rows);
                            const first = rows[0];
                            const rangeLabel = `${first.minPrincipalUsd.toLocaleString()}U - ${first.maxPrincipalUsd.toLocaleString()}U`;

                            return (
                                <div key={band} className="overflow-hidden rounded-2xl border border-white/10">
                                    <div className="border-b border-white/10 bg-white/5 px-4 py-3">
                                        <p className="text-sm font-medium text-white">{`Band ${band}`}</p>
                                        <p className="text-xs text-zinc-400">{rangeLabel}</p>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-black/20 text-xs text-zinc-400">
                                                <tr>
                                                    <th className="px-4 py-3 text-left font-medium">Cycle</th>
                                                    {PARTICIPATION_STRATEGIES.map((strategy) => (
                                                        <th key={strategy} className="px-4 py-3 text-left font-medium">
                                                            {PARTICIPATION_STRATEGY_LABEL_KEYS[strategy]}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {tableRows.map((row) => (
                                                    <tr key={row.termDays} className="text-zinc-200">
                                                        <td className="px-4 py-3 text-zinc-300">{formatTerm(row.termDays)}</td>
                                                        {PARTICIPATION_STRATEGIES.map((strategy) => (
                                                            <td key={`${row.termDays}-${strategy}`} className="px-4 py-3 font-mono text-xs sm:text-sm">
                                                                {row.ranges[strategy]}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : null}
        </section>
    );
}

function RuleCard({ title, value, note }: { title: string; value: string; note: string }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">{title}</p>
            <p className="mt-2 text-sm font-medium text-white">{value}</p>
            <p className="mt-1 text-xs text-zinc-400">{note}</p>
        </div>
    );
}
