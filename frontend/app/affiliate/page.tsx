'use client';

import Link from 'next/link';
import { Link as LinkIcon, Users, Wallet, BarChart3, Copy, Info, Clock, Loader2, Calendar, Repeat, CheckCircle, Trophy, List, GitBranch, HelpCircle, Coins, CreditCard, LayoutDashboard, Quote } from 'lucide-react';
// ... existing imports ...

// ... inside GuestView ...
const TESTIMONIALS = [
    {
        name: "Alex M.",
        role: "Super Partner",
        earnings: "$12,450",
        period: "last month",
        quote: "I started sharing my link in a few discord groups. Now I'm earning more from commissions than my actual trading.",
        avatar: "👨‍💻"
    },
    {
        name: "Sarah K.",
        role: "Elite Affiliate",
        earnings: "$4,200",
        period: "this week",
        quote: "The 5-generation system is a game changer. My network keeps growing automatically as my referrals invite their friends.",
        avatar: "👩‍💼"
    },
    {
        name: "CryptoDave",
        role: "VIP Member",
        earnings: "$850",
        period: "passive income",
        quote: "I just posted my link on Twitter and forgot about it. Woke up to free USDC in my wallet. Easiest money ever.",
        avatar: "🚀"
    }
];

// ... render return ...

{/* Commission Rates (Existing) */ }
{/* ... */ }

