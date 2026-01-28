'use client';

import { Suspense, useState } from 'react';
import { usePrivyLogin } from '@/lib/privy-login';
import { ProxyWalletCard } from '@/components/proxy/proxy-wallet-card';
import { SmartMoneyTable } from '@/components/smart-money/smart-money-table';
import { RisingStarsTable } from '@/components/smart-money/rising-stars-table';
import { TableSkeleton } from '@/components/smart-money/table-skeleton';
import { Shield, Users, TrendingUp, Lock, ArrowRight, Crown, Star, Loader2 } from 'lucide-react';

type Tab = 'performers' | 'rising';

export function SmartMoneyPage() {
    const { authenticated, ready, login, isLoggingIn } = usePrivyLogin();
    const [page, setPage] = useState(1);
    const [activeTab, setActiveTab] = useState<Tab>('performers');

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
                            disabled={isLoggingIn}
                            aria-busy={isLoggingIn}
                            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isLoggingIn ? (
                                <>
                                    Connecting...
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                </>
                            ) : (
                                <>
                                    Connect Wallet to Continue
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
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
                        {/* Tab Header */}
                        <div className="border-b p-4">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { setActiveTab('performers'); setPage(1); }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'performers'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                                        }`}
                                >
                                    <Crown className="h-4 w-4" />
                                    Top Performers
                                </button>
                                <button
                                    onClick={() => setActiveTab('rising')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'rising'
                                        ? 'bg-yellow-600 text-white'
                                        : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                                        }`}
                                >
                                    <Star className="h-4 w-4" />
                                    Rising Stars
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                {activeTab === 'performers'
                                    ? 'High-volume traders from Polymarket leaderboard'
                                    : 'Active traders with strong risk-adjusted metrics (select period in table)'
                                }
                            </p>
                        </div>

                        {/* Tab Content */}
                        <div className="p-0">
                            {activeTab === 'performers' ? (
                                <>
                                    <Suspense key={page} fallback={<TableSkeleton />}>
                                        <SmartMoneyTable
                                            currentPage={page}
                                            onPageChange={setPage}
                                        />
                                    </Suspense>
                                    {/* Pagination for Top Performers */}
                                    <div className="flex justify-center gap-2 p-4 border-t">
                                        {[1, 2, 3, 4, 5].map((p) => (
                                            <button
                                                key={p}
                                                onClick={() => setPage(p)}
                                                className={`px-3 py-1 text-xs rounded ${page === p
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <Suspense fallback={<TableSkeleton />}>
                                    <RisingStarsTable limit={20} />
                                </Suspense>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SmartMoneyPage;
