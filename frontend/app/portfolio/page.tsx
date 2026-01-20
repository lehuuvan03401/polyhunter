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
    Coins,
    AlertCircle,
    Check
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useCopyTradingStore, type CopyTradingConfig } from '@/lib/copy-trading-store';
import { PendingTradesAlert } from '@/components/copy-trading/pending-trades-alert';
import { OrderStatusPanel } from '@/components/copy-trading/order-status-panel';
import { ActiveStrategiesPanel } from '@/components/copy-trading/active-strategies-panel';
import { useOrderStatus } from '@/lib/hooks/useOrderStatus';
import { TransactionHistoryTable } from '@/components/proxy/transaction-history-table';
import { useCopyTradingMetrics } from '@/lib/hooks/useCopyTradingMetrics';
import { useSimulatedPositions } from '@/lib/hooks/useSimulatedPositions';

// USDC.e contract on Polygon (used by Polymarket)
const USDC_CONTRACT = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const USDC_ABI = ['function balanceOf(address) view returns (uint256)'];

export default function PortfolioPage() {
    const { user, authenticated, ready, login } = usePrivy();
    const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
    const [totalPnL, setTotalPnL] = useState(0);
    const [positions, setPositions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [positionsPage, setPositionsPage] = useState(1);

    // New state for History and Sell All
    const [activeTab, setActiveTab] = useState<'positions' | 'strategies' | 'orders' | 'history' | 'transfers'>('positions');
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [isSellingAll, setIsSellingAll] = useState(false);

    // Fetch order stats for the tab count
    const { stats: orderStats } = useOrderStatus(user?.wallet?.address || '', {
        pollInterval: 15000
    });

    // Fetch simulated metrics and positions
    const { metrics: ctMetrics } = useCopyTradingMetrics(user?.wallet?.address || '');
    const { positions: simPositions } = useSimulatedPositions(user?.wallet?.address || '');

    const [activeStrategiesCount, setActiveStrategiesCount] = useState(0);

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
                        const rpcUrl = process.env.NEXT_PUBLIC_NETWORK === 'localhost'
                            ? 'http://127.0.0.1:8545'
                            : 'https://polygon-rpc.com';
                        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

                        const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS || USDC_CONTRACT;
                        const usdcContract = new ethers.Contract(usdcAddress, USDC_ABI, provider);
                        const rawBalance = await usdcContract.balanceOf(address);
                        // USDC has 6 decimals
                        const balance = Number(rawBalance) / 1e6;
                        setUsdcBalance(balance);
                    } catch (balanceErr) {
                        console.warn("Failed to fetch USDC balance", balanceErr);
                        setUsdcBalance(null);
                    }

                    try {

                        // Get Positions
                        const walletPositions = await polyClient.wallets.getWalletPositions(address);
                        setPositions(walletPositions);

                        // Get Portfolio PnL
                        const profile = await polyClient.wallets.getWalletProfile(address);
                        let calculatedPnL = profile.totalPnL;

                        // Fallback: If API returns 0 PnL (common locally/delayed), sum up positions PnL
                        if (calculatedPnL === 0 && walletPositions.length > 0) {
                            const positionsPnL = walletPositions.reduce((sum: number, pos: any) => {
                                // Use cashPnl if available, otherwise estimate
                                const pnl = typeof pos.cashPnl === 'number' ? pos.cashPnl : 0;
                                return sum + pnl;
                            }, 0);

                            if (positionsPnL !== 0) {
                                console.log('Using calculated PnL from positions:', positionsPnL);
                                calculatedPnL = positionsPnL;
                            }
                        }

                        // Add simulated PnL if any
                        // We use `ctMetrics.totalPnL` which comes from our local DB aggregation
                        // Note: ctMetrics might be 0 initially until hook loads, but that's fine.
                        // Ideally we sum them up.
                        // However, since `ctMetrics` is from a hook, accessing it inside this useEffect (which runs once/auth change) won't work reactively.
                        // We should calculate final PnL in rendering or a separate effect.
                        // For now, let's just set the base PnL here.
                        setTotalPnL(calculatedPnL);

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

    // Fetch history when tab changes
    useEffect(() => {
        const fetchHistory = async () => {
            if (activeTab === 'history' && authenticated && user?.wallet?.address) {
                setIsHistoryLoading(true);
                try {
                    // @ts-ignore - getWalletActivity exists in service but type might lag
                    const activity = await polyClient.wallets.getWalletActivity(user.wallet.address);
                    // Standardize activity format
                    const formattedDetails = activity.activities || [];
                    setHistoryData(formattedDetails);
                } catch (e) {
                    console.error("Failed to fetch history", e);
                } finally {
                    setIsHistoryLoading(false);
                }
            }
        };

        fetchHistory();
    }, [activeTab, authenticated, user?.wallet?.address]);

    // Fetch active strategies count
    useEffect(() => {
        const fetchStrategiesCount = async () => {
            if (!user?.wallet?.address) return;
            try {
                const response = await fetch(`/api/copy-trading/strategies?wallet=${user.wallet.address}&status=active`);
                if (response.ok) {
                    const data = await response.json();
                    setActiveStrategiesCount(data.strategies?.length || 0);
                }
            } catch (err) {
                console.error('Failed to fetch strategies count:', err);
            }
        };
        fetchStrategiesCount();
    }, [user?.wallet?.address]);

    const handleSellAll = async () => {
        if (positions.length === 0) return;

        if (!confirm(`Are you sure you want to sell ALL ${positions.length} positions? This will execute market sell orders for everything.`)) {
            return;
        }

        setIsSellingAll(true);
        const toastId = toast.loading("Selling all positions...");

        try {
            let successCount = 0;
            let failCount = 0;

            // Process in parallel with concurrency limit ideally, but simple for now
            const results = await Promise.all(positions.map(async (pos) => {
                try {
                    // Assuming pos has tokenId and size
                    // We need to determine SIDE. If we hold YES, we SELL YES.
                    // If we hold NO, we SELL NO.
                    // The position object should have 'outcome' or 'tokenId'

                    if (!pos.tokenId || !pos.size) return false;

                    // Execute Market Sell
                    await polyClient.tradingService.createMarketOrder({
                        tokenId: pos.tokenId,
                        side: 'SELL',
                        amount: pos.size, // Sell entire size
                        orderType: 'FOK' // Fill or Kill
                    });
                    return true;
                } catch (err) {
                    console.error("Sell failed for", pos.title, err);
                    return false;
                }
            }));

            successCount = results.filter(r => r).length;
            failCount = results.filter(r => !r).length;

            if (failCount === 0) {
                toast.success(`Successfully sold all ${successCount} positions!`, { id: toastId });
                // Refresh positions
                const newPos = await polyClient.wallets.getWalletPositions(user?.wallet?.address!);
                setPositions(newPos);
            } else {
                toast.warning(`Sold ${successCount} positions. Failed: ${failCount}`, { id: toastId });
                // Partial refresh
                const newPos = await polyClient.wallets.getWalletPositions(user?.wallet?.address!);
                setPositions(newPos);
            }

        } catch (e) {
            console.error("Sell all error", e);
            toast.error("Critical error during sell-all", { id: toastId });
        } finally {
            setIsSellingAll(false);
        }
    };

    // Format address for display
    const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    if (!ready || isLoading) {
        return (
            <div className="container max-w-7xl py-8">
                {/* Header Skeleton */}
                <div className="mb-8 space-y-2 animate-pulse">
                    <div className="h-8 w-48 bg-muted/50 rounded" />
                    <div className="h-4 w-80 bg-muted/30 rounded" />
                </div>

                {/* Top Cards Skeleton */}
                <div className="grid gap-6 md:grid-cols-3 mb-8">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="rounded-xl border bg-card p-6 shadow-sm h-[220px] animate-pulse">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="h-4 w-4 bg-muted/50 rounded" />
                                <div className="h-4 w-24 bg-muted/50 rounded" />
                            </div>
                            <div className="h-10 w-32 bg-muted/50 rounded mb-2" />
                            <div className="h-4 w-24 bg-muted/30 rounded" />
                            <div className="mt-auto pt-8 grid grid-cols-2 gap-3">
                                <div className="h-9 bg-muted/30 rounded-lg" />
                                <div className="h-9 bg-muted/20 rounded-lg" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Content Skeleton */}
                <div className="grid gap-6 lg:grid-cols-12">
                    {/* Left Sidebar Skeleton */}
                    <div className="lg:col-span-4 rounded-xl border bg-card shadow-sm h-[600px] animate-pulse">
                        <div className="p-6 border-b flex justify-between items-center">
                            <div className="h-5 w-28 bg-muted/50 rounded" />
                            <div className="h-4 w-24 bg-muted/30 rounded" />
                        </div>
                        <div className="p-4 space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-muted/20 rounded-lg p-4 flex justify-between items-center">
                                    <div>
                                        <div className="h-4 w-32 bg-muted/30 rounded mb-2" />
                                        <div className="h-3 w-24 bg-muted/20 rounded" />
                                    </div>
                                    <div className="h-6 w-16 bg-muted/30 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Content Skeleton */}
                    <div className="lg:col-span-8 rounded-xl border bg-card shadow-sm h-[600px] animate-pulse">
                        <div className="p-4 border-b flex items-center gap-4">
                            <div className="h-5 w-20 bg-muted/50 rounded" />
                            <div className="h-8 w-48 bg-muted/20 rounded-lg" />
                        </div>
                        <div className="p-4 space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex items-center justify-between py-3 border-b border-muted/20">
                                    <div className="h-4 w-40 bg-muted/30 rounded" />
                                    <div className="h-4 w-16 bg-muted/20 rounded" />
                                    <div className="h-4 w-16 bg-muted/20 rounded" />
                                    <div className="h-4 w-16 bg-muted/20 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
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

                {/* PnL Card - Now with Real + Simulated PnL */}
                <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-between h-[220px]">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-green-500">
                                <TrendingUp className="h-4 w-4" />
                                <span>Profit/Loss</span>
                            </div>
                            <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">All Time</div>
                        </div>
                        {(() => {
                            const effectivePnL = totalPnL + (ctMetrics?.totalPnL || 0);
                            return (
                                <div className={cn("text-3xl font-bold tracking-tight", effectivePnL >= 0 ? "text-green-500" : "text-red-500")}>
                                    {effectivePnL >= 0 ? '+' : ''}${effectivePnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            );
                        })()}
                    </div>

                    {/* PnL Trend Visualization (stylized) */}
                    <div className="mt-4 h-16 w-full flex items-end opacity-50">
                        <svg viewBox="0 0 100 20" className={cn("w-full h-full stroke-current", (totalPnL + (ctMetrics?.totalPnL || 0)) >= 0 ? "text-green-500 fill-green-500/20" : "text-red-500 fill-red-500/20")} preserveAspectRatio="none">
                            <path d="M0 20 L0 15 Q 10 18, 20 12 T 40 10 T 60 14 T 80 5 T 100 2 L 100 20 Z" strokeWidth="0" />
                            <path d="M0 15 Q 10 18, 20 12 T 40 10 T 60 14 T 80 5 T 100 2" fill="none" strokeWidth="2" />
                        </svg>
                    </div>
                </div>

                {/* Invested Funds Card (NEW) */}
                <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-between h-[220px] relative overflow-hidden">
                    {/* Background Gradient Effect */}
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-yellow-500/10 blur-3xl pointer-events-none" />

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Coins className="h-4 w-4" />
                                <span>Invested Funds</span>
                            </div>
                            <Zap className="h-5 w-5 text-yellow-500" />
                        </div>
                        <div className="text-3xl font-bold tracking-tight mb-1">
                            ${(ctMetrics?.totalInvested || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            Across {ctMetrics?.activePositions || 0} active positions
                        </div>
                    </div>

                    <div className="mt-6 space-y-3">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Current Plan</span>
                            <span className="font-medium text-yellow-500">Starter</span>
                        </div>
                        {/* Fake progress bar for plan usage */}
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full w-[25%] bg-yellow-500 rounded-full" />
                        </div>

                        <Link href="/pricing" className="flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                            View Plan Limits <ChevronRight className="h-3 w-3 ml-0.5" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Pending Copy Trades Alert */}
            {user?.wallet?.address && (
                <div className="mb-6">
                    <PendingTradesAlert walletAddress={user.wallet.address} />
                </div>
            )}

            {/* Order Status Monitoring Removed - moved to Tabs */}

            {/* Main Content Split */}
            <div className="grid gap-6 lg:grid-cols-12">


                {/* Right: Portfolio Tabs (12 cols - Full Width) */}
                <div className="lg:col-span-12 rounded-xl border bg-card shadow-sm flex flex-col h-[600px]">
                    <div className="p-4 border-b flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <h3 className="font-semibold px-2">Portfolio</h3>
                            {/* Tabs */}
                            <div className="flex items-center rounded-lg bg-muted/50 p-1">
                                <button
                                    onClick={() => setActiveTab('strategies')}
                                    className={cn(
                                        "rounded px-3 py-1 text-xs font-medium transition-all",
                                        activeTab === 'strategies' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Strategies <span className="ml-1 text-muted-foreground">{activeStrategiesCount}</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('orders')}
                                    className={cn(
                                        "rounded px-3 py-1 text-xs font-medium transition-all",
                                        activeTab === 'orders' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Orders <span className="ml-1 text-muted-foreground">{orderStats.total}</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('positions')}
                                    className={cn(
                                        "rounded px-3 py-1 text-xs font-medium transition-all",
                                        activeTab === 'positions' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Positions <span className="ml-1 text-muted-foreground">{positions.length + (simPositions?.length || 0)}</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={cn(
                                        "rounded px-3 py-1 text-xs font-medium transition-all",
                                        activeTab === 'history' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Trades
                                </button>
                                <button
                                    onClick={() => setActiveTab('transfers')}
                                    className={cn(
                                        "rounded px-3 py-1 text-xs font-medium transition-all",
                                        activeTab === 'transfers' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Transfers
                                </button>
                            </div>
                        </div>
                        {activeTab === 'positions' && (
                            <button
                                onClick={handleSellAll}
                                disabled={positions.length === 0 || isSellingAll}
                                className="text-xs font-medium text-red-400 hover:text-red-300 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 rounded px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSellingAll && <Loader2 className="h-3 w-3 animate-spin" />}
                                Sell All
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-auto bg-card">
                        {activeTab === 'positions' && (
                            // --- POSITIONS VIEW ---
                            // --- POSITIONS VIEW ---
                            (() => {
                                // Combine and tag positions
                                const allPositions = [
                                    ...positions.map(p => ({ ...p, _type: 'real' })),
                                    ...simPositions.map(p => ({ ...p, _type: 'sim' }))
                                ];

                                const ITEMS_PER_PAGE = 10;
                                const totalPages = Math.ceil(allPositions.length / ITEMS_PER_PAGE);
                                const currentPositions = allPositions.slice(
                                    (positionsPage - 1) * ITEMS_PER_PAGE,
                                    positionsPage * ITEMS_PER_PAGE
                                );

                                if (allPositions.length === 0) {
                                    return (
                                        <div className="flex h-full flex-col items-center justify-center text-center space-y-3">
                                            <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground">
                                                <Layers className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-sm">No Open Positions</h4>
                                                <p className="text-xs text-muted-foreground mt-1 max-w-[250px] mx-auto">
                                                    Real and simulated positions will appear here.
                                                </p>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="flex flex-col h-full">
                                        <div className="flex-1 overflow-auto">
                                            <table className="w-full caption-bottom text-sm">
                                                <thead className="[&_tr]:border-b sticky top-0 bg-card z-10">
                                                    <tr className="border-b transition-colors bg-card">
                                                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs bg-card w-[140px]">Time</th>
                                                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs bg-card">Market</th>
                                                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs bg-card">Outcome</th>
                                                        <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground text-xs bg-card">Size</th>
                                                        <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground text-xs bg-card">Price</th>
                                                        <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground text-xs bg-card">PnL</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {currentPositions.map((pos, i) => (
                                                        <tr
                                                            key={`${pos._type}-${pos.tokenId || i}`}
                                                            className={cn(
                                                                "border-b transition-colors hover:bg-muted/50",
                                                                pos._type === 'sim' && "bg-blue-500/5"
                                                            )}
                                                        >
                                                            <td className="p-4 align-middle text-xs text-muted-foreground whitespace-nowrap">
                                                                {pos.timestamp ? new Date(pos.timestamp).toLocaleTimeString() : '-'}
                                                            </td>
                                                            <td className="p-4 align-middle font-medium max-w-[200px] truncate" title={pos.title}>
                                                                {pos._type === 'sim' ? (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="bg-blue-500 text-[10px] text-black px-1 rounded font-bold">SIM</span>
                                                                        {pos.title}
                                                                    </div>
                                                                ) : pos.title}
                                                            </td>
                                                            <td className="p-4 align-middle">
                                                                <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                                                                    (pos.outcome === 'Yes' || pos.outcome === 'YES') ? "bg-green-400/10 text-green-400 ring-green-400/20" :
                                                                        (pos.outcome === 'No' || pos.outcome === 'NO') ? "bg-red-400/10 text-red-400 ring-red-400/20" : "bg-gray-400/10 text-gray-400 ring-gray-400/20")}>
                                                                    {pos.outcome}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 align-middle text-right font-mono text-xs">{pos.size?.toFixed(2)}</td>
                                                            <td className="p-4 align-middle text-right font-mono text-xs">${(pos.curPrice || pos.avgPrice)?.toFixed(2) || '0.00'}</td>
                                                            <td className={cn("p-4 align-middle text-right font-mono text-xs", (pos.percentPnl || 0) >= 0 ? "text-green-500" : "text-red-500")}>
                                                                {(pos.percentPnl || 0) >= 0 ? '+' : ''}{((pos.percentPnl || 0) * 100).toFixed(2)}%
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Pagination Controls */}
                                        {totalPages > 1 && (
                                            <div className="flex items-center justify-between px-4 py-3 border-t bg-card">
                                                <div className="text-xs text-muted-foreground">
                                                    Showing {(positionsPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(positionsPage * ITEMS_PER_PAGE, allPositions.length)} of {allPositions.length} positions
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        onClick={() => setPositionsPage(p => Math.max(1, p - 1))}
                                                        disabled={positionsPage === 1}
                                                        className="px-2 py-1 border rounded text-xs font-medium disabled:opacity-50 hover:bg-muted"
                                                    >
                                                        Previous
                                                    </button>
                                                    <span className="text-xs font-medium">Page {positionsPage} of {totalPages}</span>
                                                    <button
                                                        onClick={() => setPositionsPage(p => Math.min(totalPages, p + 1))}
                                                        disabled={positionsPage === totalPages}
                                                        className="px-2 py-1 border rounded text-xs font-medium disabled:opacity-50 hover:bg-muted"
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()
                        )}

                        {activeTab === 'strategies' && (
                            // --- STRATEGIES VIEW ---
                            <div className="h-full flex flex-col">
                                {user?.wallet?.address ? (
                                    <ActiveStrategiesPanel
                                        walletAddress={user.wallet.address}
                                        className="border-0 rounded-none bg-transparent shadow-none h-full"
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                                        Connect wallet to view strategies
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'orders' && (
                            // --- ORDERS VIEW ---
                            <div className="h-full flex flex-col">
                                {user?.wallet?.address ? (
                                    <OrderStatusPanel
                                        walletAddress={user.wallet.address}
                                        className="border-0 rounded-none bg-transparent shadow-none h-full"
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                                        Connect wallet to view orders
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'history' && (
                            // --- HISTORY VIEW ---
                            isHistoryLoading ? (
                                <div className="flex h-full items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : historyData.length > 0 ? (
                                <table className="w-full caption-bottom text-sm">
                                    <thead className="[&_tr]:border-b sticky top-0 bg-card z-10">
                                        <tr className="border-b transition-colors">
                                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs">Date</th>
                                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs">Action</th>
                                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs">Market</th>
                                            <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground text-xs">Size</th>
                                            <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground text-xs">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historyData.map((item, i) => (
                                            <tr key={i} className="border-b transition-colors hover:bg-muted/50">
                                                <td className="p-4 align-middle text-xs text-muted-foreground whitespace-nowrap">
                                                    {new Date(item.timestamp * 1000).toLocaleDateString()}
                                                </td>
                                                <td className="p-4 align-middle">
                                                    <span className={cn("font-medium text-xs uppercase", item.side === 'BUY' ? "text-green-500" : "text-red-500")}>
                                                        {item.side} {item.outcome || 'SHARES'}
                                                    </span>
                                                </td>
                                                <td className="p-4 align-middle text-xs max-w-[180px] truncate" title={item.title}>
                                                    {item.title || item.conditionId?.slice(0, 10) + '...'}
                                                </td>
                                                <td className="p-4 align-middle text-right font-mono text-xs">
                                                    {(item.size || item.usdcSize || 0).toFixed(2)}
                                                </td>
                                                <td className="p-4 align-middle text-right font-mono text-xs">
                                                    ${(item.price || 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex h-full flex-col items-center justify-center text-center space-y-3">
                                    <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground">
                                        <History className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-sm">No History Yet</h4>
                                        <p className="text-xs text-muted-foreground mt-1 max-w-[250px] mx-auto">
                                            Your trade history and activity will appear here.
                                        </p>
                                    </div>
                                </div>
                            )
                        )}

                        {activeTab === 'transfers' && (
                            <div className="p-4">
                                <TransactionHistoryTable />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
