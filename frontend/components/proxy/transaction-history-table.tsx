'use client';
import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, ArrowUpRight, ArrowDownLeft, ExternalLink } from 'lucide-react';
import { formatUSD } from '@/lib/utils';
import { useTranslations, useFormatter } from 'next-intl';

interface Transaction {
    id: string;
    type: 'DEPOSIT' | 'WITHDRAW';
    amount: number;
    txHash: string | null;
    status: string;
    createdAt: string;
}

interface TransactionHistoryTableProps {
    refreshTrigger?: number;
}

export function TransactionHistoryTable({ refreshTrigger = 0 }: TransactionHistoryTableProps) {
    const t = useTranslations('Portfolio.transactionHistory');
    const format = useFormatter();
    const { user, authenticated } = usePrivy();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!authenticated || !user?.wallet?.address) return;

        const fetchHistory = async () => {
            try {
                const res = await fetch(`/api/proxy/transactions?walletAddress=${user.wallet?.address}`);
                const data = await res.json();
                if (data.success) {
                    setTransactions(data.data);
                }
            } catch (error) {
                console.error('Failed to fetch history:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [authenticated, user?.wallet?.address, refreshTrigger]);

    if (!authenticated) return null;

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (transactions.length === 0) {
        return (
            <div className="text-center p-8 text-muted-foreground border rounded-lg border-dashed">
                {t('empty')}
            </div>
        );
    }

    return (
        <div className="w-full overflow-hidden rounded-lg border shadow-sm">
            <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                        <th className="px-4 py-3 font-medium">{t('headers.type')}</th>
                        <th className="px-4 py-3 font-medium">{t('headers.amount')}</th>
                        <th className="px-4 py-3 font-medium">{t('headers.status')}</th>
                        <th className="px-4 py-3 font-medium">{t('headers.date')}</th>
                        <th className="px-4 py-3 font-medium text-right">{t('headers.hash')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-muted/50 transition-colors">
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                    {tx.type === 'DEPOSIT' ? (
                                        <div className="flex items-center gap-1.5 text-green-600 bg-green-500/10 px-2 py-1 rounded text-xs font-medium dark:text-green-400">
                                            <ArrowDownLeft className="h-3 w-3" />
                                            {t('types.deposit')}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-blue-600 bg-blue-500/10 px-2 py-1 rounded text-xs font-medium dark:text-blue-400">
                                            <ArrowUpRight className="h-3 w-3" />
                                            {t('types.withdraw')}
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="px-4 py-3 font-medium">
                                {formatUSD(tx.amount)}
                                <span className="text-xs text-muted-foreground ml-1">USDC</span>
                            </td>
                            <td className="px-4 py-3">
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                                    {tx.status}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                                {format.dateTime(new Date(tx.createdAt), {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: 'numeric'
                                })}
                            </td>
                            <td className="px-4 py-3 text-right">
                                {tx.txHash && (
                                    <a
                                        href={`https://polygonscan.com/tx/${tx.txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 hover:underline text-xs"
                                    >
                                        {tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
