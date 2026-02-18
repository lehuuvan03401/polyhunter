'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, Clock, Loader2, Receipt, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';

type TransactionEvent = {
    id: string;
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'MATURED';
    date: string;
    amount: number;
    productName: string;
    strategyProfile: string;
    termLabel: string;
    subscriptionId: string;
    status: 'COMPLETED' | 'PENDING';
    pnl?: number;
    pnlPct?: number;
};

interface ManagedTransactionHistoryProps {
    walletAddress: string;
}

const typeConfig = {
    DEPOSIT: {
        icon: ArrowDownLeft,
        colorClass: 'text-blue-400',
        bgClass: 'bg-blue-500/10 border-blue-500/20',
        badgeBg: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    },
    WITHDRAWAL: {
        icon: ArrowUpRight,
        colorClass: 'text-emerald-400',
        bgClass: 'bg-emerald-500/10 border-emerald-500/20',
        badgeBg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    },
    MATURED: {
        icon: CheckCircle2,
        colorClass: 'text-amber-400',
        bgClass: 'bg-amber-500/10 border-amber-500/20',
        badgeBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    },
};

export function ManagedTransactionHistory({ walletAddress }: ManagedTransactionHistoryProps) {
    const t = useTranslations('ManagedWealth.TransactionHistory');
    const tProducts = useTranslations('ManagedWealth.Products');
    const [transactions, setTransactions] = useState<TransactionEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTransactions = async () => {
            if (!walletAddress) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const res = await fetch(`/api/managed-subscriptions/transactions?wallet=${walletAddress}`);
                const data = await res.json();
                if (res.ok) {
                    setTransactions(data.transactions || []);
                }
            } catch (error) {
                console.error('Failed to fetch transactions:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTransactions();
    }, [walletAddress]);

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
        );
    }

    if (transactions.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center"
            >
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                    <Receipt className="h-6 w-6 text-zinc-600" />
                </div>
                <h3 className="text-lg font-medium text-white">{t('empty.title')}</h3>
                <p className="mt-1 text-sm text-zinc-500">{t('empty.desc')}</p>
            </motion.div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                <div className="col-span-2">{t('columns.date')}</div>
                <div className="col-span-2">{t('columns.type')}</div>
                <div className="col-span-3">{t('columns.product')}</div>
                <div className="col-span-2 text-right">{t('columns.amount')}</div>
                <div className="col-span-2 text-right">{t('columns.pnl')}</div>
                <div className="col-span-1 text-right">{t('columns.status')}</div>
            </div>

            <AnimatePresence mode="popLayout">
                {transactions.map((tx, index) => {
                    const config = typeConfig[tx.type];
                    const Icon = config.icon;
                    const isPositive = (tx.pnl ?? 0) >= 0;

                    return (
                        <motion.div
                            key={tx.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2, delay: index * 0.03 }}
                            className="rounded-xl border border-white/10 bg-[#121417] p-4 hover:border-white/20 transition-colors"
                        >
                            {/* Desktop */}
                            <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-2 text-sm text-zinc-400">
                                    {format(new Date(tx.date), 'MMM d, yyyy')}
                                    <div className="text-[10px] text-zinc-600">{format(new Date(tx.date), 'HH:mm')}</div>
                                </div>
                                <div className="col-span-2">
                                    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${config.badgeBg}`}>
                                        <Icon className="h-3 w-3" />
                                        {t(`types.${tx.type}`)}
                                    </span>
                                </div>
                                <div className="col-span-3">
                                    <div className="text-sm font-medium text-white truncate">
                                        {/* @ts-ignore */}
                                        {tProducts(`${tx.strategyProfile}.name`)}
                                    </div>
                                    <div className="text-[10px] text-zinc-500">{tx.termLabel}</div>
                                </div>
                                <div className="col-span-2 text-right">
                                    <span className={`font-mono text-sm font-bold ${tx.type === 'DEPOSIT' ? 'text-blue-400' : 'text-white'}`}>
                                        {tx.type === 'DEPOSIT' ? '-' : '+'}${tx.amount.toFixed(2)}
                                    </span>
                                </div>
                                <div className="col-span-2 text-right">
                                    {tx.pnl !== undefined ? (
                                        <div>
                                            <span className={`font-mono text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {isPositive ? '+' : ''}{tx.pnlPct?.toFixed(2)}%
                                            </span>
                                            <div className={`text-[10px] font-mono ${isPositive ? 'text-emerald-500/60' : 'text-red-500/60'}`}>
                                                {isPositive ? '+' : ''}${tx.pnl.toFixed(2)}
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-zinc-600">—</span>
                                    )}
                                </div>
                                <div className="col-span-1 text-right">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${tx.status === 'COMPLETED'
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                        }`}>
                                        {tx.status === 'COMPLETED' ? (
                                            <CheckCircle2 className="h-2.5 w-2.5" />
                                        ) : (
                                            <Clock className="h-2.5 w-2.5" />
                                        )}
                                        {t(`status.${tx.status}`)}
                                    </span>
                                </div>
                            </div>

                            {/* Mobile */}
                            <div className="md:hidden space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${config.bgClass}`}>
                                            <Icon className={`h-4 w-4 ${config.colorClass}`} />
                                        </div>
                                        <div>
                                            <span className={`text-xs font-semibold ${config.colorClass}`}>
                                                {t(`types.${tx.type}`)}
                                            </span>
                                            <div className="text-[10px] text-zinc-500">
                                                {format(new Date(tx.date), 'MMM d, yyyy')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-mono text-sm font-bold ${tx.type === 'DEPOSIT' ? 'text-blue-400' : 'text-white'}`}>
                                            {tx.type === 'DEPOSIT' ? '-' : '+'}${tx.amount.toFixed(2)}
                                        </div>
                                        {tx.pnl !== undefined && (
                                            <div className={`text-[10px] font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {isPositive ? '+' : ''}{tx.pnlPct?.toFixed(2)}%
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-400 truncate">
                                        {/* @ts-ignore */}
                                        {tProducts(`${tx.strategyProfile}.name`)}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${tx.status === 'COMPLETED'
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                        }`}>
                                        {t(`status.${tx.status}`)}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
