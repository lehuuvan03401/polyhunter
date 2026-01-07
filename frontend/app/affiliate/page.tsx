'use client';

import Link from 'next/link';
import { Link as LinkIcon, Users, Wallet, BarChart3, Copy, Info, Clock, Loader2, Calendar, Repeat, CheckCircle, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { affiliateApi, type AffiliateStats, TIER_INFO, generateReferralLink } from '@/lib/affiliate-api';

export default function AffiliatePage() {
    const { authenticated, user, ready } = usePrivy();

    if (!ready) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (authenticated && user?.wallet?.address) {
        return <AuthenticatedView walletAddress={user.wallet.address} />;
    }

    return <GuestView />;
}

// --- Authenticated Dashboard View ---
function AuthenticatedView({ walletAddress }: { walletAddress: string }) {
    const [stats, setStats] = useState<AffiliateStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRegistering, setIsRegistering] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);
    const [referrals, setReferrals] = useState<any[]>([]);
    const [simVolume, setSimVolume] = useState('1000');
    const [isSimulating, setIsSimulating] = useState(false);

    useEffect(() => {
        async function loadStats() {
            try {
                // Check if registered
                const lookup = await affiliateApi.lookupWallet(walletAddress);
                if (lookup.registered) {
                    setIsRegistered(true);
                    const [statsData, referralsData] = await Promise.all([
                        affiliateApi.getStats(walletAddress),
                        affiliateApi.getReferrals(walletAddress)
                    ]);
                    setStats(statsData);
                    setReferrals(referralsData);
                } else {
                    setIsRegistered(false);
                }
            } catch (err) {
                console.warn('Failed to load affiliate stats', err);
            } finally {
                setIsLoading(false);
            }
        }
        loadStats();
    }, [walletAddress]);

    const handleRegister = async () => {
        setIsRegistering(true);
        try {
            const result = await affiliateApi.register(walletAddress);
            if (result.success) {
                toast.success('Successfully registered as affiliate!');
                setIsRegistered(true);
                const [statsData, referralsData] = await Promise.all([
                    affiliateApi.getStats(walletAddress),
                    affiliateApi.getReferrals(walletAddress)
                ]);
                setStats(statsData);
                setReferrals(referralsData);
            } else {
                toast.error(result.error || 'Registration failed');
            }
        } catch (err) {
            toast.error('Failed to register. Is the backend running?');
        } finally {
            setIsRegistering(false);
        }
    };

    const handleCopyLink = () => {
        if (stats?.referralCode) {
            navigator.clipboard.writeText(generateReferralLink(stats.referralCode));
            toast.success('Referral link copied!');
        }
    };

    const handleSimulate = async () => {
        setIsSimulating(true);
        try {
            // Simulate a trade from the FIRST referral if exists, or a dummy
            const referee = referrals.length > 0 ? referrals[0].address : '0x0000000000000000000000000000000000000000'; // Fallback needs real referral

            if (referrals.length === 0) {
                toast.error("You need at least one referral to simulate commission!");
                return;
            }

            const response = await fetch('/api/affiliate/simulate-trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    refereeAddress: referee,
                    volume: parseFloat(simVolume)
                })
            });

            const result = await response.json();
            if (result.success) {
                toast.success(`Simulated! Earned $${result.commissionEarned.toFixed(2)}`);
                // Refresh stats
                const [statsData, referralsData] = await Promise.all([
                    affiliateApi.getStats(walletAddress),
                    affiliateApi.getReferrals(walletAddress)
                ]);
                setStats(statsData);
                setReferrals(referralsData);
            } else {
                toast.error(result.error);
            }
        } catch (e) {
            toast.error("Simulation failed");
        } finally {
            setIsSimulating(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!isRegistered) {
        return (
            <div className="min-h-screen bg-background pt-24 pb-20">
                <div className="container max-w-2xl mx-auto px-4 text-center">
                    <h1 className="text-3xl font-bold text-white mb-4">Join the Affiliate Program</h1>
                    <p className="text-muted-foreground mb-8">Earn up to 25% commission on trading fees from your referrals</p>
                    <button
                        onClick={handleRegister}
                        disabled={isRegistering}
                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center gap-2 mx-auto"
                    >
                        {isRegistering ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                        {isRegistering ? 'Registering...' : 'Become an Affiliate'}
                    </button>
                </div>
            </div>
        );
    }

    const tierInfo = stats ? TIER_INFO[stats.tier] : TIER_INFO.BRONZE;
    const referralLink = stats?.referralCode ? generateReferralLink(stats.referralCode) : '';
    const progressPercent = stats?.nextTier
        ? Math.min(100, ((stats.totalVolumeGenerated) / (tierInfo.nextVolume || 1)) * 100)
        : 100;

    return (
        <div className="min-h-screen bg-background pt-24 pb-20">
            <div className="container max-w-6xl mx-auto px-4">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-white">Affiliate Dashboard</h1>
                </div>

                {/* 1. Tier Status Card */}
                <div className="bg-[#1a1b1e] border border-yellow-500/20 rounded-2xl p-6 md:p-8 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 bg-yellow-500/5 blur-[80px] rounded-full pointer-events-none" />

                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg border-2 border-yellow-500/20">
                                {stats?.tier === 'DIAMOND' ? '💎' : stats?.tier === 'GOLD' ? '🥇' : stats?.tier === 'SILVER' ? '🥈' : '🥉'}
                            </div>
                            <div>
                                <div className="text-sm text-yellow-500 font-medium mb-1">Current Tier</div>
                                <h2 className={cn("text-3xl font-bold mb-1", tierInfo.color)}>{tierInfo.name}</h2>
                                <div className="inline-flex items-center px-2 py-0.5 rounded bg-green-500/10 text-green-500 text-sm font-bold">
                                    {((stats?.commissionRate || 0.1) * 100).toFixed(0)}% Commission Rate
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-1/2">
                            {stats?.nextTier ? (
                                <>
                                    <div className="flex justify-between text-xs mb-2">
                                        <span className="text-muted-foreground">Next tier ({stats.nextTier}) at ${((tierInfo.nextVolume || 0) / 1000).toFixed(0)}K volume</span>
                                        <span className="text-white font-medium">${(stats.totalVolumeGenerated / 1000).toFixed(1)}K / ${((tierInfo.nextVolume || 0) / 1000).toFixed(0)}K</span>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 transition-all" style={{ width: `${progressPercent}%` }} />
                                    </div>
                                </>
                            ) : (
                                <div className="text-center text-yellow-400 font-medium">🎉 Maximum tier achieved!</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {[
                        { label: "Volume Generated", value: `$${(stats?.totalVolumeGenerated || 0).toLocaleString()}`, sub: "By your referrals", icon: BarChart3, color: "text-blue-500", bg: "bg-blue-500/10" },
                        { label: "Total Referrals", value: `${stats?.totalReferrals || 0}`, sub: "Users you've referred", icon: Users, color: "text-purple-500", bg: "bg-purple-500/10" },
                        { label: "Total Earned", value: `$${(stats?.totalEarned || 0).toFixed(2)}`, sub: "Paid to your wallet", icon: Wallet, color: "text-green-500", bg: "bg-green-500/10" },
                        { label: "Pending Payout", value: `$${(stats?.pendingPayout || 0).toFixed(2)}`, sub: "Paid daily ≥ $0.50", icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10" },
                    ].map((stat, i) => (
                        <div key={i} className="bg-[#1a1b1e] border border-[#2c2d33] rounded-xl p-6 flex flex-col justify-between h-32 relative overflow-hidden group hover:border-white/10 transition-colors">
                            <div className={`absolute right-4 top-4 h-10 w-10 rounded-lg ${stat.bg} flex items-center justify-center ${stat.color}`}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</div>
                                <div className="text-2xl font-bold text-white">{stat.value}</div>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                {i === 3 && <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />}
                                {stat.sub}
                            </div>
                        </div>
                    ))}
                </div>

                {/* 3. Referral Link */}
                <div className="bg-[#1a1b1e] border border-[#2c2d33] rounded-2xl p-6 mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-6 w-6 rounded bg-blue-500/20 flex items-center justify-center text-blue-500">
                            <LinkIcon className="h-3.5 w-3.5" />
                        </div>
                        <h3 className="font-bold text-white">Your Referral Link</h3>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <p className="text-sm text-muted-foreground md:w-1/3">
                            Share this link. Users who sign up are permanently linked to you.
                        </p>
                        <div className="flex-1 flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={referralLink}
                                className="flex-1 bg-[#25262b] border border-[#2c2d33] rounded-lg px-4 py-2 text-sm text-white font-mono"
                            />
                            <button
                                onClick={handleCopyLink}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                            >
                                <Copy className="h-4 w-4" /> Copy
                            </button>
                        </div>
                    </div>
                </div>

                {/* 4. Recent Referrals */}
                <div className="bg-[#1a1b1e] border border-[#2c2d33] rounded-2xl p-6 mb-8">
                    <h3 className="font-bold text-white mb-4">Recent Referrals</h3>
                    {referrals.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-muted-foreground border-b border-white/5 uppercase text-xs">
                                    <tr>
                                        <th className="py-3 font-medium">Wallet</th>
                                        <th className="py-3 font-medium">Joined</th>
                                        <th className="py-3 font-medium text-right">Volume</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {referrals.map((ref) => (
                                        <tr key={ref.address} className="hover:bg-white/5">
                                            <td className="py-3 font-mono text-muted-foreground">{ref.address.slice(0, 6)}...{ref.address.slice(-4)}</td>
                                            <td className="py-3">{new Date(ref.joinedAt).toLocaleDateString()}</td>
                                            <td className="py-3 text-right">${ref.lifetimeVolume.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            No referrals yet. Share your link to get started!
                        </div>
                    )}
                </div>

                {/* 5. Developer Tools (Simulation) */}
                <div className="rounded-xl border border-dashed border-yellow-500/30 bg-yellow-500/5 p-6">
                    <div className="flex items-center gap-2 mb-4 text-yellow-500">
                        <Info className="h-4 w-4" />
                        <h3 className="font-bold text-sm uppercase tracking-wider">Developer Simulation</h3>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-2">
                            <label className="text-xs text-muted-foreground">Simulate Trade Volume (USDC)</label>
                            <input
                                type="number"
                                value={simVolume}
                                onChange={(e) => setSimVolume(e.target.value)}
                                className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg px-4 py-2 text-white"
                            />
                        </div>
                        <button
                            onClick={handleSimulate}
                            disabled={isSimulating || referrals.length === 0}
                            className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg transition-colors h-10"
                        >
                            {isSimulating ? 'Processing...' : 'Simulate Trade'}
                        </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                        *This simulates a trade from your most recent referral to test commission & tier logic.
                    </p>
                </div>
            </div>
        </div>
    );
}

// --- Guest Landing View (Original Content) ---
function GuestView() {
    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero Section */}
            <section className="pt-20 pb-16 md:pt-32 text-center px-4 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-0 left-1/4 -mt-32 h-96 w-96 bg-green-500/10 blur-[100px] rounded-full pointer-events-none" />

                <div className="container max-w-4xl mx-auto space-y-8 relative z-10">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                        Earn <span className="text-green-500">10-50%</span> on Every Trade
                    </h1>
                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                        Share your link, earn forever. When your referrals profit, you profit. <br className="hidden md:block" />
                        <span className="text-white font-medium">No limits, no caps, no expiry. Tiers never downgrade!</span>
                    </p>

                    <div className="pt-4">
                        <button className="px-8 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-lg transition-all shadow-[0_0_20px_-5px_rgba(22,163,74,0.5)]">
                            Start Earning Now
                        </button>
                        <div className="mt-4 text-xs text-muted-foreground">
                            Free to join • $0.50 min payout • Daily payouts
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-8 pt-12 max-w-2xl mx-auto">
                        <div>
                            <div className="text-2xl md:text-3xl font-bold text-white">$10K+</div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Paid to affiliates</div>
                        </div>
                        <div>
                            <div className="flex items-center justify-center gap-1 text-2xl md:text-3xl font-bold text-white">
                                <Calendar className="h-6 w-6 text-red-400" /> 17
                            </div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Daily payouts</div>
                        </div>
                        <div>
                            <div className="flex items-center justify-center gap-1 text-2xl md:text-3xl font-bold text-white">
                                <Repeat className="h-6 w-6 text-white" />
                            </div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Lifetime duration</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-16 px-4">
                <div className="container max-w-5xl mx-auto">
                    <div className="bg-card border border-white/5 rounded-2xl p-8 md:p-12">
                        <h2 className="text-center text-xl font-semibold mb-12">How It Works</h2>

                        <div className="grid md:grid-cols-3 gap-8 relative">
                            {[
                                { icon: LinkIcon, title: "1. Share Link", desc: "Get your unique referral link" },
                                { icon: Users, title: "2. Friends Trade", desc: "They copy trade and profit" },
                                { icon: Wallet, title: "3. Get Paid", desc: "Earn 10-50% of profit fees" }
                            ].map((step, i) => (
                                <div key={i} className="flex flex-col items-center text-center relative group">
                                    {i < 2 && <div className="hidden md:block absolute top-[28px] left-[60%] w-[80%] h-[1px] bg-white/10" ><div className="absolute right-0 top-1/2 -mt-[3px] h-1.5 w-1.5 rounded-full bg-white/20" /></div>}

                                    <div className="h-14 w-14 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 text-blue-400 group-hover:scale-110 transition-transform">
                                        <step.icon className="h-6 w-6" />
                                    </div>
                                    <h3 className="font-bold text-lg mb-1">{step.title}</h3>
                                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Feature Grids */}
            <section className="py-8 px-4">
                <div className="container max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
                    <div className="p-6 rounded-xl bg-card border border-white/5 hover:bg-white/5 transition-colors">
                        <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500 mb-4">
                            <BarChart3 className="h-5 w-5" />
                        </div>
                        <h3 className="font-bold mb-2">Tiered Rewards</h3>
                        <p className="text-sm text-muted-foreground">Start at 10%, climb to <span className="text-white">50%</span> based on volume. Tiers never downgrade!</p>
                    </div>
                    <div className="p-6 rounded-xl bg-card border border-white/5 hover:bg-white/5 transition-colors">
                        <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4">
                            <Calendar className="h-5 w-5" />
                        </div>
                        <h3 className="font-bold mb-2">Daily Payouts</h3>
                        <p className="text-sm text-muted-foreground">Commissions logged instantly, paid <span className="text-blue-400">daily</span> when you reach $0.50.</p>
                    </div>
                    <div className="p-6 rounded-xl bg-card border border-white/5 hover:bg-white/5 transition-colors">
                        <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 mb-4">
                            <Repeat className="h-5 w-5" />
                        </div>
                        <h3 className="font-bold mb-2">Forever Yours</h3>
                        <p className="text-sm text-muted-foreground">Referrals are <span className="text-purple-400">permanent</span>. Earn for as long as they trade.</p>
                    </div>
                </div>
            </section>

            {/* Tier Ladder */}
            <section className="py-16 px-4">
                <div className="container max-w-4xl mx-auto">
                    <div className="rounded-2xl border border-yellow-500/20 bg-gradient-to-b from-yellow-900/10 to-transparent p-1">
                        <div className="rounded-xl bg-card/80 backdrop-blur p-8 md:p-12 text-center">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <Trophy className="h-5 w-5 text-yellow-500" />
                                <h2 className="text-lg font-bold text-yellow-500">Volume-Based Tier Ladder</h2>
                            </div>
                            <p className="text-sm text-muted-foreground mb-8">
                                Climb tiers as your referrals trade. Upgrades are instant and <span className="text-green-500">permanent</span>!
                            </p>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                {[
                                    { tier: "Bronze", rate: "10%", req: "Start volume", color: "text-orange-400" },
                                    { tier: "Silver", rate: "20%", req: "$500k volume", color: "text-gray-300" },
                                    { tier: "Gold", rate: "30%", req: "$2.5M volume", color: "text-yellow-400" },
                                    { tier: "Platinum", rate: "40%", req: "$10M volume", color: "text-cyan-400" },
                                    { tier: "Diamond", rate: "50%", req: "$50M volume", color: "text-purple-400" },
                                ].map((item, i) => (
                                    <div key={i} className="p-4 rounded-lg bg-white/5 border border-white/5 flex flex-col items-center">
                                        <Trophy className={cn("h-6 w-6 mb-2", item.color)} />
                                        <div className={cn("font-bold text-sm", item.color)}>{item.tier}</div>
                                        <div className="text-xl font-bold text-white my-1">{item.rate}</div>
                                        <div className="text-[10px] text-muted-foreground uppercase">{item.req}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 text-xs text-muted-foreground">
                                Volume = total USD traded by your referrals. <br />
                                <span className="text-green-500">Once you reach a tier, you keep it forever!</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-4">
                <div className="container max-w-3xl mx-auto">
                    <div className="rounded-2xl bg-green-900/20 border border-green-500/20 p-12 text-center">
                        <h2 className="text-3xl font-bold mb-4">Ready to Start Earning?</h2>
                        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                            Join hundreds of affiliates already earning passive income. It takes 30 seconds to get started.
                        </p>
                        <div className="flex flex-col items-center gap-2">
                            <button className="px-8 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold transition-all w-full md:w-auto flex items-center justify-center gap-2">
                                <LinkIcon className="h-4 w-4" /> Get Your Referral Link
                            </button>
                            <p className="text-[10px] text-muted-foreground mt-2">100% free — Paid in USDC (Polygon)</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
