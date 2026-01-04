import Link from 'next/link';
import { Check, Zap, Crown, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';

export const revalidate = 3600; // Static page, revalidate hourly

export default function PricingPage() {
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
