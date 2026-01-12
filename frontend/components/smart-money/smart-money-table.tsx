'use client';

import { polyClient } from '@/lib/polymarket';
import { SmartMoneyWallet } from '@catalyst-team/poly-sdk';
import Link from 'next/link';
import { AlertCircle, RefreshCcw, Wallet } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 20;
const MAX_PAGES = 5;

async function fetchSmartMoneyData(page: number): Promise<{ data: SmartMoneyWallet[] | null; error: string | null }> {
    try {
        const smartMoneyList = await polyClient.smartMoney.getSmartMoneyList({ page, limit: ITEMS_PER_PAGE });
        return { data: smartMoneyList, error: null };
    } catch (e) {
        console.error("Smart Money fetch failed", e);
        return { data: null, error: "Failed to load trader data. Please try again." };
    }
}

interface SmartMoneyTableProps {
    currentPage: number;
}

export function SmartMoneyTable({ currentPage }: SmartMoneyTableProps) {
    const { authenticated, login, ready } = usePrivy();
    const [data, setData] = useState<SmartMoneyWallet[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            const result = await fetchSmartMoneyData(currentPage);
            setData(result.data);
            setError(result.error);
            setIsLoading(false);
        };
        loadData();
    }, [currentPage]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <RefreshCcw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const smartMoneyList = data;

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
                    <h3 className="font-medium text-lg mb-1">Unable to Load Traders</h3>
                    <p className="text-muted-foreground text-sm max-w-md">{error}</p>
                </div>
                <Link
                    href="/smart-money"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
                >
                    <RefreshCcw className="h-4 w-4" /> Retry
                </Link>
            </div>
        );
    }

    if (!smartMoneyList || smartMoneyList.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-muted-foreground">No traders found on this page.</p>
                {currentPage > 1 && (
                    <Link href="/smart-money" className="mt-4 text-blue-500 hover:underline">
                        Go back to first page
                    </Link>
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
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Rank</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Trader</th>
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Volume</th>
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Profit</th>
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Score</th>
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Action</th>
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
                                            Copy Trader
                                        </Link>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                toast('Please connect your wallet to copy traders', {
                                                    description: 'You need to sign in to use copy trading features',
                                                    action: {
                                                        label: 'Connect Wallet',
                                                        onClick: () => login(),
                                                    },
                                                });
                                            }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/50 hover:bg-blue-600 text-white/70 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                                        >
                                            <Wallet className="h-3 w-3" />
                                            Connect to Copy
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
                <Link
                    href={hasPrevPage ? `/smart-money?page=${currentPage - 1}` : '#'}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border bg-card transition-colors ${hasPrevPage
                        ? "hover:bg-muted hover:text-foreground text-foreground"
                        : "pointer-events-none opacity-50 text-muted-foreground"
                        }`}
                    aria-disabled={!hasPrevPage}
                >
                    Previous
                </Link>
                <span className="text-sm text-muted-foreground">
                    Page {currentPage}
                </span>
                <Link
                    href={hasNextPage ? `/smart-money?page=${currentPage + 1}` : '#'}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border bg-card transition-colors ${hasNextPage
                        ? "hover:bg-muted hover:text-foreground text-foreground"
                        : "pointer-events-none opacity-50 text-muted-foreground"
                        }`}
                    aria-disabled={!hasNextPage}
                >
                    Next
                </Link>
            </div>
        </>
    );
}
