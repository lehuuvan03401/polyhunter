import Link from 'next/link';
import { Link as LinkIcon, Users, Wallet, BarChart3, Calendar, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';

export const revalidate = 3600;

export default function AffiliatePage() {
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

// Icon component helper
function Trophy({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
        >
            <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a2.25 2.25 0 00-2.25 2.25c0 .414.336.75.75.75h15a.75.75 0 00.75-.75 2.25 2.25 0 00-2.25-2.25h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.706 6.706 0 01-1.612-3.125 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.22 49.22 0 00-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 00-.657.744zm0 2.629c0 1.196.312 2.32.857 3.294A5.266 5.266 0 013.16 5.337a45.6 45.6 0 012.006-.343v.256zm13.5 0v-.256c.674.1 1.343.214 2.006.343a5.265 5.265 0 01-2.863 3.207 6.72 6.72 0 00.857-3.294z" clipRule="evenodd" />
        </svg>
    );
}
