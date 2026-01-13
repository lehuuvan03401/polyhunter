'use client';

import { Suspense, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ProxyWalletCard } from '@/components/proxy/proxy-wallet-card';
import { SmartMoneyTable } from '@/components/smart-money/smart-money-table';
import { TableSkeleton } from '@/components/smart-money/table-skeleton';
import { Shield, Users, TrendingUp, Lock, ArrowRight } from 'lucide-react';

export function SmartMoneyPage() {
    const { authenticated, ready, login } = usePrivy();
    const [page, setPage] = useState(1);

    if (!ready) {
        return (
            <div className="container py-10">
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div className="container py-10">
                <div className="mb-8 space-y-4 text-center">
                    <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                        Mirror the Alpha. Master the Market.
                    </h1>
                    <p className="text-muted-foreground text-lg">
                        Discover and follow the most profitable traders on Polymarket.
                    </p>
                    <div className="flex justify-center gap-4">
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500"></span> Live Updates</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500"></span> Verified Data</span>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto">
                    <div className="rounded-2xl border border-white/10 bg-card/50 p-12 text-center">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <Lock className="h-10 w-10 text-blue-400" />
                        </div>
                        <h2 className="text-2xl font-bold mb-3">Connect Your Wallet to View Traders</h2>
                        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                            Access the complete leaderboard of top performers on Polymarket.
                            View their trading history, profit metrics, and start copy trading with a single click.
                        </p>

                        <div className="grid md:grid-cols-3 gap-6 mb-8">
                            <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-green-500/10 flex items-center justify-center">
                                    <Users className="h-5 w-5 text-green-400" />
                                </div>
                                <h3 className="font-semibold mb-1">500+ Traders</h3>
                                <p className="text-xs text-muted-foreground">Verified and tracked</p>
                            </div>
                            <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <TrendingUp className="h-5 w-5 text-blue-400" />
                                </div>
                                <h3 className="font-semibold mb-1">Real-time Data</h3>
                                <p className="text-xs text-muted-foreground">Live on-chain metrics</p>
                            </div>
                            <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <Shield className="h-5 w-5 text-purple-400" />
                                </div>
                                <h3 className="font-semibold mb-1">One-Click Copy</h3>
                                <p className="text-xs text-muted-foreground">Automate your trades</p>
                            </div>
                        </div>

                        <button
                            onClick={login}
                            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
                        >
                            Connect Wallet to Continue
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-10">
            <div className="mb-8 space-y-4 text-center">
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                    Mirror the Alpha. Master the Market.
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
                <div className="col-span-12 lg:col-span-3 space-y-6">
                    <ProxyWalletCard />

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

                <div className="col-span-12 lg:col-span-9">
                    <div className="rounded-xl border bg-card shadow-sm">
                        <div className="border-b p-6 flex justify-between items-center">
                            <h2 className="text-lg font-semibold">Top Performers</h2>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                Page {page}
                            </span>
                        </div>
                        <div className="p-0">
                            <Suspense key={page} fallback={<TableSkeleton />}>
                                <SmartMoneyTable currentPage={page} />
                            </Suspense>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SmartMoneyPage;
