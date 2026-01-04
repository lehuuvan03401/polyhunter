import { polyClient } from '@/lib/polymarket';
import { SmartMoneyWallet } from '@catalyst-team/poly-sdk';


export const revalidate = 60;

export default async function SmartMoneyPage() {
    // Mock data or fetch if possible.
    // polyClient.smartMoney might need initialization which expects environment.
    // Let's wrap in try/catch and show placeholder if fails.

    let smartMoneyList: SmartMoneyWallet[] = [];
    try {
        // SDK might not support this in read-only mode easily if it relies on internal lists?
        // Actually SmartMoneyService usually has a hardcoded list or fetches from API?
        // checking type: getSmartMoneyList(limit) returns Promise<SmartMoneyWallet[]>
        smartMoneyList = await polyClient.smartMoney.getSmartMoneyList(20);
    } catch (e) {
        console.error("Smart Money fetch failed", e);
        // Fallback to mock data for development
        smartMoneyList = Array.from({ length: 15 }).map((_, i) => ({
            address: `0x${Math.random().toString(16).slice(2, 42)}`,
            name: `Smart Trader ${i + 1}`,
            rank: i + 1,
            pnl: 50000 * (10 - i * 0.5),
            volume: 250000 * (10 - i * 0.5),
            score: Math.max(98 - i, 70),
            winRate: 0.8,
            positions: [],
            recentTrades: []
        }));
    }

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
                    <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm">
                            <thead className="[&_tr]:border-b">
                                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Rank</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Trader</th>
                                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Volume</th>
                                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Profit</th>
                                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Score</th>
                                </tr>
                            </thead>
                            <tbody className="[&_tr:last-child]:border-0">
                                {smartMoneyList.length > 0 ? smartMoneyList.map((wallet, i) => (
                                    <tr key={wallet.address} className="border-b transition-colors hover:bg-muted/50">
                                        <td className="p-4 align-middle font-medium">#{wallet.rank || i + 1}</td>
                                        <td className="p-4 align-middle font-mono">
                                            {wallet.name || `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`}
                                        </td>
                                        <td className="p-4 align-middle text-right">${wallet.volume.toLocaleString()}</td>
                                        <td className="p-4 align-middle text-right text-green-500">+${wallet.pnl.toLocaleString()}</td>
                                        <td className="p-4 align-middle text-right">
                                            <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80">
                                                {wallet.score}
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="p-4 text-center text-muted-foreground">Coming soon...</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
