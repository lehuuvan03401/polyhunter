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
            let referee = referrals.length > 0 ? referrals[0].address : null;

            // If no referrals, auto-create a test one
            if (!referee) {
                const toastId = toast.loading('Creating test referral...');
                try {
                    // Create a random wallet address
                    const randomWallet = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
                    // Track it
                    const trackRes = await affiliateApi.trackReferral(stats?.referralCode || '', walletAddress, randomWallet);

                    if (trackRes.success) {
                        referee = randomWallet;
                        toast.dismiss(toastId);
                        toast.success('Created test referral!');

                        // Refresh referrals list
                        const newReferrals = await affiliateApi.getReferrals(walletAddress);
                        setReferrals(newReferrals);
                    } else {
                        toast.dismiss(toastId);
                        toast.error('Failed to create test referral');
                        return;
                    }
                } catch (e) {
                    toast.dismiss(toastId);
                    toast.error('Failed to create test referral');
                    return;
                }
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

    const tierInfo = stats ? TIER_INFO[stats.tier] : TIER_INFO.ORDINARY;
    const referralLink = stats?.referralCode ? generateReferralLink(stats.referralCode) : '';
    const progressPercent = stats?.nextTier
        ? Math.min(100, ((stats.totalReferrals) / (tierInfo.minTeam || 1)) * 100)
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
                            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg border-2 border-white/10">
                                {stats?.tier === 'SUPER_PARTNER' ? '👑' : stats?.tier === 'PARTNER' ? '🤝' : stats?.tier === 'ELITE' ? '⚔️' : stats?.tier === 'VIP' ? '💎' : '👤'}
                            </div>
                            <div>
                                <div className="text-sm text-yellow-500 font-medium mb-1">Current Rank</div>
                                <h2 className={cn("text-3xl font-bold mb-1", tierInfo.color)}>{tierInfo.name}</h2>
                                <div className="inline-flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-500 text-sm font-bold">
                                        Zero Line: {((stats?.commissionRate || 0.25) * 100).toFixed(0)}%
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 text-sm font-bold">
                                        Team Diff: {((stats?.tier === 'ORDINARY' ? 0.01 : stats?.tier === 'VIP' ? 0.02 : stats?.tier === 'ELITE' ? 0.03 : stats?.tier === 'PARTNER' ? 0.05 : 0.08) * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-1/2">
                            {stats?.nextTier ? (
                                <>
                                    <div className="flex justify-between text-xs mb-2">
                                        <span className="text-muted-foreground">Next Rank: <span className="text-white font-bold">{stats.nextTier}</span></span>
                                        <span className="text-white font-medium">
                                            {stats.totalReferrals} / {tierInfo.minTeam} Team Members
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mb-1">
                                        <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, (stats.totalReferrals / (tierInfo.minTeam || 1)) * 100)}%` }} />
                                    </div>
                                    <div className="text-[10px] text-muted-foreground text-right">
                                        Goal: {(tierInfo.minTeam)} Active Members
                                    </div>
                                </>
                            ) : (
                                <div className="text-center text-yellow-400 font-medium border border-yellow-500/20 rounded-lg p-3 bg-yellow-500/5">
                                    🎉 Top Rank Achieved! You are a Super Partner.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {[
                        { label: "Direct Referrals", value: `${stats?.totalReferrals || 0}`, sub: "Zero Line (Gen 1)", icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
                        { label: "Team Size", value: `${stats?.teamSize || 0}`, sub: "Total Network (Downline)", icon: Wallet, color: "text-purple-500", bg: "bg-purple-500/10" },
                        { label: "Sun Lines", value: `${stats?.sunLineCount || 0}`, sub: "Strong Legs", icon: Trophy, color: "text-yellow-500", bg: "bg-yellow-500/10" },
                        { label: "Total Earnings", value: `$${(stats?.totalEarned || 0).toFixed(2)}`, sub: `$${(stats?.earningsBreakdown?.zeroLine || 0).toFixed(2)} Zero / $${(stats?.earningsBreakdown?.sunLine || 0).toFixed(2)} Sun`, icon: Calendar, color: "text-green-500", bg: "bg-green-500/10" },
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
                        <h3 className="font-bold text-white">Your Recruitment Link</h3>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <p className="text-sm text-muted-foreground md:w-1/3">
                            Build your team. You earn overrides on 15 generations of referrals.
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

                {/* 4. Team Network (New) */}
                <div className="bg-[#1a1b1e] border border-[#2c2d33] rounded-2xl p-6 mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Users className="h-4 w-4 text-purple-400" />
                            Team Network Structure
                        </h3>
                        {/* Tab toggle could go here: Tree vs List */}
                    </div>

                    {referrals.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-muted-foreground border-b border-white/5 uppercase text-xs">
                                    <tr>
                                        <th className="py-3 font-medium pl-4">Member</th>
                                        <th className="py-3 font-medium">Rank</th>
                                        <th className="py-3 font-medium">Gen</th>
                                        <th className="py-3 font-medium text-right">Volume</th>
                                        <th className="py-3 font-medium text-right bg-yellow-500/5 text-yellow-500 pr-4">Team Size</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {referrals.map((ref) => (
                                        <tr key={ref.address} className="hover:bg-white/5 transition-colors">
                                            <td className="py-3 pl-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 rounded-full bg-white/5 flex items-center justify-center text-xs">
                                                        {ref.address.slice(2, 4)}
                                                    </div>
                                                    <span className="font-mono text-muted-foreground">{ref.address.slice(0, 6)}...{ref.address.slice(-4)}</span>
                                                    {ref.isSunLine && <span className="text-[10px] bg-yellow-500 text-black px-1.5 rounded font-bold">SUN</span>}
                                                </div>
                                            </td>
                                            <td className="py-3">
                                                <span className={cn("text-xs px-2 py-0.5 rounded border border-white/10",
                                                    ref.tier === 'ORDINARY' ? 'text-gray-400' :
                                                        ref.tier === 'VIP' ? 'text-blue-400 bg-blue-400/5' :
                                                            'text-purple-400 bg-purple-400/5'
                                                )}>{ref.tier || 'ORDINARY'}</span>
                                            </td>
                                            <td className="py-3 text-white/50">{ref.depth || 1}</td>
                                            <td className="py-3 text-right font-mono">${(ref.totalVolume || 0).toLocaleString()}</td>
                                            <td className="py-3 text-right bg-yellow-500/5 text-yellow-500/80 pr-4 font-mono">
                                                {/* In a real tree API we'd carry this count, for now mock or simple 0 if not available */}
                                                {(ref.referrals?._count || 0) > 0 ? ref.referrals._count : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {referrals.length > 5 && (
                                <div className="mt-4 text-center text-xs text-muted-foreground hover:text-white cursor-pointer transition-colors">
                                    View full network tree &rarr;
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12 rounded-xl border border-dashed border-white/10 bg-white/5">
                            <div className="h-12 w-12 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-3 text-muted-foreground">
                                <Users className="h-6 w-6" />
                            </div>
                            <div className="font-medium text-white mb-1">Your team is empty</div>
                            <p className="text-sm text-muted-foreground">Share your link to start building your organization.</p>
                        </div>
                    )}
                </div>

                {/* 5. Developer Tools (Simulation) - Unchanged essentially, maybe label updates */}
                <div className="rounded-xl border border-dashed border-yellow-500/30 bg-yellow-500/5 p-6">
                    {/* ... (Kept similar for testing commissions) ... */}
                    <div className="flex items-center gap-2 mb-4 text-yellow-500">
                        <Info className="h-4 w-4" />
                        <h3 className="font-bold text-sm uppercase tracking-wider">Commission Simulator</h3>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-2">
                            <label className="text-xs text-muted-foreground">Simulate Trade Fee (USDC)</label>
                            <input
                                type="number"
                                value={simVolume}
                                onChange={(e) => setSimVolume(e.target.value)}
                                className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg px-4 py-2 text-white"
                            />
                        </div>
                        <button
                            onClick={handleSimulate}
                            disabled={isSimulating}
                            className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg transition-colors h-10"
                        >
                            {isSimulating ? 'Processing...' : 'Simulate Fee Event'}
                        </button>
                    </div>
                </div>

            </div>

            {/* Legacy Guest View Tiers Ladder Section - Updated for new Ranks */}
            <section className="py-16 hidden">
                {/* We can hide or update the guest view section later if needed or if user logs out */}
            </section>
        </div>
    );
}

// --- Guest Landing View ---
function GuestView() {
    const { login } = usePrivy();

    return (
        <div className="flex flex-col min-h-screen">
            <section className="pt-20 pb-16 md:pt-32 text-center px-4 relative overflow-hidden">
                <div className="absolute top-0 left-1/4 -mt-32 h-96 w-96 bg-green-500/10 blur-[100px] rounded-full pointer-events-none" />
                <div className="container max-w-4xl mx-auto space-y-8 relative z-10">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                        Earn <span className="text-green-500">Zero & Sun Line</span> Rewards
                    </h1>
                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                        Share your link, earn on 15 generations. <br className="hidden md:block" />
                        <span className="text-white font-medium">Direct commissions + Team overrides.</span>
                    </p>
                    <div className="pt-4">
                        <button onClick={login} className="px-8 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-lg transition-all">
                            Start Earning Now
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}

