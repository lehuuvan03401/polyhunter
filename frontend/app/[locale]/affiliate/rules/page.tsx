'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import {
    ArrowLeft,
    HelpCircle,
    Zap,
    Sun,
    Users,
    TrendingUp,
    ChevronDown,
    ChevronUp,
    Trophy,
    Star,
    Crown,
    Gem
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Tier data matching affiliate-engine.ts
const TIERS = [
    {
        name: 'ORDINARY',
        icon: Users,
        color: 'text-gray-400',
        bg: 'bg-gray-500/10',
        border: 'border-gray-500/30',
        directsRequired: 0,
        teamRequired: 0,
        teamDiff: 1
    },
    {
        name: 'VIP',
        icon: Star,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        directsRequired: 3,
        teamRequired: 10,
        teamDiff: 2
    },
    {
        name: 'ELITE',
        icon: Trophy,
        color: 'text-purple-400',
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/30',
        directsRequired: 10,
        teamRequired: 100,
        teamDiff: 3
    },
    {
        name: 'PARTNER',
        icon: Crown,
        color: 'text-yellow-400',
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/30',
        directsRequired: 30,
        teamRequired: 500,
        teamDiff: 5
    },
    {
        name: 'SUPER_PARTNER',
        icon: Gem,
        color: 'text-orange-400',
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        directsRequired: 50,
        teamRequired: 1000,
        teamDiff: 8
    },
];

const ZERO_LINE_RATES = [
    { gen: 1, rate: 25, label: 'Direct Referral' },
    { gen: 2, rate: 10, label: '2nd Generation' },
    { gen: 3, rate: 5, label: '3rd Generation' },
    { gen: 4, rate: 3, label: '4th Generation' },
    { gen: 5, rate: 2, label: '5th Generation' },
];

const FAQ_ITEMS = [
    {
        question: 'How do I upgrade my tier?',
        answer: 'Your tier upgrades automatically when you meet the requirements. You need a certain number of direct referrals AND total team members. For example, to reach VIP you need 3 direct referrals and 10 total team members.'
    },
    {
        question: 'When do I receive my commissions?',
        answer: 'Commissions are credited instantly when your team members execute trades. They are added to your "Pending Payout" balance and can be withdrawn at any time.'
    },
    {
        question: 'What is a "Sun Line" / Strong Leg?',
        answer: 'A Sun Line (Strong Leg) is a direct referral who has built their own active team. Having multiple Sun Lines indicates a healthy, distributed network and is key to maximizing Team Differential earnings.'
    },
    {
        question: 'How do I withdraw my earnings?',
        answer: 'Go to your Affiliate Dashboard, click the "Withdraw" button next to Total Earnings, sign the transaction with your wallet, and your USDC will be sent to your wallet address.'
    },
    {
        question: 'What is the difference between Zero Line and Sun Line?',
        answer: 'Zero Line is your direct commission from team trades (25% Gen1, 10% Gen2, etc.). Sun Line (Team Differential) is the bonus you earn from the difference between your tier rate and lower-tier members in your downline.'
    },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border border-white/10 rounded-lg overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
            >
                <span className="font-medium text-white">{question}</span>
                {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
            </button>
            {isOpen && (
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                    {answer}
                </div>
            )}
        </div>
    );
}

