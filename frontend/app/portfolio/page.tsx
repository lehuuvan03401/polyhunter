'use client';

import { usePrivy } from '@privy-io/react-auth';
import { polyClient } from '@/lib/polymarket';
import {
    Wallet,
    TrendingUp,
    Zap,
    Users,
    ChevronRight,
    History,
    Layers,
    Copy,
    ArrowUpRight,
    Loader2,
    Coins
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useCopyTradingStore, type CopyTradingConfig } from '@/lib/copy-trading-store';
import { PendingTradesAlert } from '@/components/copy-trading/pending-trades-alert';

// USDC.e contract on Polygon (used by Polymarket)
const USDC_CONTRACT = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const USDC_ABI = ['function balanceOf(address) view returns (uint256)'];

export default function PortfolioPage() {
    const { user, authenticated, ready, login } = usePrivy();
    const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
    const [totalPnL, setTotalPnL] = useState(0);
    const [positions, setPositions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Get copy trading configs from Zustand store
    const copyConfigs = useCopyTradingStore((state) => state.configs);
    const removeConfig = useCopyTradingStore((state) => state.removeConfig);

    useEffect(() => {
        const loadData = async () => {
            if (!ready) return;

            setIsLoading(true);
            try {

                if (authenticated && user?.wallet?.address) {
                    const address = user.wallet.address;

                    // Save wallet address for copy trading modal
                    localStorage.setItem('privy:wallet_address', address.toLowerCase());

                    // Fetch USDC balance on-chain
                    try {
                        const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
                        const usdcContract = new ethers.Contract(USDC_CONTRACT, USDC_ABI, provider);
                        const rawBalance = await usdcContract.balanceOf(address);
                        // USDC has 6 decimals
                        const balance = Number(rawBalance) / 1e6;
                        setUsdcBalance(balance);
                    } catch (balanceErr) {
                        console.warn("Failed to fetch USDC balance", balanceErr);
                        setUsdcBalance(null);
                    }

                    try {
                        // Get Portfolio PnL
                        const profile = await polyClient.wallets.getWalletProfile(address);
                        setTotalPnL(profile.totalPnL);

                        // Get Positions
                        const walletPositions = await polyClient.wallets.getWalletPositions(address);
                        setPositions(walletPositions);
                    } catch (err) {
                        console.warn("Failed to fetch user data", err);
                    }
                } else {
                    // Not authenticated or no wallet
                    setUsdcBalance(null);
                    setTotalPnL(0);
                    setPositions([]);
                }
            } catch (e) {
                console.error("Dashboard load failed", e);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [ready, authenticated, user?.wallet?.address]);

    // Format address for display
    const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    if (!ready || isLoading) {
        return (
            <div className="container max-w-7xl py-8 flex items-center justify-center min-h-[500px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!authenticated) {
        return (
            <div className="container max-w-7xl py-12 flex flex-col items-center justify-center min-h-[500px] text-center space-y-4">
                <div className="h-16 w-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
                    <Wallet className="h-8 w-8 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold">Connect Your Wallet</h2>
                <p className="text-muted-foreground max-w-md">
                    Connect your wallet to view your portfolio, track positions, and manage copy trading.
                </p>
                <button
                    onClick={login}
                    className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                >
                    Connect Wallet
                </button>
            </div>
        )
    }

    const userAddress = user?.wallet?.address || '0x...';

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

                {/* Wallet Card - Now with real USDC balance */}
                <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-between h-[220px]">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-blue-400 mb-4">
                            <Wallet className="h-4 w-4" />
                            <span>Your Wallet</span>
                        </div>
                        <div className="text-3xl font-bold tracking-tight mb-1">
                            {usdcBalance !== null
                                ? `$${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '--'}
                            <span className="text-lg text-muted-foreground font-normal ml-1">USDC</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/50 w-fit px-2 py-1 rounded group cursor-pointer" onClick={() => navigator.clipboard.writeText(userAddress)}>
                            <span>{formatAddress(userAddress)}</span>
                            <Copy className="h-3 w-3 group-hover:text-white transition-colors" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <Link href="/dashboard/proxy" className="flex items-center justify-center rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                            Deposit
                        </Link>
                        <Link href="/dashboard/proxy" className="flex items-center justify-center rounded-lg border border-input bg-transparent py-2 text-sm font-medium hover:bg-muted transition-colors">
                            Withdraw
                        </Link>
                    </div>
                </div>

                {/* PnL Card - Now with real data */}
                <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-between h-[220px]">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-green-500">
                                <TrendingUp className="h-4 w-4" />
                                <span>Profit/Loss</span>
                            </div>
                            <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">All Time</div>
                        </div>
                        <div className={cn("text-3xl font-bold tracking-tight", totalPnL >= 0 ? "text-green-500" : "text-red-500")}>
                            {totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>

                    {/* Fake Chart Line (Keeping for visuals, could replace later) */}
                    <div className="mt-4 h-16 w-full flex items-end opacity-50">
                        <svg viewBox="0 0 100 20" className={cn("w-full h-full stroke-current", totalPnL >= 0 ? "text-green-500 fill-green-500/20" : "text-red-500 fill-red-500/20")} preserveAspectRatio="none">
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

                        <Link href="/pricing" className="flex items-center text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">
                            View Plans <ChevronRight className="h-3 w-3 ml-0.5" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Pending Copy Trades Alert */}
            {user?.wallet?.address && (
                <div className="mb-8">
                    <PendingTradesAlert walletAddress={user.wallet.address} />
                </div>
            )}

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

                    {copyConfigs.length > 0 ? (
                        <div className="flex-1 overflow-auto p-4 space-y-3">
                            {copyConfigs.map((config: CopyTradingConfig) => (
                                <div key={config.id} className="bg-muted/30 border border-border/50 rounded-lg p-4 flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-sm">{config.traderName || formatAddress(config.traderAddress)}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {config.mode === 'fixed_amount'
                                                ? `Fixed $${config.fixedAmount}/trade`
                                                : `${(config.sizeScale || 0) * 100}% of trades`}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {config.dryRun && (
                                            <span className="text-xs font-mono bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded">Demo</span>
                                        )}
                                        <button
                                            onClick={() => removeConfig(config.id)}
                                            className="text-xs font-mono bg-red-500/10 text-red-400 px-2 py-1 rounded hover:bg-red-500/20 transition-colors"
                                        >
                                            Stop
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
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
                    )}
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
                                            <td className="p-4 align-middle text-right font-mono text-xs">${(pos.curPrice || pos.avgPrice)?.toFixed(2)}</td>
                                            <td className={cn("p-4 align-middle text-right font-mono text-xs", (pos.percentPnl || 0) >= 0 ? "text-green-500" : "text-red-500")}>
                                                {(pos.percentPnl || 0) >= 0 ? '+' : ''}{((pos.percentPnl || 0) * 100).toFixed(2)}%
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
