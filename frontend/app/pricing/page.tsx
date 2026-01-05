'use client';

import Link from 'next/link';
import { Check, Zap, Crown, Rocket, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePrivy } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { polyClient } from '@/lib/polymarket';

// --- Shared Components ---

function SignalBars({ level }: { level: 1 | 2 | 3 }) {
    return (
        <div className="flex items-end gap-1 h-5">
            <div className={cn("w-1.5 rounded-sm", level >= 1 ? "h-2 bg-blue-500" : "h-2 bg-white/10")} />
            <div className={cn("w-1.5 rounded-sm", level >= 2 ? "h-3.5 bg-blue-500" : "h-3.5 bg-white/10")} />
            <div className={cn("w-1.5 rounded-sm", level >= 3 ? "h-5 bg-blue-500" : "h-5 bg-white/10")} />
        </div>
    );
}

// --- Main Page Component ---

export default function PricingPage() {
    const { authenticated } = usePrivy();

    if (authenticated) {
        return <AuthenticatedPricing />;
    }

    return <PublicPricing />;
}

// --- Authenticated View ---

function AuthenticatedPricing() {
    const { user } = usePrivy();
    const [userVolume, setUserVolume] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Volume thresholds for tiers
    const PRO_THRESHOLD = 25000;
    const WHALE_THRESHOLD = 250000;

    useEffect(() => {
        const fetchVolume = async () => {
            if (!user?.wallet?.address) {
                setUserVolume(0);
                setIsLoading(false);
                return;
            }

            try {
                const activity = await polyClient.wallets.getWalletActivity(user.wallet.address);
                // Total volume = buy volume + sell volume from summary
                const totalVolume = activity.summary.buyVolume + activity.summary.sellVolume;
                setUserVolume(totalVolume);
            } catch (err) {
                console.warn('Failed to fetch user volume', err);
                setUserVolume(0);
            } finally {
                setIsLoading(false);
            }
        };

        fetchVolume();
    }, [user?.wallet?.address]);

    // Determine current tier
    const currentTier = userVolume !== null
        ? (userVolume >= WHALE_THRESHOLD ? 'whale' : userVolume >= PRO_THRESHOLD ? 'pro' : 'starter')
        : 'starter';

    // Format volume for display
    const formatVolume = (vol: number) => {
        if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
        if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}k`;
        return `$${vol.toFixed(0)}`;
    };

    // Calculate progress percentages
    const proProgress = userVolume !== null ? Math.min((userVolume / PRO_THRESHOLD) * 100, 100) : 0;
    const whaleProgress = userVolume !== null ? Math.min((userVolume / WHALE_THRESHOLD) * 100, 100) : 0;

    return (
        <div className="min-h-screen pt-24 pb-20 px-4">
            {/* Header */}
            <div className="container max-w-6xl mx-auto mb-16 text-center space-y-4">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Your Plan & Tier Status</h1>
                <p className="text-lg text-muted-foreground">
                    {isLoading ? 'Loading your stats...' : `Your total volume: ${formatVolume(userVolume || 0)}`}
                </p>
            </div>

            {/* Proxy Wallet Banner */}
            <div className="container max-w-6xl mx-auto mb-8">
                <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">🚀 Trading Proxy Wallet</h3>
                        <p className="text-gray-400 text-sm">
                            Create your proxy wallet for automatic fee collection. Only pay fees on profits, never on losses.
                        </p>
                    </div>
                    <Link
                        href="/dashboard/proxy"
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors whitespace-nowrap"
                    >
                        Manage Proxy Wallet
                    </Link>
                </div>
            </div>

            <div className="container max-w-6xl mx-auto">
                <div className="grid md:grid-cols-3 gap-6">
                    {/* Starter (Active) */}
                    <div className="rounded-2xl border border-[#2c2d33] bg-[#1a1b1e] p-8 flex flex-col relative overflow-hidden ring-1 ring-white/5">
                        <div className="mb-8 text-center">
                            <h3 className="text-2xl font-bold mb-2 text-white">Starter</h3>
                            <p className="text-muted-foreground text-sm">Everyone starts here</p>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center py-6 space-y-2">
                            <div className="text-xs font-medium text-muted-foreground mb-4">Your share of profits</div>
                            <div className="flex items-end gap-0.5 h-24 mb-4">
                                <div className="w-14 bg-green-500/90 hover:bg-green-500 transition-colors rounded-t-sm h-full flex items-center justify-center text-xs font-bold text-black pb-2">90%</div>
                                <div className="w-8 bg-white/10 rounded-t-sm h-[10%] border-t border-white/5 flex items-center justify-center text-[10px] text-muted-foreground pb-1">10%</div>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex gap-4 uppercase tracking-wider font-medium">
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500" /> You keep</span>
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-white/20" /> Fee</span>
                            </div>
                        </div>

                        <div className="text-center mb-8 py-6 border-y border-white/5 bg-black/20 -mx-8 px-8">
                            <div className="text-3xl font-bold text-white mb-1">10% fee</div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">on realized profits</div>
                        </div>

                        <div className="space-y-6 mb-8">
                            <div className="flex justify-between items-center text-sm p-4 rounded-xl bg-black/20 border border-white/5">
                                <span className="text-muted-foreground">Execution Speed</span>
                                <div className="flex items-center gap-3">
                                    <SignalBars level={1} />
                                    <span className="font-medium text-white">Standard</span>
                                </div>
                            </div>
                        </div>

                        <button className={cn(
                            "w-full py-3.5 rounded-lg font-bold flex items-center justify-center gap-2",
                            currentTier === 'starter'
                                ? "bg-green-900/40 border border-green-500/50 text-green-400 cursor-default"
                                : "bg-white/5 border border-white/10 text-muted-foreground"
                        )}>
                            {currentTier === 'starter' ? (
                                <><Check className="h-5 w-5" /> Your Current Tier</>
                            ) : (
                                'Starter Tier'
                            )}
                        </button>
                    </div>

                    {/* Pro */}
                    <div className="rounded-2xl border border-[#2c2d33] bg-[#1a1b1e] p-8 flex flex-col relative overflow-hidden group hover:border-blue-500/30 transition-all">
                        <div className="mb-8 text-center">
                            <h3 className="text-2xl font-bold mb-2 text-white">Pro</h3>
                            <p className="text-muted-foreground text-sm font-medium">$25k volume traded</p>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center py-6 space-y-2">
                            <div className="text-xs font-medium text-muted-foreground mb-4">Your share of profits</div>
                            <div className="flex items-end gap-0.5 h-24 mb-4">
                                <div className="w-14 bg-green-500/90 hover:bg-green-500 transition-colors rounded-t-sm h-full flex items-center justify-center text-xs font-bold text-black pb-2">95%</div>
                                <div className="w-8 bg-white/10 rounded-t-sm h-[5%] border-t border-white/5 flex items-center justify-center text-[10px] text-muted-foreground pb-1">5%</div>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex gap-4 uppercase tracking-wider font-medium">
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500" /> You keep</span>
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-white/20" /> Fee</span>
                            </div>
                        </div>

                        <div className="text-center mb-8 py-6 border-y border-white/5 bg-black/20 -mx-8 px-8">
                            <div className="text-3xl font-bold text-blue-400 mb-1">5% fee</div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">on realized profits</div>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between items-center text-sm p-4 rounded-xl bg-black/20 border border-white/5">
                                <span className="text-muted-foreground">Execution Speed</span>
                                <div className="flex items-center gap-3">
                                    <SignalBars level={2} />
                                    <span className="font-medium text-white">Fast</span>
                                </div>
                            </div>

                            {/* Volume Progress */}
                            <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                                <div className="flex justify-between text-xs mb-2 text-muted-foreground">
                                    <span>Volume progress</span>
                                    <span>{isLoading ? '...' : `${formatVolume(userVolume || 0)} / $25k`}</span>
                                </div>
                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${proProgress}%` }} />
                                </div>
                            </div>
                        </div>

                        <button className={cn(
                            "w-full py-3.5 rounded-lg font-bold flex items-center justify-center gap-2",
                            currentTier === 'pro'
                                ? "bg-blue-900/40 border border-blue-500/50 text-blue-400 cursor-default"
                                : currentTier === 'whale'
                                    ? "bg-white/5 border border-white/10 text-muted-foreground"
                                    : "bg-blue-600 hover:bg-blue-500 text-white"
                        )}>
                            {currentTier === 'pro' ? (
                                <><Check className="h-5 w-5" /> Your Current Tier</>
                            ) : currentTier === 'whale' ? (
                                'Pro Tier'
                            ) : (
                                `${formatVolume(PRO_THRESHOLD - (userVolume || 0))} to unlock`
                            )}
                        </button>
                    </div>

                    {/* Whale */}
                    <div className="rounded-2xl border border-yellow-500/30 bg-[#1a1b1e] p-8 flex flex-col relative overflow-hidden group hover:border-yellow-500/60 transition-all shadow-lg shadow-yellow-500/5">
                        <div className="absolute top-0 transform -translate-x-1/2 left-1/2 bg-yellow-500 text-black text-[10px] font-bold px-3 py-1 rounded-b-lg flex items-center gap-1 uppercase tracking-wider shadow-lg">
                            <Crown className="h-3 w-3" /> Max Gains
                        </div>

                        <div className="mb-8 text-center pt-4">
                            <h3 className="text-2xl font-bold mb-2 text-white">Whale</h3>
                            <p className="text-muted-foreground text-sm font-medium">$250k volume traded</p>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center py-6 space-y-2">
                            <div className="text-xs font-medium text-muted-foreground mb-4">Your share of profits</div>
                            <div className="flex items-end gap-0.5 h-24 mb-4">
                                <div className="w-14 bg-green-500/90 hover:bg-green-500 transition-colors rounded-t-sm h-full flex items-center justify-center text-xs font-bold text-black pb-2">98%</div>
                                <div className="w-8 bg-white/10 rounded-t-sm h-[2%] border-t border-white/5 flex items-center justify-center text-[10px] text-muted-foreground pb-1">2%</div>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex gap-4 uppercase tracking-wider font-medium">
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500" /> You keep</span>
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-white/20" /> Fee</span>
                            </div>
                        </div>

                        <div className="text-center mb-8 py-6 border-y border-white/5 bg-black/20 -mx-8 px-8">
                            <div className="text-3xl font-bold text-yellow-500 mb-1">2% fee</div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">on realized profits</div>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between items-center text-sm p-4 rounded-xl bg-black/20 border border-white/5">
                                <span className="text-muted-foreground">Execution Speed</span>
                                <div className="flex items-center gap-3">
                                    <SignalBars level={3} />
                                    <span className="font-medium text-white">Instant</span>
                                </div>
                            </div>

                            {/* Volume Progress */}
                            <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                                <div className="flex justify-between text-xs mb-2 text-muted-foreground">
                                    <span>Volume progress</span>
                                    <span>{isLoading ? '...' : `${formatVolume(userVolume || 0)} / $250k`}</span>
                                </div>
                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-yellow-500 transition-all duration-500" style={{ width: `${whaleProgress}%` }} />
                                </div>
                            </div>
                        </div>

                        <button className={cn(
                            "w-full py-3.5 rounded-lg font-bold flex items-center justify-center gap-2",
                            currentTier === 'whale'
                                ? "bg-yellow-900/40 border border-yellow-500/50 text-yellow-400 cursor-default"
                                : "bg-yellow-600 hover:bg-yellow-500 text-black"
                        )}>
                            {currentTier === 'whale' ? (
                                <><Check className="h-5 w-5" /> Your Current Tier</>
                            ) : (
                                `${formatVolume(WHALE_THRESHOLD - (userVolume || 0))} to unlock`
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Public View (Original) ---

function PublicPricing() {
    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero */}
            <section className="pt-20 pb-16 text-center px-4">
                <div className="container max-w-4xl mx-auto space-y-6">
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-muted-foreground backdrop-blur-xl">
                        <span className="flex h-2 w-2 rounded-full bg-blue-500 mr-2"></span>
                        Simple, transparent pricing
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                        Trade More, Pay Less
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Volume-based pricing that rewards your growth. No upfront costs.
                    </p>
                </div>
            </section>

            {/* How Profit Sharing Works */}
            <section className="py-12 px-4">
                <div className="container max-w-5xl mx-auto">
                    <div className="bg-card/50 border border-white/5 rounded-2xl p-8 md:p-12 relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />

                        <h2 className="text-center text-xl font-semibold mb-12">How Profit Sharing Works</h2>

                        <div className="grid md:grid-cols-3 gap-8 relative z-10">
                            {[
                                { icon: Rocket, title: "You copy trades", desc: "Select top traders to follow automatically." },
                                { icon: Zap, title: "You make profit", desc: "Trades are executed directly in your wallet." },
                                { icon: Crown, title: "Small fee on profits", desc: "We only earn when you win. High water mark applies." }
                            ].map((step, i) => (
                                <div key={i} className="flex flex-col items-center text-center relative">
                                    {i < 2 && <div className="hidden md:block absolute top-8 left-1/2 w-full h-[1px] bg-gradient-to-r from-white/20 to-transparent z-0 transform translate-x-1/2" />}

                                    <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 relative z-10">
                                        <step.icon className="h-8 w-8 text-blue-400" />
                                    </div>
                                    <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                                    <p className="text-sm text-muted-foreground max-w-[200px]">{step.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div className="text-center mt-12 text-sm text-muted-foreground">
                            No profit = No fee. We only win when you win.
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Cards */}
            <section className="py-16 px-4">
                <div className="container max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-3 gap-8">

                        {/* Starter */}
                        <div className="rounded-2xl border border-white/10 bg-card p-8 flex flex-col relative overflow-hidden group hover:border-white/20 transition-all">
                            <div className="mb-8">
                                <h3 className="text-2xl font-bold mb-2">Starter</h3>
                                <p className="text-muted-foreground text-sm">Everyone starts here</p>
                            </div>

                            <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-2">
                                {/* Visual Bar Representation */}
                                <div className="flex items-end gap-1 h-24 mb-4">
                                    <div className="w-12 bg-green-500 rounded-t h-full flex items-center justify-center text-xs font-bold text-black pb-1">90%</div>
                                    <div className="w-4 bg-white/20 rounded-t h-[10%]"></div>
                                </div>
                                <div className="text-xs text-muted-foreground flex gap-4">
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> You keep</span>
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-white/20" /> Fee</span>
                                </div>
                            </div>

                            <div className="text-center mb-8">
                                <div className="text-4xl font-bold text-blue-400">10% fee</div>
                                <div className="text-xs text-muted-foreground">on realized profits</div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="flex justify-between text-sm py-2 border-b border-white/5">
                                    <span className="text-muted-foreground">Execution Speed</span>
                                    <span className="font-medium">Standard</span>
                                </div>
                            </div>

                            <button className="w-full py-3 rounded-lg bg-white/10 border border-white/10 hover:bg-white/20 font-medium transition-colors">
                                Start Copying
                            </button>
                        </div>

                        {/* Pro */}
                        <div className="rounded-2xl border border-white/10 bg-card p-8 flex flex-col relative overflow-hidden group hover:border-blue-500/50 transition-all">
                            <div className="mb-8">
                                <h3 className="text-2xl font-bold mb-2 text-white">Pro</h3>
                                <p className="text-blue-400 text-sm font-medium">$25k volume traded</p>
                            </div>

                            <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-2">
                                <div className="flex items-end gap-1 h-24 mb-4">
                                    <div className="w-12 bg-green-500 rounded-t h-full flex items-center justify-center text-xs font-bold text-black pb-1">95%</div>
                                    <div className="w-4 bg-white/20 rounded-t h-[5%]"></div>
                                </div>
                                <div className="text-xs text-muted-foreground flex gap-4">
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> You keep</span>
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-white/20" /> Fee</span>
                                </div>
                            </div>

                            <div className="text-center mb-8">
                                <div className="text-4xl font-bold text-blue-400">5% fee</div>
                                <div className="text-xs text-muted-foreground">on realized profits</div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="flex justify-between text-sm py-2 border-b border-white/5">
                                    <span className="text-muted-foreground">Execution Speed</span>
                                    <span className="font-medium flex items-center gap-1 text-blue-400"><Zap className="h-3 w-3" /> Fast</span>
                                </div>
                            </div>

                            <button className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 font-medium transition-colors text-white">
                                Start Copying
                            </button>
                        </div>

                        {/* Whale */}
                        <div className="rounded-2xl border border-yellow-500/30 bg-card p-8 flex flex-col relative overflow-hidden group hover:border-yellow-500/60 transition-all shadow-[0_0_40px_-10px_rgba(234,179,8,0.1)]">
                            <div className="absolute top-0 right-0 bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-bl-xl origin-top-right">
                                MAX GAINS
                            </div>

                            <div className="mb-8">
                                <h3 className="text-2xl font-bold mb-2 text-yellow-500">Whale</h3>
                                <p className="text-yellow-500/80 text-sm font-medium">$250k volume traded</p>
                            </div>

                            <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-2">
                                <div className="flex items-end gap-1 h-24 mb-4">
                                    <div className="w-12 bg-green-500 rounded-t h-full flex items-center justify-center text-xs font-bold text-black pb-1">98%</div>
                                    <div className="w-4 bg-white/20 rounded-t h-[2%]"></div>
                                </div>
                                <div className="text-xs text-muted-foreground flex gap-4">
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> You keep</span>
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-white/20" /> Fee</span>
                                </div>
                            </div>

                            <div className="text-center mb-8">
                                <div className="text-4xl font-bold text-yellow-500">2% fee</div>
                                <div className="text-xs text-muted-foreground">on realized profits</div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="flex justify-between text-sm py-2 border-b border-white/5">
                                    <span className="text-muted-foreground">Execution Speed</span>
                                    <span className="font-medium flex items-center gap-1 text-yellow-500"><Rocket className="h-3 w-3" /> Instant</span>
                                </div>
                            </div>

                            <button className="w-full py-3 rounded-lg border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black font-medium transition-all">
                                Start Copying
                            </button>
                        </div>
                    </div>

                    <div className="mt-16 text-center">
                        <h3 className="text-lg font-medium mb-8">All Plans Include</h3>
                        <div className="flex flex-wrap justify-center gap-8">
                            {["Copy unlimited traders", "Gas fees sponsored", "Real-time execution", "No monthly fees"].map((feat, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <div className="h-4 w-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                        <Check className="h-2.5 w-2.5 text-green-500" />
                                    </div>
                                    {feat}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer CTA */}
            <section className="py-24 px-4 text-center border-t border-white/5 mt-auto">
                <div className="container max-w-3xl mx-auto space-y-6">
                    <h2 className="text-3xl font-bold">Ready to Automate Your Edge?</h2>
                    <p className="text-muted-foreground">Start copying the best traders on Polymarket today.</p>
                    <Link
                        href="/smart-money"
                        className="inline-block px-8 py-3 rounded-lg bg-white text-black font-bold hover:bg-gray-200 transition-colors"
                    >
                        Explore Leaderboard
                    </Link>
                </div>
            </section>
        </div>
    );
}
