'use client';

import type { ReactNode } from 'react';
import { Crown, Gift, Layers, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SAME_LEVEL_BONUS_RATES } from '@/lib/participation-program/bonuses';
import { PARTICIPATION_LEVEL_RULES } from '@/lib/participation-program/levels';
import {
    DEFAULT_PARTNER_MAX_SEATS,
    DEFAULT_PARTNER_PRIVILEGE_LEVEL,
    MONTHLY_ELIMINATION_COUNT,
    REFUND_SLA_DAYS,
} from '@/lib/participation-program/partner-program';
import { PARTICIPATION_MINIMUMS, REALIZED_PROFIT_FEE_RATE } from '@/lib/participation-program/rules';

type AffiliateExternalRulesSectionProps = {
    className?: string;
};

export function AffiliateExternalRulesSection({ className }: AffiliateExternalRulesSectionProps) {
    const sameLevelRows = Object.entries(SAME_LEVEL_BONUS_RATES)
        .map(([generation, rate]) => ({
            generation: Number(generation),
            rate,
        }))
        .sort((a, b) => a.generation - b.generation);

    return (
        <section className={cn('rounded-2xl border border-white/10 bg-[#1a1b1e] p-6', className)}>
            <div className="mb-6">
                <h2 className="text-xl font-bold text-white">Official Affiliate & Partner Rules</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Formal external policy for referral incentives, team dividends, and global partner governance.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <RuleCard
                    icon={<Gift className="h-4 w-4 text-emerald-300" />}
                    title="Direct Referral Reward"
                    value="+1 day subscription extension"
                    note="Triggered once when a direct referral completes first qualified participation."
                />
                <RuleCard
                    icon={<TrendingUp className="h-4 w-4 text-blue-300" />}
                    title="Performance Basis"
                    value="Net deposit = deposit - withdraw"
                    note={`Entry thresholds: FREE >= ${PARTICIPATION_MINIMUMS.FREE}U, MANAGED >= ${PARTICIPATION_MINIMUMS.MANAGED}U`}
                />
                <RuleCard
                    icon={<ShieldCheck className="h-4 w-4 text-yellow-300" />}
                    title="Profit Fee Policy"
                    value={`${(REALIZED_PROFIT_FEE_RATE * 100).toFixed(0)}% on realized profit`}
                    note="No profit means zero fee."
                />
            </div>

            <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
                <table className="min-w-full text-sm">
                    <thead className="bg-white/5 text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium">Level</th>
                            <th className="px-4 py-3 text-left font-medium">Team Net Deposit Threshold</th>
                            <th className="px-4 py-3 text-left font-medium">Team Profit Dividend</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {PARTICIPATION_LEVEL_RULES.map((rule) => (
                            <tr key={rule.level} className="text-zinc-200">
                                <td className="px-4 py-3 font-semibold text-white">{rule.level}</td>
                                <td className="px-4 py-3 font-mono">{`${rule.minNetDepositUsd.toLocaleString()}U`}</td>
                                <td className="px-4 py-3 font-mono">{`${(rule.dividendRate * 100).toFixed(0)}%`}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                        <Layers className="h-4 w-4" />
                        Same-level bonus settlement
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                        {sameLevelRows.map((row) => (
                            <li key={row.generation}>
                                {`Generation ${row.generation}: ${(row.rate * 100).toFixed(0)}%`}
                            </li>
                        ))}
                        <li>Promotion path follows one-push-two double-zone progression up to V9.</li>
                    </ul>
                </div>

                <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-yellow-300">
                        <Crown className="h-4 w-4" />
                        Global partner plan
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                        <li>{`Seat cap: ${DEFAULT_PARTNER_MAX_SEATS} global seats (hard cap).`}</li>
                        <li>{`Monthly elimination: bottom ${MONTHLY_ELIMINATION_COUNT} seats.`}</li>
                        <li>{`Refund SLA: within ${REFUND_SLA_DAYS} days after elimination.`}</li>
                        <li>{`Partner privileges: ${DEFAULT_PARTNER_PRIVILEGE_LEVEL}-equivalent rights + dedicated backend access.`}</li>
                    </ul>
                </div>
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-200">
                <Users className="h-4 w-4 shrink-0" />
                All USDT-denominated policy items are settled via MCN-equivalent in/out channels.
            </div>
        </section>
    );
}

function RuleCard({
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
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="inline-flex items-center gap-2 rounded-md bg-white/5 px-2 py-1 text-xs text-zinc-300">
                {icon}
                {title}
            </div>
            <p className="mt-3 text-sm font-medium text-white">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{note}</p>
        </div>
    );
}