export default function AffiliateRulesPage() {
    const { user } = usePrivy();
    const [currentTier, setCurrentTier] = useState<string>('ORDINARY');

    // Fetch user's current tier
    useEffect(() => {
        if (!user?.wallet?.address) return;

        fetch(`/api/affiliate/stats?walletAddress=${user.wallet.address}`)
            .then(res => res.json())
            .then(data => {
                if (data.tier) setCurrentTier(data.tier);
            })
            .catch(() => { });
    }, [user?.wallet?.address]);

    return (
        <div className="min-h-screen bg-[#0d0e10] text-white">
            {/* Header */}
            <div className="border-b border-white/10 bg-[#1a1b1e]/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link
                        href="/affiliate"
                        className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Dashboard</span>
                    </Link>
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-blue-400" />
                        Affiliate Program Rules
                    </h1>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

                {/* Section 1: Tier System Overview */}
                <section className="bg-[#1a1b1e] border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                            <Trophy className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Tier System</h2>
                            <p className="text-sm text-muted-foreground">Progress through 5 ranks to unlock higher commission rates</p>
                        </div>
                    </div>

                    {/* Tier Progress Bar */}
                    <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
                        {TIERS.map((tier, idx) => {
                            const TierIcon = tier.icon;
                            const isCurrent = tier.name === currentTier;
                            const isPast = TIERS.findIndex(t => t.name === currentTier) > idx;

                            return (
                                <div key={tier.name} className="flex items-center">
                                    <div className={cn(
                                        "flex flex-col items-center gap-2 px-4 py-2 rounded-xl transition-all",
                                        isCurrent && `${tier.bg} ${tier.border} border-2`,
                                        !isCurrent && "opacity-60"
                                    )}>
                                        <div className={cn(
                                            "h-12 w-12 rounded-full flex items-center justify-center",
                                            isPast || isCurrent ? tier.bg : "bg-white/5"
                                        )}>
                                            <TierIcon className={cn("h-6 w-6", tier.color)} />
                                        </div>
                                        <span className={cn("text-xs font-semibold whitespace-nowrap", tier.color)}>
                                            {tier.name}
                                        </span>
                                        {isCurrent && (
                                            <span className="text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                                                YOUR RANK
                                            </span>
                                        )}
                                    </div>
                                    {idx < TIERS.length - 1 && (
                                        <div className={cn(
                                            "w-8 h-0.5 mx-1",
                                            isPast ? "bg-green-500" : "bg-white/10"
                                        )} />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Tier Comparison Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10 text-muted-foreground">
                                    <th className="text-left py-3 px-4 font-medium">Tier</th>
                                    <th className="text-center py-3 px-4 font-medium">Direct Referrals</th>
                                    <th className="text-center py-3 px-4 font-medium">Team Size</th>
                                    <th className="text-center py-3 px-4 font-medium text-yellow-400">Team Diff %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {TIERS.map((tier) => {
                                    const TierIcon = tier.icon;
                                    const isCurrent = tier.name === currentTier;

                                    return (
                                        <tr
                                            key={tier.name}
                                            className={cn(
                                                "border-b border-white/5 transition-colors",
                                                isCurrent && "bg-white/5"
                                            )}
                                        >
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    <TierIcon className={cn("h-4 w-4", tier.color)} />
                                                    <span className={cn("font-medium", tier.color)}>{tier.name}</span>
                                                    {isCurrent && <span className="text-[10px] text-green-400">★</span>}
                                                </div>
                                            </td>
                                            <td className="text-center py-3 px-4 font-mono">{tier.directsRequired}</td>
                                            <td className="text-center py-3 px-4 font-mono">{tier.teamRequired}</td>
                                            <td className="text-center py-3 px-4 font-mono text-yellow-400">{tier.teamDiff}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Section 2: Zero Line Explanation */}
                <section className="bg-[#1a1b1e] border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                            <Zap className="h-5 w-5 text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Zero Line (Direct Bonus)</h2>
                            <p className="text-sm text-muted-foreground">Earn from your team&apos;s trades up to 5 generations deep</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Rate Table */}
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground mb-4">
                                When anyone in your team executes a trade, a 0.1% platform fee is collected.
                                You earn a percentage of this fee based on their generation:
                            </p>
                            {ZERO_LINE_RATES.map((item) => (
                                <div
                                    key={item.gen}
                                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 font-bold text-sm">
                                            G{item.gen}
                                        </div>
                                        <span className="text-sm">{item.label}</span>
                                    </div>
                                    <span className="text-green-400 font-mono font-bold">{item.rate}%</span>
                                </div>
                            ))}
                        </div>

                        {/* Example Calculation */}
                        <div className="bg-gradient-to-br from-green-500/5 to-green-500/0 border border-green-500/20 rounded-xl p-5">
                            <h3 className="font-semibold text-green-400 mb-4 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Example Calculation
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Trade Volume:</span>
                                    <span className="font-mono">$10,000</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Platform Fee (0.1%):</span>
                                    <span className="font-mono">$10.00</span>
                                </div>
                                <div className="h-px bg-white/10 my-2" />
                                <div className="flex justify-between text-green-400">
                                    <span>Your Gen 1 Commission (25%):</span>
                                    <span className="font-mono font-bold">$2.50</span>
                                </div>
                                <div className="flex justify-between text-green-400/70">
                                    <span>Your Gen 2 Commission (10%):</span>
                                    <span className="font-mono">$1.00</span>
                                </div>
                                <div className="flex justify-between text-green-400/50">
                                    <span>Your Gen 3 Commission (5%):</span>
                                    <span className="font-mono">$0.50</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 3: Sun Line Explanation */}
                <section className="bg-[#1a1b1e] border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                            <Sun className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Sun Line (Team Differential)</h2>
                            <p className="text-sm text-muted-foreground">Earn extra from the tier difference between you and your downline</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                When a lower-tier member in your network trades, you earn the <strong className="text-white">difference</strong> between
                                your tier rate and their tier rate. This rewards building a deep team!
                            </p>

                            <div className="bg-white/5 rounded-lg p-4 space-y-2">
                                <div className="text-sm font-medium text-yellow-400">Formula:</div>
                                <code className="block bg-black/50 rounded px-3 py-2 text-sm font-mono">
                                    Sun Line = Fee × (Your Rate - Their Rate)
                                </code>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-yellow-500/5 to-yellow-500/0 border border-yellow-500/20 rounded-xl p-5">
                            <h3 className="font-semibold text-yellow-400 mb-4">Example:</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <Crown className="h-4 w-4 text-purple-400" />
                                    <span>You are <strong className="text-purple-400">ELITE (3%)</strong></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Star className="h-4 w-4 text-blue-400" />
                                    <span>Downline member is <strong className="text-blue-400">VIP (2%)</strong></span>
                                </div>
                                <div className="h-px bg-white/10 my-3" />
                                <div className="text-muted-foreground">
                                    Platform Fee: <span className="font-mono">$10</span>
                                </div>
                                <div className="text-muted-foreground">
                                    Differential: <span className="font-mono">3% - 2% = 1%</span>
                                </div>
                                <div className="text-yellow-400 font-semibold mt-2">
                                    Your Sun Line Bonus: <span className="font-mono">$10 × 1% = $0.10</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 4: FAQ */}
                <section className="bg-[#1a1b1e] border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <HelpCircle className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Frequently Asked Questions</h2>
                            <p className="text-sm text-muted-foreground">Common questions about the affiliate program</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {FAQ_ITEMS.map((item, idx) => (
                            <FAQItem key={idx} question={item.question} answer={item.answer} />
                        ))}
                    </div>
                </section>

                {/* Back to Dashboard Button */}
                <div className="text-center pb-10">
                    <Link
                        href="/affiliate"
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
