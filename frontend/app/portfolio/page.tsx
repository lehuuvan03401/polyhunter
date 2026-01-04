import { polyClient } from '@/lib/polymarket';
import { SmartMoneyWallet } from '@catalyst-team/poly-sdk';
import {
    Wallet,
    TrendingUp,
    Zap,
    Users,
    ChevronRight,
    History,
    Layers,
    Copy,
    ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export const revalidate = 60;

export default async function PortfolioPage() {
    // Mock data for dashboard
    // "Starter" plan, $0.00 balance, no active copies
    // We can still try to fetch the demo address details if we want meaningful data in the 'positions' section
    // but for now let's match the "empty state" design from the screenshot first, 
    // maybe populate if data exists.

    let demoAddress = '';
    let portfolioValue = 0;
    let positions: any[] = [];

    try {
        const topTraders = await polyClient.smartMoney.getSmartMoneyList(1);
        if (topTraders.length > 0) {
            demoAddress = topTraders[0].address;
            const profile = await polyClient.wallets.getWalletProfile(demoAddress);
            portfolioValue = profile.totalPnL;
            positions = await polyClient.wallets.getWalletPositions(demoAddress);
        }
    } catch (e) {
        console.error("Failed to fetch demo portfolio", e);
    }

    // Determine if we show empty states or data
    const showEmpty = positions.length === 0;

    return (
        <div className="container max-w-7xl py-8">
            {/* Header */}
            <div className="mb-8 space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">
                    Monitor your portfolio and copy trading activity
                </p>
            </div>

            {/* Top Cards Grid */}
            <div className="grid gap-6 md:grid-cols-3 mb-8">

                {/* Wallet Card */}
                <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-between h-[220px]">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-blue-400 mb-4">
                            <Wallet className="h-4 w-4" />
                            <span>Your Wallet</span>
                        </div>
                        <div className="text-3xl font-bold tracking-tight mb-1">
                            ${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-lg text-muted-foreground font-normal">USDC</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/50 w-fit px-2 py-1 rounded">
                            <span>{demoAddress ? `${demoAddress.slice(0, 6)}...${demoAddress.slice(-4)}` : '0x...'}</span>
                            <Copy className="h-3 w-3 cursor-pointer hover:text-foreground" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <button className="flex items-center justify-center rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                            Deposit
                        </button>
                        <button className="flex items-center justify-center rounded-lg border border-input bg-transparent py-2 text-sm font-medium hover:bg-muted transition-colors">
                            Withdraw
                        </button>
                    </div>
                </div>

                {/* PnL Card */}
                <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-between h-[220px]">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-green-500">
                                <TrendingUp className="h-4 w-4" />
                                <span>Profit/Loss</span>
                            </div>
                            <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">All Time</div>
                        </div>
                        <div className="text-3xl font-bold tracking-tight text-green-500">
                            +${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>

                    {/* Fake Chart Line */}
                    <div className="mt-4 h-16 w-full flex items-end opacity-50">
                        <svg viewBox="0 0 100 20" className="w-full text-green-500 fill-green-500/20 stroke-current h-full" preserveAspectRatio="none">
                            <path d="M0 20 L0 15 Q 10 18, 20 12 T 40 10 T 60 14 T 80 5 T 100 2 L 100 20 Z" strokeWidth="0" />
                            <path d="M0 15 Q 10 18, 20 12 T 40 10 T 60 14 T 80 5 T 100 2" fill="none" strokeWidth="2" />
                        </svg>
                    </div>
                </div>

                {/* Plan Card */}
                <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-between h-[220px] relative overflow-hidden">
                    {/* Background Gradient Effect */}
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Zap className="h-4 w-4" />
                                <span>Your Plan</span>
                            </div>
                            <Zap className="h-5 w-5 text-yellow-500" />
                        </div>
                        <div className="text-2xl font-bold tracking-tight mb-1">Starter</div>
                        <div className="text-sm text-muted-foreground">10% profit fee</div>
                    </div>

                    <div className="mt-6 space-y-3">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Total Volume</span>
                            <span className="font-medium">$0.0k</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full w-[5%] bg-blue-500 rounded-full" />
                        </div>

                        <Link href="#" className="flex items-center text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">
                            View Plans <ChevronRight className="h-3 w-3 ml-0.5" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Content Split */}
            <div className="grid gap-6 lg:grid-cols-12">

                {/* Left: Active Copies (4 cols) */}
                <div className="lg:col-span-4 rounded-xl border bg-card shadow-sm flex flex-col h-[500px]">
                    <div className="p-6 border-b flex items-center justify-between">
                        <h3 className="font-semibold">Active Copies</h3>
                        <Link href="/smart-money" className="text-xs font-medium text-blue-400 hover:text-blue-300">
                            Discover Traders &gt;
                        </Link>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                            <Users className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="font-medium">No Active Copies</h4>
                            <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto">
                                Start copying top traders to update your portfolio
                            </p>
                        </div>
                        <Link href="/smart-money" className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                            Discover Traders
                        </Link>
                    </div>
                </div>

                {/* Right: Active Positions (8 cols) */}
                <div className="lg:col-span-8 rounded-xl border bg-card shadow-sm flex flex-col h-[500px]">
                    <div className="p-4 border-b flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <h3 className="font-semibold px-2">Active Positions</h3>
                            {/* Tabs */}
                            <div className="flex items-center rounded-lg bg-muted/50 p-1">
                                <button className="rounded px-3 py-1 text-xs font-medium bg-background shadow-sm text-foreground">
                                    Active <span className="ml-1 text-muted-foreground">{positions.length}</span>
                                </button>
                                <button className="rounded px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                                    History
                                </button>
                            </div>
                        </div>
                        <button className="text-xs font-medium text-muted-foreground hover:text-foreground border border-input rounded px-3 py-1.5 hover:bg-muted transition-colors">
                            Sell All Positions
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto">
                        {positions.length > 0 ? (
                            <table className="w-full caption-bottom text-sm">
                                <thead className="[&_tr]:border-b sticky top-0 bg-card z-10">
                                    <tr className="border-b transition-colors">
                                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs">Market</th>
                                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs">Outcome</th>
                                        <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground text-xs">Size</th>
                                        <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground text-xs">Price</th>
                                        <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground text-xs">PnL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {positions.map((pos, i) => (
                                        <tr key={i} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4 align-middle font-medium max-w-[200px] truncate" title={pos.title}>{pos.title}</td>
                                            <td className="p-4 align-middle">
                                                <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                                                    pos.outcome === 'YES' ? "bg-green-400/10 text-green-400 ring-green-400/20" : "bg-red-400/10 text-red-400 ring-red-400/20")}>
                                                    {pos.outcome}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle text-right font-mono text-xs">{pos.size.toFixed(2)}</td>
                                            <td className="p-4 align-middle text-right font-mono text-xs">${pos.currentPrice?.toFixed(2)}</td>
                                            <td className={cn("p-4 align-middle text-right font-mono text-xs", pos.percentPnl >= 0 ? "text-green-500" : "text-red-500")}>
                                                {pos.percentPnl >= 0 ? '+' : ''}{(pos.percentPnl * 100).toFixed(2)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center text-center space-y-3">
                                <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground">
                                    <Layers className="h-6 w-6" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-sm">No Active Positions</h4>
                                    <p className="text-xs text-muted-foreground mt-1 max-w-[250px] mx-auto">
                                        When traders you follow make moves, your positions will appear here.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
