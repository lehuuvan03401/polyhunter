import { polyClient } from '@/lib/polymarket';
import { notFound } from 'next/navigation';
import { Position, WalletActivitySummary } from '@catalyst-team/poly-sdk'; // Assuming export, if not I might need to check exports
// If Position is not exported from index, I might need to import from generic types or just use any.
// Based on previous files, many types are exported from index.

export const revalidate = 60;

export default async function PortfolioPage() {
    // DEMO MODE: Fetch a top trader to show as example
    let demoAddress = '';
    let portfolioValue = 0;
    let positions: any[] = []; // Type issue potential, will use any for safety first then refine
    let activity: any[] = [];

    try {
        const topTraders = await polyClient.smartMoney.getSmartMoneyList(1);
        if (topTraders.length > 0) {
            demoAddress = topTraders[0].address;

            // Fetch their profile
            const profile = await polyClient.wallets.getWalletProfile(demoAddress);
            portfolioValue = profile.totalPnL; // This is PnL, not total value, but good enough proxy for "Performance"

            // Fetch their positions
            positions = await polyClient.wallets.getWalletPositions(demoAddress);

            // Fetch activity
            const actSummary = await polyClient.wallets.getWalletActivity(demoAddress);
            activity = actSummary.activities.slice(0, 10);
        }
    } catch (e) {
        console.error("Failed to fetch demo portfolio", e);
    }

    return (
        <div className="container py-10">
            <div className="mb-8 flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
                    <p className="text-muted-foreground">
                        Viewing demo portfolio for <span className="font-mono text-primary">{demoAddress}</span>
                    </p>
                </div>
                <div>
                    <button className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                        Connect Wallet
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3 mb-8">
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Total PnL</div>
                    <div className="mt-2 text-3xl font-bold text-green-500">+${portfolioValue?.toLocaleString()}</div>
                </div>
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Active Positions</div>
                    <div className="mt-2 text-3xl font-bold">{positions.length}</div>
                </div>
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Recent Activity</div>
                    <div className="mt-2 text-3xl font-bold">{activity.length} Trades</div>
                </div>
            </div>

            {/* Positions Table */}
            <div className="mb-8 rounded-xl border bg-card shadow-sm">
                <div className="border-b p-6">
                    <h2 className="text-lg font-semibold">Active Positions</h2>
                </div>
                <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50">
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Market</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Outcome</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Size</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Avg Price</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Current Price</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">PnL</th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {positions.length > 0 ? positions.map((pos, i) => (
                                <tr key={i} className="border-b transition-colors hover:bg-muted/50">
                                    <td className="p-4 align-middle max-w-[300px] truncate" title={pos.title}>{pos.title}</td>
                                    <td className="p-4 align-middle font-medium text-primary">{pos.outcome}</td>
                                    <td className="p-4 align-middle text-right">{pos.size.toFixed(2)}</td>
                                    <td className="p-4 align-middle text-right">${pos.avgPrice.toFixed(2)}</td>
                                    <td className="p-4 align-middle text-right">${pos.currentPrice?.toFixed(2) || '-'}</td>
                                    <td className={`p-4 align-middle text-right font-medium ${pos.percentPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {pos.percentPnl >= 0 ? '+' : ''}{(pos.percentPnl * 100).toFixed(2)}%
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-muted-foreground">No active positions found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-xl border bg-card shadow-sm">
                <div className="border-b p-6">
                    <h2 className="text-lg font-semibold">Recent Activity</h2>
                </div>
                <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50">
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Type</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Market</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Amount</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Price</th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {activity.length > 0 ? activity.map((act, i) => (
                                <tr key={i} className="border-b transition-colors hover:bg-muted/50">
                                    <td className="p-4 align-middle">{new Date(act.timestamp * 1000).toLocaleDateString()}</td>
                                    <td className="p-4 align-middle">
                                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${act.side === 'BUY' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                            {act.side} {act.outcome}
                                        </span>
                                    </td>
                                    <td className="p-4 align-middle max-w-[300px] truncate">{act.name || act.marketSlug}</td>
                                    <td className="p-4 align-middle text-right">{act.size?.toFixed(2)}</td>
                                    <td className="p-4 align-middle text-right">${act.price?.toFixed(2)}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-muted-foreground">No recent activity.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
