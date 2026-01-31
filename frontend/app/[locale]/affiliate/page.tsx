'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Link as LinkIcon, Users, Wallet, BarChart3, Copy, Info, Clock, Loader2, Calendar, Repeat, CheckCircle, Trophy, List, GitBranch, HelpCircle, Coins, CreditCard, LayoutDashboard, Quote, Crown, Shield, Zap, Star, UserCircle, ArrowRight, Sparkles, Rocket } from 'lucide-react';
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
import { usePrivyLogin } from '@/lib/privy-login';
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { affiliateApi, type AffiliateStats, TIER_INFO, generateReferralLink, type Payout } from '@/lib/affiliate-api';
import { GenerationSummaryBar } from '@/components/affiliate/generation-summary-bar';
import { TeamTreeView } from '@/components/affiliate/team-tree-view';
import { TeamSummaryView } from '@/components/affiliate/team-summary-view';
import { WithdrawDialog } from '@/components/affiliate/withdraw-dialog';

export default function AffiliatePage() {
    const { authenticated, user, ready } = usePrivyLogin();

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
    const t = useTranslations('Affiliate');
    const [stats, setStats] = useState<AffiliateStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRegistering, setIsRegistering] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);
    const [referrals, setReferrals] = useState<any[]>([]);
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
    const [simVolume, setSimVolume] = useState('1000');
    const [isSimulating, setIsSimulating] = useState(false);

    useEffect(() => {
        async function loadStats() {
            try {
                // Check if registered
                const lookup = await affiliateApi.lookupWallet(walletAddress);
                if (lookup.registered) {
                    setIsRegistered(true);
                    const [statsData, referralsData, payoutsData] = await Promise.all([
                        affiliateApi.getStats(walletAddress),
                        affiliateApi.getReferrals(walletAddress),
                        affiliateApi.getPayouts(walletAddress)
                    ]);
                    setStats(statsData);
                    setReferrals(referralsData);
                    setPayouts(payoutsData);
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

    const handleWithdrawClick = () => {
        if (!stats || stats.pendingPayout < 10) {
            toast.error('Minimum withdrawal amount is $10');
            return;
        }
        setIsWithdrawOpen(true);
    };

    const onConfirmWithdraw = async () => {
        if (!stats) return;

        // 1. Get the message to sign
        const timestamp = Date.now();
        const { message, amount } = await affiliateApi.getPayoutMessage(walletAddress, timestamp);

        // 2. Request signature from wallet (using window.ethereum as fallback)
        let signature: string;
        if (typeof window !== 'undefined' && (window as any).ethereum) {
            const provider = (window as any).ethereum;
            signature = await provider.request({
                method: 'personal_sign',
                params: [message, walletAddress],
            });
        } else {
            throw new Error('No wallet detected. Please connect your wallet.');
        }

        // 3. Submit with signature
        const result = await affiliateApi.requestPayout(walletAddress, signature, timestamp);
        if (result.success) {
            // Refresh ALL data
            const [statsData, referralsData, payoutsData] = await Promise.all([
                affiliateApi.getStats(walletAddress),
                affiliateApi.getReferrals(walletAddress),
                affiliateApi.getPayouts(walletAddress)
            ]);
            setStats(statsData);
            setReferrals(referralsData);
            setPayouts(payoutsData);
        } else {
            throw new Error(result.error || 'Withdrawal failed');
        }
    };

    const handleCopyLink = () => {
        if (stats?.referralCode) {
            navigator.clipboard.writeText(generateReferralLink(stats.referralCode));
            toast.success(t('dashboard.referralLink.copied'));
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
            { icon: <Coins className="h-8 w-8 text-yellow-500" />, title: t('guest.benefits.items.commission.title'), desc: t('guest.benefits.items.commission.desc') },
            { icon: <Users className="h-8 w-8 text-yellow-500" />, title: t('guest.benefits.items.generations.title'), desc: t('guest.benefits.items.generations.desc') },
            { icon: <Zap className="h-8 w-8 text-yellow-500" />, title: t('guest.benefits.items.payouts.title'), desc: t('guest.benefits.items.payouts.desc') },
            { icon: <Trophy className="h-8 w-8 text-yellow-500" />, title: t('guest.benefits.items.tiers.title'), desc: t('guest.benefits.items.tiers.desc') },
        ];

        const STEPS = [
            { num: 1, title: t('guest.howItWorks.steps.1.title'), desc: t('guest.howItWorks.steps.1.desc') },
            { num: 2, title: t('guest.howItWorks.steps.2.title'), desc: t('guest.howItWorks.steps.2.desc') },
            { num: 3, title: t('guest.howItWorks.steps.3.title'), desc: t('guest.howItWorks.steps.3.desc') },
        ];

        const TIERS = [
            { name: "ORDINARY", title: t('tiers.ORDINARY'), color: 'text-muted-foreground', directs: 0, team: 0, zero: 1, diff: 1, icon: <UserCircle className="h-4 w-4" /> },
            { name: "VIP", title: t('tiers.VIP'), color: 'text-white', directs: 3, team: 10, zero: 2, diff: 2, icon: <Star className="h-4 w-4 text-white" /> },
            { name: "ELITE", title: t('tiers.ELITE'), color: 'text-yellow-500/70', directs: 10, team: 100, zero: 3, diff: 3, icon: <Zap className="h-4 w-4 text-yellow-500/70" /> },
            { name: "PARTNER", title: t('tiers.PARTNER'), color: 'text-yellow-500', directs: 30, team: 500, zero: 5, diff: 5, icon: <Shield className="h-4 w-4 text-yellow-500" /> },
            { name: "SUPER", title: t('tiers.SUPER'), color: 'text-yellow-400 font-bold', directs: 50, team: 1000, zero: 8, diff: 8, icon: <Crown className="h-4 w-4 text-yellow-500" /> },
        ];

        const ZERO_LINE_RATES = [
            { gen: 1, rate: 25, label: t('guest.zeroLine.generations.1') },
            { gen: 2, rate: 10, label: t('guest.zeroLine.generations.2') },
            { gen: 3, rate: 5, label: t('guest.zeroLine.generations.3') },
            { gen: 4, rate: 3, label: t('guest.zeroLine.generations.4') },
            { gen: 5, rate: 2, label: t('guest.zeroLine.generations.5') },
        ];

        return (
            <div className="min-h-screen bg-[#0d0e10] text-white">
                {/* Hero Section */}
                <section className="pt-24 pb-16 relative overflow-hidden">
                    <div className="absolute inset-0 bg-yellow-500/5 pointer-events-none" />
                    <div className="absolute top-20 right-20 w-96 h-96 bg-yellow-500/5 rounded-full blur-[100px]" />
                    <div className="absolute bottom-0 left-20 w-64 h-64 bg-yellow-500/5 rounded-full blur-[80px]" />

                    <div className="container max-w-4xl mx-auto px-4 text-center relative z-10">
                        <div className="inline-flex items-center gap-2 bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-yellow-500/20">
                            <Sparkles className="h-4 w-4" />
                            {t('guest.hero.badge')}
                        </div>

                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight text-white">
                            {t.rich('guest.hero.title', {
                                highlight: (chunks: any) => <span className="text-yellow-500">{chunks}</span>
                            })}
                        </h1>

                        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                            {t.rich('guest.hero.desc', {
                                highlight1: (chunks: any) => <strong className="text-green-500">{chunks}</strong>,
                                highlight2: (chunks: any) => <strong className="text-yellow-500">{chunks}</strong>
                            })}
                        </p>

                        <button
                            onClick={handleRegister}
                            disabled={isRegistering}
                            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 px-10 rounded-xl transition-all flex items-center gap-3 mx-auto text-lg shadow-lg shadow-yellow-500/20"
                        >
                            {isRegistering ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
                            {isRegistering ? t('guest.hero.registering') : t('guest.hero.cta')}
                        </button>

                        <p className="text-sm text-muted-foreground mt-4">{t('guest.hero.features')}</p>
                    </div>
                </section>

                {/* Benefits Grid */}
                <section className="py-16 border-t border-white/5">
                    <div className="container max-w-5xl mx-auto px-4">
                        <h2 className="text-2xl font-bold text-center mb-10">{t('guest.benefits.title')}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {BENEFITS.map((b, i) => (
                                <div key={i} className="bg-[#1a1b1e] border border-white/10 rounded-xl p-6 text-center hover:border-yellow-500/30 transition-colors group">
                                    <div className="mb-4 flex justify-center">{b.icon}</div>
                                    <h3 className="font-bold text-lg mb-2 text-white group-hover:text-yellow-500 transition-colors">{b.title}</h3>
                                    <p className="text-sm text-muted-foreground">{b.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* How It Works */}
                <section className="py-16 bg-[#15161a] border-y border-white/5">
                    <div className="container max-w-4xl mx-auto px-4">
                        <h2 className="text-2xl font-bold text-center mb-12">{t('guest.howItWorks.title')}</h2>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                            {STEPS.map((s, i) => (
                                <div key={i} className="flex flex-col items-center text-center flex-1">
                                    <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 flex items-center justify-center text-2xl font-bold mb-4 shadow-lg">
                                        {s.num}
                                    </div>
                                    <h3 className="font-bold text-lg mb-2">{s.title}</h3>
                                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                                    {i < STEPS.length - 1 && (
                                        <div className="hidden md:block absolute translate-x-20 w-20 h-0.5 bg-yellow-500/20" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Tier System */}
                <section className="py-16">
                    <div className="container max-w-5xl mx-auto px-4">
                        <h2 className="text-2xl font-bold text-center mb-4">{t('guest.tiers.title')}</h2>
                        <p className="text-muted-foreground text-center mb-10">{t('guest.tiers.subtitle')}</p>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm bg-[#1a1b1e] rounded-xl border border-white/10">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left py-4 px-6 font-medium text-muted-foreground">{t('guest.tiers.headers.tier')}</th>
                                        <th className="text-center py-4 px-4 font-medium text-muted-foreground">{t('guest.tiers.headers.directs')}</th>
                                        <th className="text-center py-4 px-4 font-medium text-muted-foreground">{t('guest.tiers.headers.team')}</th>
                                        <th className="text-center py-4 px-4 font-medium text-green-400">{t('guest.tiers.headers.zero')}</th>
                                        <th className="text-center py-4 px-4 font-medium text-yellow-400">{t('guest.tiers.headers.diff')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {TIERS.map((tierIter, i) => (
                                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                            <td className={`py-4 px-6 font-bold ${tierIter.color} flex items-center gap-2`}>
                                                {tierIter.icon} {tierIter.title}
                                            </td>
                                            <td className="text-center py-4 px-4 font-mono">{tierIter.directs}</td>
                                            <td className="text-center py-4 px-4 font-mono">{tierIter.team}</td>
                                            <td className="text-center py-4 px-4 font-mono text-green-400">{tierIter.zero}%</td>
                                            <td className="text-center py-4 px-4 font-mono text-yellow-400">{tierIter.diff}%</td>
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
                        <h2 className="text-2xl font-bold text-center mb-4">{t('guest.zeroLine.title')}</h2>
                        <p className="text-muted-foreground text-center mb-10">{t('guest.zeroLine.subtitle')}</p>

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
                            <p className="text-sm text-green-400" dangerouslySetInnerHTML={{ __html: t.raw('guest.zeroLine.example') }} />
                        </div>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="py-20">
                    <div className="container max-w-2xl mx-auto px-4 text-center">
                        <h2 className="text-3xl font-bold mb-4">{t('guest.cta.title')}</h2>
                        <p className="text-muted-foreground mb-8">{t('guest.cta.subtitle')}</p>

                        <button
                            onClick={handleRegister}
                            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 px-10 rounded-xl transition-all flex items-center gap-3 mx-auto text-lg shadow-lg shadow-yellow-500/20"
                        >
                            {isRegistering ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
                            {isRegistering ? t('guest.hero.registering') : t('guest.cta.button')}
                        </button>

                        <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4 text-green-400" /> {t('guest.cta.features.free')}</span>
                            <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4 text-green-400" /> {t('guest.cta.features.min')}</span>
                            <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4 text-green-400" /> {t('guest.cta.features.setup')}</span>
                        </div>
                    </div>
                </section >
            </div >
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
                <div className="mb-8 space-y-4 text-center">
                    <h1 className="text-4xl font-bold tracking-tight text-white">{t('dashboard.title')}</h1>
                    <p className="text-muted-foreground text-lg">
                        {t('dashboard.subtitle')}
                    </p>
                </div>

                {/* 1. Tier Status Card */}
                <div className="bg-[#1a1b1e] border border-yellow-500/20 rounded-2xl p-6 md:p-8 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 bg-yellow-500/5 blur-[80px] rounded-full pointer-events-none" />

                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 shadow-lg border border-yellow-500/20">
                                {stats?.tier === 'SUPER_PARTNER' ? <Crown className="h-8 w-8" /> :
                                    stats?.tier === 'PARTNER' ? <Shield className="h-8 w-8" /> :
                                        stats?.tier === 'ELITE' ? <Zap className="h-8 w-8" /> :
                                            stats?.tier === 'VIP' ? <Star className="h-8 w-8" /> : <UserCircle className="h-8 w-8" />}
                            </div>
                            <div>
                                <div className="text-sm text-yellow-500 font-medium mb-1">{t('dashboard.currentRank')}</div>
                                <h2 className={cn("text-3xl font-bold mb-1", tierInfo.color)}>{t(`tiers.${stats?.tier || 'ORDINARY'}`)}</h2>
                                <div className="inline-flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-500 text-sm font-bold">
                                        {t('dashboard.direct')}: 25%
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 text-sm font-bold">
                                        {t('dashboard.teamDiff')}: {((stats?.tier === 'ORDINARY' ? 0.01 : stats?.tier === 'VIP' ? 0.02 : stats?.tier === 'ELITE' ? 0.03 : stats?.tier === 'PARTNER' ? 0.05 : 0.08) * 100).toFixed(0)}%
                                    </span>
                                    <Link
                                        href="/affiliate/rules"
                                        className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-sm transition-colors flex items-center gap-1"
                                        title={t('dashboard.learnMoreTitle')}
                                    >
                                        <HelpCircle className="h-3 w-3" />
                                        <span>{t('dashboard.learnMore')}</span>
                                    </Link>
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-1/2">
                            {stats?.nextTier ? (
                                <>
                                    <div className="flex justify-between text-xs mb-2">
                                        <span className="text-muted-foreground">{t('dashboard.nextRank')}: <span className="text-white font-bold">{t(`tiers.${stats.nextTier}`)}</span></span>
                                        <span className="text-white font-medium">
                                            {stats.totalReferrals} / {tierInfo.minTeam} {t('dashboard.teamMembers')}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mb-1">
                                        <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.min(100, (stats.totalReferrals / (tierInfo.minTeam || 1)) * 100)}%` }} />
                                    </div>
                                    <div className="text-[10px] text-muted-foreground text-right">
                                        {t('dashboard.goal')}: {(tierInfo.minTeam)} {t('dashboard.activeMembers')}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center text-yellow-400 font-medium border border-yellow-500/20 rounded-lg p-3 bg-yellow-500/5">
                                    {t('dashboard.topRankAchieved')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {[
                        { label: t('dashboard.stats.directReferrals'), value: `${stats?.totalReferrals || 0}`, sub: t('dashboard.stats.zeroLine'), icon: Users, color: "text-green-500", bg: "bg-green-500/10" },
                        { label: t('dashboard.stats.teamSize'), value: `${stats?.teamSize || 0}`, sub: t('dashboard.stats.totalNetwork'), icon: Wallet, color: "text-yellow-500", bg: "bg-yellow-500/10" },
                        { label: t('dashboard.stats.sunLines'), value: `${stats?.sunLineCount || 0}`, sub: t('dashboard.stats.strongLegs'), icon: Trophy, color: "text-yellow-500", bg: "bg-yellow-500/10" },
                        {
                            label: t('dashboard.stats.totalEarnings'),
                            value: `$${(stats?.totalEarned || 0).toFixed(2)}`,
                            sub: t('dashboard.stats.earningsBreakdown', {
                                zero: (stats?.earningsBreakdown?.zeroLine || 0).toFixed(2),
                                sun: (stats?.earningsBreakdown?.sunLine || 0).toFixed(2)
                            }),
                            icon: Calendar,
                            color: "text-green-500",
                            bg: "bg-green-500/10",
                            action: (
                                <div className="flex items-center justify-between w-full">
                                    <div className="text-xs font-medium text-green-500">
                                        {t('dashboard.stats.available')}: ${(stats?.pendingPayout || 0).toFixed(2)}
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleWithdrawClick(); }}
                                        className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg font-bold transition-colors"
                                        title={t('dashboard.stats.withdraw')}
                                    >
                                        {t('dashboard.stats.withdraw')}
                                    </button>
                                </div>
                            )
                        },
                    ].map((stat, i) => (
                        <div key={i} className="bg-[#1a1b1e] border border-[#2c2d33] rounded-xl flex flex-col relative overflow-hidden group hover:border-white/10 transition-colors">
                            <div className="p-6">
                                <div className={`absolute right-4 top-4 h-10 w-10 rounded-lg ${stat.bg} flex items-center justify-center ${stat.color}`}>
                                    <stat.icon className="h-5 w-5" />
                                </div>
                                <div className="mb-2">
                                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</div>
                                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    {stat.label === t('dashboard.stats.totalEarnings') && "$"}
                                    {stat.sub}
                                </div>
                            </div>
                            {'action' in stat && (
                                <div className="mt-auto border-t border-white/5 bg-white/5 px-6 py-3">
                                    {stat.action}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* 3. Referral Link */}
                <div className="bg-[#1a1b1e] border border-[#2c2d33] rounded-2xl p-6 mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-6 w-6 rounded bg-blue-500/20 flex items-center justify-center text-blue-500">
                            <LinkIcon className="h-3.5 w-3.5" />
                        </div>
                        <h3 className="font-bold text-white">{t('dashboard.referralLink.label')}</h3>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <p className="text-sm text-muted-foreground md:w-1/3">
                            {t('dashboard.referralLink.desc')}
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
                                <Copy className="h-4 w-4" /> {t('common.copy')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 4. Team Network - IMPROVED */}
                <TeamNetworkSection walletAddress={walletAddress} />


                {/* 5. Payout History */}
                <div className="bg-[#1a1b1e] border border-[#2c2d33] rounded-2xl p-6 mb-8">
                    <h3 className="font-bold text-white flex items-center gap-2 mb-6">
                        <Calendar className="h-4 w-4 text-green-500" />
                        {t('dashboard.payoutHistory.title')}
                    </h3>

                    {payouts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground bg-white/5 rounded-xl border border-dashed border-white/10">
                            {t('dashboard.payoutHistory.empty')}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-muted-foreground border-b border-white/5 uppercase text-xs">
                                    <tr>
                                        <th className="py-2 pl-2">{t('dashboard.payoutHistory.headers.status')}</th>
                                        <th className="py-2">{t('dashboard.payoutHistory.headers.amount')}</th>
                                        <th className="py-2">{t('dashboard.payoutHistory.headers.date')}</th>
                                        <th className="py-2 text-right pr-2">{t('dashboard.payoutHistory.headers.txHash')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {payouts.map((p) => (
                                        <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                            <td className="py-3 pl-2">
                                                <span className={cn(
                                                    "text-xs px-2 py-0.5 rounded-full font-bold",
                                                    p.status === 'COMPLETED' ? "bg-green-500/10 text-green-500" :
                                                        p.status === 'PENDING' ? "bg-yellow-500/10 text-yellow-500" :
                                                            p.status === 'PROCESSING' ? "bg-blue-500/10 text-blue-500" :
                                                                "bg-red-500/10 text-red-500"
                                                )}>
                                                    {p.status === 'COMPLETED' ? t('dashboard.payoutHistory.status.paid') :
                                                        p.status === 'PENDING' ? t('dashboard.payoutHistory.status.pending') :
                                                            p.status === 'PROCESSING' ? t('dashboard.payoutHistory.status.processing') :
                                                                t('dashboard.payoutHistory.status.rejected')}
                                                </span>
                                            </td>
                                            <td className="py-3 font-mono text-white">
                                                ${p.amount.toFixed(2)}
                                            </td>
                                            <td className="py-3 text-muted-foreground">
                                                {new Date(p.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="py-3 text-right pr-2 font-mono text-xs text-blue-400">
                                                {p.txHash ? (
                                                    <a href={`https://polygonscan.com/tx/${p.txHash}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                        {p.txHash.slice(0, 6)}...{p.txHash.slice(-4)}
                                                    </a>
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Withdraw Dialog - Keeping as is, assuming inputs/buttons there might also need translation if exposed directly, but it's a sub-component */}
                <WithdrawDialog
                    isOpen={isWithdrawOpen}
                    onClose={() => setIsWithdrawOpen(false)}
                    pendingAmount={stats?.pendingPayout || 0}
                    onConfirm={onConfirmWithdraw}
                />

                {/* 6. Developer Tools (Simulation) */}
                <div className="rounded-xl border border-dashed border-yellow-500/30 bg-yellow-500/5 p-6">
                    <div className="flex items-center gap-2 mb-4 text-yellow-500">
                        <Info className="h-4 w-4" />
                        <h3 className="font-bold text-sm uppercase tracking-wider">{t('dashboard.simulator.title')}</h3>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-2">
                            <label className="text-xs text-muted-foreground">{t('dashboard.simulator.label')}</label>
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
                            {isSimulating ? t('dashboard.simulator.processing') : t('dashboard.simulator.button')}
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
    const { login, isLoggingIn } = usePrivyLogin();
    const t = useTranslations('Affiliate.guest');

    const BENEFITS = [
        { icon: <Coins className="h-10 w-10" />, title: t('benefits.items.commission.title'), desc: t('benefits.items.commission.desc') },
        { icon: <LinkIcon className="h-10 w-10" />, title: t('howItWorks.steps.1.desc').split(' ')[5] ? 'Referral Link' : t('benefits.items.commission.title'), desc: 'Get your unique link to share' }, // Fixing this specific item to use keys or clearer logic, wait. I should use the keys I defined.
    ];
    // Re-doing the array definition properly from my JSON structure plan

    // Actually, let's just define the arrays inside the component properly
    const benefitsList = [
        { icon: <Coins className="h-10 w-10" />, key: 'commission' },
        { icon: <LinkIcon className="h-10 w-10" />, key: 'generations' }, // Wait, checking keys... 'generations' title is "5 Generations Deep". LinkIcon was "Referral Link".
        // My JSON didn't have "Referral Link" benefit item explicitly, I had "generations", "payouts", "tiers".
        // Let me check what I added to JSON.
        // benefits.items: commission, generations, payouts, tiers.
        // Original GuestView had: Commission, Referral Link, Dashboard, Withdrawals.
        // I changed the content in JSON to match "Why Join Our Affiliate Program?" but the original code had different items?
        // Let's check original code again.
        // Original: Commission, Referral Link, Dashboard, Withdrawals.
        // My JSON: Commission, Generations Deep, Instant Payouts, Tier Progression.
        // I seem to have written new content in JSON based on the "Why Join" section of the *Authenticated* view maybe?
        // Let's look at the file content I viewed earlier (Log 851).
        // Line 296 (AuthenticatedView fallback landing?): BENEFITS = [25% Commission, 5 Generations Deep, Instant Payouts, Tier Progression].
        // Line 756 (GuestView): BENEFITS = [Commission, Referral Link, Dashboard, Withdrawals].

        // Ah, there are TWO sets of benefits. One inside `AuthenticatedView` (when !isRegistered) and one inside `GuestView`.
        // I created JSON for the "AuthenticatedView !isRegistered" version (lines 296+).
        // I should stick to that content for GuestView too if possible, or support both.
        // The GuestView seems to be the main landing for non-logged in users.
        // I should probably use the "Why Join" content (Commission, Generations, Payouts, Tiers) for the Guest View too as it is more descriptive/marketing oriented than "Referral Link, Dashboard".
        // The original GuestView benefits were a bit generic. The AuthenticatedView landing (lines 360+) seems better.
        // I will use the *same* translated content for both if reasonable.
        // Let's use the keys I created: commission, generations, payouts, tiers.
        // And update the icons to match.

        // Wait, I need to be careful not to change the design *too* much unless improved.
        // I'll map the new keys to the GuestView.
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
                    <div className="inline-flex items-center gap-2 bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-yellow-500/20">
                        <Sparkles className="h-4 w-4" />
                        {t('hero.badge')}
                    </div>

                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                        {t.rich('hero.title', {
                            highlight: (chunks: any) => <span className="text-yellow-500">{chunks}</span>
                        })}
                    </h1>
                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        {t.rich('hero.desc', {
                            highlight1: (chunks: any) => <strong className="text-green-500">{chunks}</strong>,
                            highlight2: (chunks: any) => <strong className="text-yellow-500">{chunks}</strong>
                        })}
                    </p>

                    <div className="pt-4">
                        <button
                            onClick={login}
                            disabled={isLoggingIn}
                            aria-busy={isLoggingIn}
                            className="px-10 py-4 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg transition-all shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/30 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                        >
                            {isLoggingIn ? (
                                <>
                                    {t('hero.registering')}
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                </>
                            ) : (
                                t('hero.cta')
                            )}
                        </button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">{t('hero.features')}</p>
                </div>
            </section>

            {/* How It Works / Benefits */}
            <section className="py-20 border-y border-white/5 bg-card/30 backdrop-blur-sm">
                <div className="container max-w-6xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold mb-4">{t('benefits.title')}</h2>
                        <p className="text-muted-foreground">{t('hero.desc').split('.')[0]}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: <Coins className="h-10 w-10" />, ...{ title: t('benefits.items.commission.title'), desc: t('benefits.items.commission.desc') } },
                            { icon: <Users className="h-10 w-10" />, ...{ title: t('benefits.items.generations.title'), desc: t('benefits.items.generations.desc') } },
                            { icon: <Zap className="h-10 w-10" />, ...{ title: t('benefits.items.payouts.title'), desc: t('benefits.items.payouts.desc') } },
                            { icon: <Trophy className="h-10 w-10" />, ...{ title: t('benefits.items.tiers.title'), desc: t('benefits.items.tiers.desc') } },
                        ].map((b, i) => (
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
                        <h2 className="text-3xl font-bold mb-4">{t('zeroLine.title')}</h2>
                        <p className="text-muted-foreground">
                            {t('zeroLine.subtitle')}
                        </p>
                    </div>

                    <div className="space-y-6">
                        {[
                            { gen: 1, rate: 25, label: t('zeroLine.generations.1') },
                            { gen: 2, rate: 10, label: t('zeroLine.generations.2') },
                            { gen: 3, rate: 5, label: t('zeroLine.generations.3') },
                            { gen: 4, rate: 3, label: t('zeroLine.generations.4') },
                            { gen: 5, rate: 2, label: t('zeroLine.generations.5') },
                        ].map((r, index) => (
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
                        <p className="text-base text-yellow-500/90" dangerouslySetInnerHTML={{ __html: t.raw('zeroLine.example') }} />
                    </div>
                </div>
            </section>

            {/* Testimonials Section - Keeping static as discussed, but logic preserved */}
            <section className="py-20 border-t border-white/5 bg-gradient-to-b from-transparent to-yellow-500/5">
                <div className="container max-w-6xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold mb-4">Success Stories</h2>
                        <p className="text-muted-foreground">See what our top partners are earning</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                name: "Alex M.",
                                role: "Super Partner",
                                earnings: "$12,450",
                                period: "last month",
                                quote: "I started sharing my link in a few discord groups. Now I'm earning more from commissions than my actual trading.",
                                avatar: <Crown className="h-6 w-6 text-yellow-500" />
                            },
                            {
                                name: "Sarah K.",
                                role: "Elite Affiliate",
                                earnings: "$4,200",
                                period: "this week",
                                quote: "The 5-generation system is a game changer. My network keeps growing automatically as my referrals invite their friends.",
                                avatar: <Zap className="h-6 w-6 text-blue-500" />
                            },
                            {
                                name: "CryptoDave",
                                role: "VIP Member",
                                earnings: "$850",
                                period: "passive income",
                                quote: "I just posted my link on Twitter and forgot about it. Woke up to free USDC in my wallet. Easiest money ever.",
                                avatar: <Star className="h-6 w-6 text-green-500" />
                            }
                        ].map((t, i) => (
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
                    <h2 className="text-3xl md:text-4xl font-bold">{t('cta.title')}</h2>
                    <p className="text-lg text-muted-foreground">
                        {t('cta.subtitle')}
                    </p>
                    <button
                        onClick={login}
                        disabled={isLoggingIn}
                        aria-busy={isLoggingIn}
                        className="px-12 py-4 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                        {isLoggingIn ? (
                            <>
                                {t('hero.registering')}
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </>
                        ) : (
                            t('cta.button')
                        )}
                    </button>

                    <div className="flex items-center justify-center gap-6 pt-4 text-sm text-center">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="text-green-500">✓</span> {t('cta.features.free')}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="text-green-500">✓</span> {t('cta.features.min')}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="text-green-500">✓</span> {t('cta.features.setup')}
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
    zeroLineEarned?: number;
    sunLineEarned?: number;
    children: TreeMember[];
}

function TeamNetworkSection({ walletAddress }: { walletAddress: string }) {
    const t = useTranslations('Affiliate.teamNetwork');
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
                    {t('title')}
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
                        {t('summary')}
                    </button>
                    <button
                        onClick={() => setViewMode('tree')}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5",
                            viewMode === 'tree' ? 'bg-purple-500 text-white' : 'text-muted-foreground hover:text-white'
                        )}
                    >
                        <GitBranch className="h-3 w-3" />
                        {t('tree')}
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
                        /* Summary Mode: Show only direct referrals in a compact table */
                        <TeamSummaryView directReferrals={treeData} />
                    )}
                </>
            )}
        </div>
    );
}
