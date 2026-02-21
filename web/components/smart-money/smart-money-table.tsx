'use client';

import { SmartMoneyWallet } from '@catalyst-team/poly-sdk';
import Link from 'next/link';
import { AlertCircle, RefreshCcw, Wallet, Loader2, Info } from 'lucide-react';
import { usePrivyLogin } from '@/lib/privy-login';
import { toast } from 'sonner';
import { TableSkeleton } from './table-skeleton';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';

// Tooltip component for metric explanations
function MetricTooltip({ label, description }: { label: string; description: string }) {
    return (
        <div className="group relative inline-flex items-center gap-1 cursor-help normal-case">
            <span>{label}</span>
            <Info className="h-3 w-3 text-muted-foreground" />
            <div className="text-left absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border rounded text-xs text-popover-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {description}
            </div>
        </div>
    );
}

const ITEMS_PER_PAGE = 20;
const MAX_PAGES = 5;

const fetcher = (url: string) => fetch(url).then((res) => {
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
});

interface SmartMoneyTableProps {
    currentPage: number;
    onPageChange: (page: number) => void;
}

export function SmartMoneyTable({ currentPage, onPageChange }: SmartMoneyTableProps) {
    const t = useTranslations('SmartMoney.table');
    const { authenticated, login, ready, isLoggingIn } = usePrivyLogin();

    // Use SWR for caching and "keepPreviousData" behavior
    const { data: result, error, isLoading, mutate } = useSWR(
        `/api/traders/smart-money?page=${currentPage}&limit=${ITEMS_PER_PAGE}`,
        fetcher,
        {
            keepPreviousData: true, // Show previous page data while loading new page
            revalidateOnFocus: false, // Don't revalidate aggressively on window focus
            dedupingInterval: 3600000, // Cache for 1 hour
        }
    );

    const smartMoneyList: SmartMoneyWallet[] | undefined = result?.traders;

    // Show skeleton only on initial load (no data yet)
    if (isLoading && !smartMoneyList) {
        return <TableSkeleton />;
    }

    // Pagination logic
    const hasNextPage = (smartMoneyList?.length || 0) === ITEMS_PER_PAGE && currentPage < MAX_PAGES;
    const hasPrevPage = currentPage > 1;

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-red-500" />
                </div>
                <div>
                    <h3 className="font-medium text-lg mb-1">{t('errorTitle')}</h3>
                    <p className="text-muted-foreground text-sm max-w-md">{t('errorDesc')}</p>
                </div>
                <button
                    onClick={() => mutate()} // Retry by re-triggering SWR
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
                >
                    <RefreshCcw className="h-4 w-4" /> {t('retry')}
                </button>
            </div>
        );
    }

    if (!smartMoneyList || smartMoneyList.length === 0) {
        if (isLoading) return <TableSkeleton />; // Fallback if somehow loading but no data

        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-muted-foreground">{t('noTraders')}</p>
                {currentPage > 1 && (
                    <button
                        onClick={() => onPageChange(1)}
                        className="mt-4 text-blue-500 hover:underline"
                    >
                        {t('goBack')}
                    </button>
                )}
            </div>
        );
    }

    return (
        <>
            <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                    <thead className="[&_tr]:border-b">
                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('rank')}</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('trader')}</th>
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">{t('volume')}</th>
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">{t('profit')}</th>
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                                <MetricTooltip label={t('score')} description={t('scoreDesc')} />
                            </th>
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">{t('action')}</th>
                        </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                        {smartMoneyList.map((wallet, i) => (
                            <tr key={wallet.address} className="border-b transition-colors hover:bg-muted/50">
                                <td className="p-4 align-middle font-medium whitespace-nowrap">#{wallet.rank || ((currentPage - 1) * ITEMS_PER_PAGE + i + 1)}</td>
                                <td className="p-4 align-middle font-mono whitespace-nowrap">
                                    <Link
                                        href={`/traders/${wallet.address}`}
                                        className="hover:text-blue-400 transition-colors hover:underline"
                                        title={wallet.name || wallet.address}
                                    >
                                        {(wallet.name || `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`).length > 20
                                            ? `${(wallet.name || `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`).slice(0, 20)}...`
                                            : (wallet.name || `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`)}
                                    </Link>
                                </td>
                                <td className="p-4 align-middle text-right whitespace-nowrap">${wallet.volume.toLocaleString()}</td>
                                <td className="p-4 align-middle text-right text-green-500 whitespace-nowrap">+${wallet.pnl.toLocaleString()}</td>
                                <td className="p-4 align-middle text-right whitespace-nowrap">
                                    <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80">
                                        {wallet.score}
                                    </div>
                                </td>
                                <td className="p-4 align-middle text-right whitespace-nowrap">
                                    {authenticated ? (
                                        <Link
                                            href={`/traders/${wallet.address}`}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                                        >
                                            {t('copyTrader')}
                                        </Link>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                toast(t('toastTitle'), {
                                                    description: t('toastDesc'),
                                                    action: {
                                                        label: t('toastAction'),
                                                        onClick: () => login(),
                                                    },
                                                });
                                            }}
                                            disabled={isLoggingIn}
                                            aria-busy={isLoggingIn}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/50 hover:bg-blue-600 text-white/70 hover:text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {isLoggingIn ? (
                                                <>
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                    {t('connecting')}
                                                </>
                                            ) : (
                                                <>
                                                    <Wallet className="h-3 w-3" />
                                                    {t('connectToCopy')}
                                                </>
                                            )}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between p-4 border-t">
                <button
                    onClick={() => hasPrevPage && onPageChange(currentPage - 1)}
                    disabled={!hasPrevPage}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border bg-card transition-colors ${hasPrevPage
                        ? "hover:bg-muted hover:text-foreground text-foreground cursor-pointer"
                        : "opacity-50 text-muted-foreground cursor-not-allowed"
                        }`}
                >
                    {t('previous')}
                </button>
                <span className="text-sm text-muted-foreground">
                    {t('page')} {currentPage}
                </span>
                <button
                    onClick={() => hasNextPage && onPageChange(currentPage + 1)}
                    disabled={!hasNextPage}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border bg-card transition-colors ${hasNextPage
                        ? "hover:bg-muted hover:text-foreground text-foreground cursor-pointer"
                        : "opacity-50 text-muted-foreground cursor-not-allowed"
                        }`}
                >
                    {t('next')}
                </button>
            </div>
        </>
    );
}
