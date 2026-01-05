import { polyClient } from '@/lib/polymarket';
import { SmartMoneyWallet } from '@catalyst-team/poly-sdk';
import Link from 'next/link';
import { AlertCircle, RefreshCcw } from 'lucide-react';

export const revalidate = 60;

async function fetchSmartMoneyData(): Promise<{ data: SmartMoneyWallet[] | null; error: string | null }> {
    try {
        const smartMoneyList = await polyClient.smartMoney.getSmartMoneyList(20);
        return { data: smartMoneyList, error: null };
    } catch (e) {
        console.error("Smart Money fetch failed", e);
        return { data: null, error: "Failed to load trader data. Please try again." };
    }
}

export default async function SmartMoneyPage() {
    const { data: smartMoneyList, error } = await fetchSmartMoneyData();

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

            <div className="rounded-xl border bg-card shadow-sm">
                <div className="border-b p-6">
                    <h2 className="text-lg font-semibold">Top Performers</h2>
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
                                            <td className="p-4 align-middle font-medium">#{wallet.rank || i + 1}</td>
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
                    ) : (
                        /* Empty State */
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <p className="text-muted-foreground">No traders found at the moment.</p>
                            <p className="text-xs text-muted-foreground mt-2">Check back later for updated rankings.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
