import { polyClient } from '@/lib/polymarket';
import { SmartMoneyWallet } from '@catalyst-team/poly-sdk';
import Link from 'next/link';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { ProxyWalletCard } from '@/components/proxy/proxy-wallet-card';

export const revalidate = 60;

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

interface SmartMoneyPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SmartMoneyPage({ searchParams }: SmartMoneyPageProps) {
    const resolvedParams = await searchParams;
    const page = typeof resolvedParams.page === 'string' ? parseInt(resolvedParams.page) : 1;
    const currentPage = isNaN(page) || page < 1 ? 1 : page;

    const { data: smartMoneyList, error } = await fetchSmartMoneyData(currentPage);

    // Pagination logic
    const hasNextPage = (smartMoneyList?.length || 0) === ITEMS_PER_PAGE && currentPage < MAX_PAGES;
    const hasPrevPage = currentPage > 1;

    return (
        <div className="container py-10">
            <div className="mb-8 space-y-4 text-center">
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                    Automate Your Edge
                </h1>
                <p className="text-muted-foreground text-lg">
                    Discover and follow the most profitable traders on Polymarket.
                </p>
                <div className="flex justify-center gap-4">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500"></span> Live Updates</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500"></span> Verified Data</span>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Sidebar: Proxy Wallet */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    <ProxyWalletCard />

                    {/* Additional Sidebar Content (optional) */}
                    <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                        <h3 className="font-semibold text-foreground mb-2">How it works</h3>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Create your Smart Wallet proxy.</li>
                            <li>Deposit USDC funds.</li>
                            <li>Select a trader to copy.</li>
                            <li>The bot executes trades for you.</li>
                            <li>Withdraw profits anytime.</li>
                        </ul>
                    </div>
                </div>

                {/* Main Content: Leaderboard */}
                <div className="col-span-12 lg:col-span-8">
                    <div className="rounded-xl border bg-card shadow-sm">
                        <div className="border-b p-6 flex justify-between items-center">
                            <h2 className="text-lg font-semibold">Top Performers</h2>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                Page {currentPage}
                            </span>
                        </div>
                        <div className="p-0">
                            {error ? (
                                /* Error State */
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
                            ) : smartMoneyList && smartMoneyList.length > 0 ? (
                                /* Data Table */
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
                                                        <td className="p-4 align-middle font-medium">#{wallet.rank || ((currentPage - 1) * ITEMS_PER_PAGE + i + 1)}</td>
                                                        <td className="p-4 align-middle font-mono">
                                                            <Link href={`/traders/${wallet.address}`} className="hover:text-blue-400 transition-colors hover:underline">
                                                                {wallet.name || `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`}
                                                            </Link>
                                                        </td>
                                                        <td className="p-4 align-middle text-right">${wallet.volume.toLocaleString()}</td>
                                                        <td className="p-4 align-middle text-right text-green-500">+${wallet.pnl.toLocaleString()}</td>
                                                        <td className="p-4 align-middle text-right">
                                                            <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80">
                                                                {wallet.score}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-middle text-right">
                                                            <Link
                                                                href={`/traders/${wallet.address}`}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                                                            >
                                                                Copy Trader
                                                            </Link>
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
                            ) : (
                                /* Empty State */
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <p className="text-muted-foreground">No traders found on this page.</p>
                                    {currentPage > 1 && (
                                        <Link href="/smart-money" className="mt-4 text-blue-500 hover:underline">
                                            Go back to first page
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