{/* Success Stories Section (New) */ }
<section className="py-20 border-t border-white/5 bg-gradient-to-b from-transparent to-yellow-500/5">
    <div className="container max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Success Stories</h2>
            <p className="text-muted-foreground">See what our top partners are earning</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t, i) => (
                <div key={i} className="bg-card/40 backdrop-blur-md border border-white/5 hover:border-yellow-500/30 p-8 rounded-2xl relative group transition-all duration-300 hover:-translate-y-1">
                    <div className="absolute top-6 right-6 text-yellow-500/10 group-hover:text-yellow-500/20 transition-colors">
                        <Quote className="h-10 w-10" />
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center text-2xl border border-yellow-500/20">
                            {t.avatar}
                        </div>
                        <div>
                            <div className="font-bold text-white">{t.name}</div>
                            <div className="text-xs text-yellow-500 font-medium uppercase tracking-wide">{t.role}</div>
                        </div>
                    </div>

                    <p className="text-muted-foreground mb-6 leading-relaxed relative z-10">
                        "{t.quote}"
                    </p>

                    <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">Total Earned</div>
                        <div className="text-green-500 font-bold font-mono text-lg">
                            {t.earnings} <span className="text-xs text-muted-foreground font-normal ml-1">/ {t.period}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
</section>

{/* CTA (Existing) */ }
import { cn } from '@/lib/utils';
import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { affiliateApi, type AffiliateStats, TIER_INFO, generateReferralLink } from '@/lib/affiliate-api';
import { GenerationSummaryBar } from '@/components/affiliate/generation-summary-bar';
import { TeamTreeView } from '@/components/affiliate/team-tree-view';

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

    const handleWithdraw = async () => {
        if (!stats || stats.pendingPayout < 10) {
            toast.error('Minimum withdrawal amount is $10');
            return;
        }

        const confirm = window.confirm(`Request payout of $${stats.pendingPayout.toFixed(2)}?\n\nYou will be asked to sign a message to authorize this withdrawal.`);
        if (!confirm) return;

        const toastId = toast.loading('Preparing withdrawal...');
        try {
            // 1. Get the message to sign
            const timestamp = Date.now();
            const { message, amount } = await affiliateApi.getPayoutMessage(walletAddress, timestamp);

            toast.loading('Please sign the message in your wallet...', { id: toastId });

            // 2. Request signature from wallet (using window.ethereum as fallback)
            let signature: string;
            if (typeof window !== 'undefined' && (window as any).ethereum) {
                const provider = (window as any).ethereum;
                signature = await provider.request({
                    method: 'personal_sign',
                    params: [message, walletAddress],
                });
            } else {
                toast.dismiss(toastId);
                toast.error('No wallet detected. Please connect your wallet.');
                return;
            }

            toast.loading('Submitting withdrawal request...', { id: toastId });

            // 3. Submit with signature
            const result = await affiliateApi.requestPayout(walletAddress, signature, timestamp);
            if (result.success) {
                toast.dismiss(toastId);
                toast.success(`Withdrawal of $${amount.toFixed(2)} submitted!`);
                // Refresh
                const [statsData, referralsData] = await Promise.all([
                    affiliateApi.getStats(walletAddress),
                    affiliateApi.getReferrals(walletAddress)
                ]);
                setStats(statsData);
                setReferrals(referralsData);
            } else {
                toast.dismiss(toastId);
                toast.error(result.error || 'Withdrawal failed');
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            if (e.code === 4001 || e.message?.includes('rejected')) {
                toast.error('Signature request was rejected');
            } else {
                toast.error(e.message || 'Network error requesting payout');
            }
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
        // Landing page data
        const BENEFITS = [
            { icon: '💵', title: '25% Commission', desc: 'Earn from every trade your referrals make' },
            { icon: '🌳', title: '5 Generations Deep', desc: 'Build a team and earn from your entire network' },
            { icon: '⚡', title: 'Instant Payouts', desc: 'Withdraw your earnings anytime, no minimums' },
            { icon: '🚀', title: 'Tier Progression', desc: 'Level up to unlock higher commission rates' },
        ];

        const STEPS = [
            { num: 1, title: 'Register', desc: 'Sign up and get your unique referral link' },
            { num: 2, title: 'Share', desc: 'Invite friends with your personal link' },
            { num: 3, title: 'Earn', desc: 'Get paid on every trade they make' },
        ];

        const TIERS = [
            { name: 'ORDINARY', color: 'text-gray-400', directs: 0, team: 0, zero: 1, diff: 1 },
            { name: 'VIP', color: 'text-blue-400', directs: 3, team: 10, zero: 2, diff: 2 },
            { name: 'ELITE', color: 'text-purple-400', directs: 10, team: 100, zero: 3, diff: 3 },
            { name: 'PARTNER', color: 'text-yellow-400', directs: 30, team: 500, zero: 5, diff: 5 },
            { name: 'SUPER', color: 'text-orange-400', directs: 50, team: 1000, zero: 8, diff: 8 },
        ];

        const ZERO_LINE_RATES = [
            { gen: 1, rate: 25, label: 'Direct Referral' },
            { gen: 2, rate: 10, label: '2nd Generation' },
            { gen: 3, rate: 5, label: '3rd Generation' },
            { gen: 4, rate: 3, label: '4th Generation' },
            { gen: 5, rate: 2, label: '5th Generation' },
        ];

        return (
            <div className="min-h-screen bg-[#0d0e10] text-white">
                {/* Hero Section */}
                <section className="pt-24 pb-16 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/5 to-transparent pointer-events-none" />
                    <div className="absolute top-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]" />
                    <div className="absolute bottom-0 left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px]" />

                    <div className="container max-w-4xl mx-auto px-4 text-center relative z-10">
                        <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-blue-500/20">
                            <span className="animate-pulse">✨</span>
                            Passive Income Opportunity
                        </div>

                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                            Earn While <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">You Sleep</span>
                        </h1>

                        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                            Turn your network into income. Earn up to <strong className="text-green-400">25% commission</strong> on every trade your referrals make — plus bonuses from <strong className="text-blue-400">5 generations</strong> of your team.
                        </p>

                        <button
                            onClick={handleRegister}
                            disabled={isRegistering}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold py-4 px-10 rounded-xl transition-all flex items-center gap-3 mx-auto text-lg shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                        >
                            {isRegistering ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>🚀</span>}
                            {isRegistering ? 'Registering...' : 'Start Earning Now'}
                        </button>

                        <p className="text-sm text-muted-foreground mt-4">Free to join • No minimums • Instant setup</p>
                    </div>
                </section>

                {/* Benefits Grid */}
                <section className="py-16 border-t border-white/5">
                    <div className="container max-w-5xl mx-auto px-4">
                        <h2 className="text-2xl font-bold text-center mb-10">Why Join Our Affiliate Program?</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {BENEFITS.map((b, i) => (
                                <div key={i} className="bg-[#1a1b1e] border border-white/10 rounded-xl p-6 text-center hover:border-blue-500/30 transition-colors">
                                    <div className="text-4xl mb-4">{b.icon}</div>
                                    <h3 className="font-bold text-lg mb-2">{b.title}</h3>
                                    <p className="text-sm text-muted-foreground">{b.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* How It Works */}
                <section className="py-16 bg-[#15161a] border-y border-white/5">
                    <div className="container max-w-4xl mx-auto px-4">
                        <h2 className="text-2xl font-bold text-center mb-12">How It Works</h2>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                            {STEPS.map((s, i) => (
                                <div key={i} className="flex flex-col items-center text-center flex-1">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold mb-4 shadow-lg">
                                        {s.num}
                                    </div>
                                    <h3 className="font-bold text-lg mb-2">{s.title}</h3>
                                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                                    {i < STEPS.length - 1 && (
                                        <div className="hidden md:block absolute translate-x-20 w-20 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Tier System */}
                <section className="py-16">
                    <div className="container max-w-5xl mx-auto px-4">
                        <h2 className="text-2xl font-bold text-center mb-4">Tier System</h2>
                        <p className="text-muted-foreground text-center mb-10">Level up to unlock higher commission rates</p>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm bg-[#1a1b1e] rounded-xl border border-white/10">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left py-4 px-6 font-medium text-muted-foreground">Tier</th>
                                        <th className="text-center py-4 px-4 font-medium text-muted-foreground">Direct Referrals</th>
                                        <th className="text-center py-4 px-4 font-medium text-muted-foreground">Team Size</th>
                                        <th className="text-center py-4 px-4 font-medium text-green-400">Zero Line %</th>
                                        <th className="text-center py-4 px-4 font-medium text-yellow-400">Team Diff %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {TIERS.map((t, i) => (
                                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                            <td className={`py-4 px-6 font-bold ${t.color}`}>{t.name}</td>
                                            <td className="text-center py-4 px-4 font-mono">{t.directs}</td>
                                            <td className="text-center py-4 px-4 font-mono">{t.team}</td>
                                            <td className="text-center py-4 px-4 font-mono text-green-400">{t.zero}%</td>
                                            <td className="text-center py-4 px-4 font-mono text-yellow-400">{t.diff}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* Zero Line Rates */}
                <section className="py-16 bg-[#15161a] border-y border-white/5">
                    <div className="container max-w-3xl mx-auto px-4">
                        <h2 className="text-2xl font-bold text-center mb-4">Earn From 5 Generations</h2>
                        <p className="text-muted-foreground text-center mb-10">Your cut from platform fees on every trade</p>

                        <div className="space-y-4">
                            {ZERO_LINE_RATES.map((r) => (
                                <div key={r.gen} className="flex items-center gap-4">
                                    <div className="w-32 text-sm text-muted-foreground">{r.label}</div>
                                    <div className="flex-1 h-8 bg-[#1a1b1e] rounded-lg overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-lg flex items-center justify-end px-3"
                                            style={{ width: `${r.rate * 4}%` }}
                                        >
                                            <span className="text-sm font-bold text-white">{r.rate}%</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                            <p className="text-sm text-green-400">
                                <strong>Example:</strong> $10,000 trade → $10 platform fee → <strong>$2.50</strong> to you (Gen 1)
                            </p>
                        </div>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="py-20">
                    <div className="container max-w-2xl mx-auto px-4 text-center">
                        <h2 className="text-3xl font-bold mb-4">Ready to Start Earning?</h2>
                        <p className="text-muted-foreground mb-8">Join thousands of affiliates building passive income</p>

                        <button
                            onClick={handleRegister}
                            disabled={isRegistering}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold py-4 px-10 rounded-xl transition-all flex items-center gap-3 mx-auto text-lg shadow-lg shadow-blue-500/25"
                        >
                            {isRegistering ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>🚀</span>}
                            {isRegistering ? 'Registering...' : 'Become an Affiliate'}
                        </button>

                        <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4 text-green-400" /> Free to join</span>
                            <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4 text-green-400" /> No minimum</span>
                            <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4 text-green-400" /> Instant setup</span>
                        </div>
                    </div>
                </section>
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
                                    <Link
                                        href="/affiliate/rules"
                                        className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-sm transition-colors flex items-center gap-1"
                                        title="Learn how commissions work"
                                    >
                                        <HelpCircle className="h-3 w-3" />
                                        <span>Learn More</span>
                                    </Link>
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
                        {
                            label: "Total Earnings",
                            value: `$${(stats?.totalEarned || 0).toFixed(2)}`,
                            sub: `$${(stats?.earningsBreakdown?.zeroLine || 0).toFixed(2)} Zero / $${(stats?.earningsBreakdown?.sunLine || 0).toFixed(2)} Sun`,
                            icon: Calendar,
                            color: "text-green-500",
                            bg: "bg-green-500/10",
                            action: (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleWithdraw(); }}
                                    className="ml-auto text-xs bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded"
                                    title="Withdraw Funds"
                                >
                                    Withdraw
                                </button>
                            )
                        },
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

                {/* 4. Team Network - IMPROVED */}
                <TeamNetworkSection walletAddress={walletAddress} />

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

    const BENEFITS = [
        { icon: <Coins className="h-10 w-10" />, title: 'Commission', desc: 'Earn a share of platform fees from trades' },
        { icon: <LinkIcon className="h-10 w-10" />, title: 'Referral Link', desc: 'Get your unique link to share' },
        { icon: <LayoutDashboard className="h-10 w-10" />, title: 'Dashboard', desc: 'Track earnings and referrals in real-time' },
        { icon: <CreditCard className="h-10 w-10" />, title: 'Withdrawals', desc: 'Request payouts anytime' },
    ];

    const RATES = [
        { gen: 1, rate: 25, label: 'Direct Referral' },
        { gen: 2, rate: 10, label: '2nd Level' },
        { gen: 3, rate: 5, label: '3rd Level' },
        { gen: 4, rate: 3, label: '4th Level' },
        { gen: 5, rate: 2, label: '5th Level' },
    ];

    const TESTIMONIALS = [
        {
            name: "Alex M.",
            role: "Super Partner",
            earnings: "$12,450",
            period: "last month",
            quote: "I started sharing my link in a few discord groups. Now I'm earning more from commissions than my actual trading.",
            avatar: "👨‍💻"
        },
        {
            name: "Sarah K.",
            role: "Elite Affiliate",
            earnings: "$4,200",
            period: "this week",
            quote: "The 5-generation system is a game changer. My network keeps growing automatically as my referrals invite their friends.",
            avatar: "👩‍💼"
        },
        {
            name: "CryptoDave",
            role: "VIP Member",
            earnings: "$850",
            period: "passive income",
            quote: "I just posted my link on Twitter and forgot about it. Woke up to free USDC in my wallet. Easiest money ever.",
            avatar: "🚀"
        }
    ];

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Hero */}
            <section className="pt-24 pb-16 relative overflow-hidden text-center px-4">
                {/* Background Effects */}
                <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 via-transparent to-transparent pointer-events-none" />
                <div className="absolute top-20 right-20 w-96 h-96 bg-yellow-500/10 rounded-full blur-[120px] pointer-events-none opacity-50" />
                <div className="absolute bottom-0 left-20 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none opacity-30" />

                <div className="container max-w-4xl mx-auto relative z-10 space-y-6">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                        Affiliate <span className="text-yellow-500">Commission</span> Program
                    </h1>
                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        Share your referral link and earn commission when your referrals trade on the platform.
                        Track your earnings, manage your network, and withdraw anytime.
                    </p>

                    <div className="pt-4">
                        <button
                            onClick={login}
                            className="px-10 py-4 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg transition-all shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/30 active:scale-[0.98]"
                        >
                            Connect Wallet to Start
                        </button>
                    </div>
                </div>
            </section>

            {/* How It Works / Benefits */}
            <section className="py-20 border-y border-white/5 bg-card/30 backdrop-blur-sm">
                <div className="container max-w-6xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold mb-4">How It Works</h2>
                        <p className="text-muted-foreground">Everything you need to build your passive income stream</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {BENEFITS.map((b, i) => (
                            <div key={i} className="bg-card/50 border border-white/5 hover:border-yellow-500/30 rounded-xl p-8 text-center transition-all group flex flex-col items-center">
                                <div className="mb-4 text-yellow-500 transform group-hover:scale-110 transition-transform duration-300 bg-yellow-500/10 p-4 rounded-full">
                                    {b.icon}
                                </div>
                                <h3 className="font-bold text-lg mb-2 text-foreground group-hover:text-yellow-500 transition-colors">{b.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Commission Rates */}
            <section className="py-20">
                <div className="container max-w-3xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold mb-4">Commission Structure</h2>
                        <p className="text-muted-foreground">
                            Earn a percentage of platform trading fees from up to 5 generations
                        </p>
                    </div>

                    <div className="space-y-6">
                        {RATES.map((r, index) => (
                            <div key={r.gen} className="group">
                                <div className="flex items-center justify-between mb-2 text-sm">
                                    <span className="text-muted-foreground font-medium">{r.label}</span>
                                    <span className="font-bold text-yellow-500">{r.rate}% Commission</span>
                                </div>
                                <div className="h-4 bg-muted/50 rounded-full overflow-hidden border border-white/5">
                                    <div
                                        className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full relative group-hover:shadow-[0_0_10px_rgba(234,179,8,0.3)] transition-all duration-500"
                                        style={{ width: `${r.rate * 4}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-12 p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-center">
                        <p className="text-base text-yellow-500/90">
                            <strong>Example:</strong> Your referral makes a $10,000 trade → $10 platform fee → You earn <strong>$2.50</strong>
                        </p>
                    </div>
                </div>
            </section>

            {/* Testimonials Section */}
            <section className="py-20 border-t border-white/5 bg-gradient-to-b from-transparent to-yellow-500/5">
                <div className="container max-w-6xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold mb-4">Success Stories</h2>
                        <p className="text-muted-foreground">See what our top partners are earning</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {TESTIMONIALS.map((t, i) => (
                            <div key={i} className="bg-card/40 backdrop-blur-md border border-white/5 hover:border-yellow-500/30 p-8 rounded-2xl relative group transition-all duration-300 hover:-translate-y-1">
                                <div className="absolute top-6 right-6 text-yellow-500/10 group-hover:text-yellow-500/20 transition-colors">
                                    <Quote className="h-10 w-10" />
                                </div>

                                <div className="flex items-center gap-4 mb-6">
                                    <div className="h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center text-2xl border border-yellow-500/20">
                                        {t.avatar}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white">{t.name}</div>
                                        <div className="text-xs text-yellow-500 font-medium uppercase tracking-wide">{t.role}</div>
                                    </div>
                                </div>

                                <p className="text-muted-foreground mb-6 leading-relaxed relative z-10">
                                    "{t.quote}"
                                </p>

                                <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                                    <div className="text-sm text-muted-foreground">Total Earned</div>
                                    <div className="text-green-500 font-bold font-mono text-lg">
                                        {t.earnings} <span className="text-xs text-muted-foreground font-normal ml-1">/ {t.period}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Lower CTA */}
            <section className="py-24 bg-gradient-to-t from-yellow-500/5 to-transparent">
                <div className="container max-w-2xl mx-auto px-4 text-center space-y-8">
                    <h2 className="text-3xl md:text-4xl font-bold">Ready to Get Started?</h2>
                    <p className="text-lg text-muted-foreground">
                        Connect your wallet now to generate your unique referral link and start building your network.
                    </p>
                    <button
                        onClick={login}
                        className="px-12 py-4 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg transition-all shadow-lg shadow-yellow-500/20"
                    >
                        Connect Wallet
                    </button>

                    <div className="flex items-center justify-center gap-6 pt-4 text-sm text-center">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="text-green-500">✓</span> Free to join
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="text-green-500">✓</span> No minimums
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="text-green-500">✓</span> Instant setup
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

// --- Team Network Section (New) ---
interface GenerationData {
    generation: number;
    count: number;
    percentage: number;
}

interface TreeMember {
    address: string;
    referralCode?: string;
    tier: string;
    volume: number;
    teamSize: number;
    depth: number;
    children: TreeMember[];
}

function TeamNetworkSection({ walletAddress }: { walletAddress: string }) {
    const [viewMode, setViewMode] = useState<'summary' | 'tree'>('summary');
    const [isLoading, setIsLoading] = useState(true);
    const [generationData, setGenerationData] = useState<GenerationData[]>([]);
    const [totalMembers, setTotalMembers] = useState(0);
    const [treeData, setTreeData] = useState<TreeMember[]>([]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch summary
            const summaryRes = await fetch(`/api/affiliate/team/summary?walletAddress=${walletAddress}`);
            if (summaryRes.ok) {
                const summary = await summaryRes.json();
                setGenerationData(summary.byGeneration || []);
                setTotalMembers(summary.total || 0);
            }

            // Fetch tree data
            const treeRes = await fetch(`/api/affiliate/team?walletAddress=${walletAddress}&format=tree`);
            if (treeRes.ok) {
                const tree = await treeRes.json();
                setTreeData(tree.directReferrals || []);
            }
        } catch (e) {
            console.warn('Failed to load team data', e);
        } finally {
            setIsLoading(false);
        }
    }, [walletAddress]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="bg-[#1a1b1e] border border-[#2c2d33] rounded-2xl p-6 mb-8">
            {/* Header with Toggle */}
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-400" />
                    Team Network Structure
                </h3>
                <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                    <button
                        onClick={() => setViewMode('summary')}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5",
                            viewMode === 'summary' ? 'bg-purple-500 text-white' : 'text-muted-foreground hover:text-white'
                        )}
                    >
                        <BarChart3 className="h-3 w-3" />
                        Summary
                    </button>
                    <button
                        onClick={() => setViewMode('tree')}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5",
                            viewMode === 'tree' ? 'bg-purple-500 text-white' : 'text-muted-foreground hover:text-white'
                        )}
                    >
                        <GitBranch className="h-3 w-3" />
                        Tree
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <>
                    {/* Generation Summary Bar - Always show at top */}
                    <GenerationSummaryBar
                        data={generationData}
                        total={totalMembers}
                        className="mb-6"
                    />

                    {/* Tree View (expandable) or Summary View (collapsed direct stats only) */}
                    {viewMode === 'tree' ? (
                        <TeamTreeView directReferrals={treeData} />
                    ) : (
                        /* Summary Mode: Show only direct referrals in a compact table */
                        <div className="space-y-2">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 px-1">
                                Direct Referrals ({treeData.length})
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-muted-foreground border-b border-white/5 uppercase text-xs">
                                        <tr>
                                            <th className="py-2 font-medium pl-2">Member</th>
                                            <th className="py-2 font-medium">Rank</th>
                                            <th className="py-2 font-medium text-right">Volume</th>
                                            <th className="py-2 font-medium text-right pr-2 text-yellow-500">Team</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {treeData.map((ref, idx) => (
                                            <tr key={ref.address || idx} className="hover:bg-white/5 transition-colors">
                                                <td className="py-2.5 pl-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-mono text-muted-foreground">
                                                            {ref.address?.slice(2, 4) || '??'}
                                                        </div>
                                                        <span className="font-mono text-white/80">
                                                            {ref.referralCode || `${ref.address?.slice(0, 6)}...${ref.address?.slice(-4)}`}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-2.5">
                                                    <span className={cn("text-xs px-1.5 py-0.5 rounded border",
                                                        ref.tier === 'ORDINARY' ? 'text-gray-400 border-gray-400/30' :
                                                            ref.tier === 'VIP' ? 'text-blue-400 bg-blue-400/10 border-blue-400/30' :
                                                                ref.tier === 'ELITE' ? 'text-purple-400 bg-purple-400/10 border-purple-400/30' :
                                                                    'text-yellow-400 bg-yellow-400/10 border-yellow-400/30'
                                                    )}>{ref.tier}</span>
                                                </td>
                                                <td className="py-2.5 text-right font-mono text-white/60">
                                                    ${(ref.volume || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </td>
                                                <td className="py-2.5 text-right pr-2 font-mono text-yellow-500/80">
                                                    {ref.teamSize > 0 ? ref.teamSize : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}


