'use client';

import Link from 'next/link';

import { ArrowRight, ChevronDown, Trophy, Users, Zap, ShieldCheck, Lock, TrendingUp, BarChart3, Loader2 } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { LeaderboardSection } from '@/components/home/leaderboard-section';
import { LeaderboardSkeleton } from '@/components/home/leaderboard-skeleton';
import { ImportTraderSection } from '@/components/home/import-trader-section';
import { usePrivyLogin } from '@/lib/privy-login';

export function Home() {
  const { authenticated, ready, login, isLoggingIn } = usePrivyLogin();
  const [homeStats, setHomeStats] = useState<{ traderCount: number | null; totalVolume: number | null }>({
    traderCount: null,
    totalVolume: null
  });

  useEffect(() => {
    const fetchHomeStats = async () => {
      try {
        const res = await fetch('/api/home/stats');
        if (!res.ok) throw new Error('Failed to fetch stats');

        const data = await res.json();
        setHomeStats({
          traderCount: data.traderCount,
          totalVolume: data.totalVolume
        });
      } catch (e) {
        console.error("Failed to fetch homepage stats", e);
        setHomeStats({ traderCount: null, totalVolume: null });
      }
    };

    fetchHomeStats();
  }, []);

  function formatVolume(volume: number): string {
    if (volume >= 1_000_000_000) return `$${(volume / 1_000_000_000).toFixed(1)}B+`;
    if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M+`;
    if (volume >= 1_000) return `$${(volume / 1_000).toFixed(0)}K+`;
    return `$${volume.toLocaleString()}`;
  }



  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="pt-20 pb-16 md:pt-32 md:pb-24 text-center px-4">
        <div className="container max-w-4xl mx-auto space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
            Best Polymarket Traders to <br /> Follow & Copy
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Stop guessing on prediction markets. Follow proven traders with verified win rates and automatically copy their trades to your wallet.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/smart-money"
              className="px-8 py-3 rounded-lg bg-yellow-500 text-black font-bold text-lg hover:bg-yellow-400 transition-colors"
            >
              See All Traders
            </Link>
            <Link
              href="/portfolio"
              className="px-8 py-3 rounded-lg bg-white/10 text-foreground font-medium border border-white/10 hover:bg-white/20 transition-colors"
            >
              How It Works
            </Link>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-8 pt-12 max-w-3xl mx-auto border-t border-white/10 mt-12">
            <div>
              <div className="text-2xl md:text-3xl font-bold text-yellow-500">
                {homeStats.traderCount !== null ? `${homeStats.traderCount.toLocaleString()}+` : '500+'}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Verified Traders</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold text-green-500">
                {homeStats.totalVolume !== null ? formatVolume(homeStats.totalVolume) : '$2M+'}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Total Volume Traded</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold text-blue-500">Live</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">On-Chain Data</div>
            </div>
          </div>
        </div>
      </section>

      {/* Import Trader Section */}
      <ImportTraderSection />

      {/* Leaderboard Preview - Only show when authenticated */}
      <section className="py-16 bg-card/30 border-y border-white/5">
        <div className="container max-w-5xl mx-auto px-4">
          {(!ready || authenticated) ? (
            <>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold">Top 10 Traders by Copy Score</h2>
                <p className="text-sm text-muted-foreground hidden md:block">Ranked by scientific metrics: risk-adjusted returns, profit factor, and consistency.</p>
              </div>

              <Suspense fallback={<LeaderboardSkeleton />}>
                {/* Show skeleton if not ready, otherwise real component */}
                {!ready ? <LeaderboardSkeleton /> : <LeaderboardSection />}
              </Suspense>

              <div className="text-center mt-8">
                <Link href="/smart-money" className="text-yellow-500 hover:text-yellow-400 text-sm font-medium inline-flex items-center gap-1">
                  View All 500+ Traders <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-card/50 p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Lock className="h-10 w-10 text-yellow-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Connect Your Wallet to View Top Traders</h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                Access the complete leaderboard of top performers on Polymarket.
                View their trading history, profit metrics, and start copy trading with a single click.
              </p>

              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-yellow-400" />
                  </div>
                  <h3 className="font-semibold mb-1">Top 10 Preview</h3>
                  <p className="text-xs text-muted-foreground">Most followed traders</p>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                  </div>
                  <h3 className="font-semibold mb-1">Real-time PnL</h3>
                  <p className="text-xs text-muted-foreground">Live profit tracking</p>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-blue-400" />
                  </div>
                  <h3 className="font-semibold mb-1">Verified Data</h3>
                  <p className="text-xs text-muted-foreground">On-chain verification</p>
                </div>
              </div>

              <button
                onClick={login}
                disabled={isLoggingIn}
                aria-busy={isLoggingIn}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? (
                  <>
                    Connecting...
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </>
                ) : (
                  <>
                    Connect Wallet to View Traders
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* How to Pick Section */}
      <section className="py-24 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4">How to Pick the Best Traders to Copy</h2>
            <p className="text-muted-foreground">Not all traders are equal. Follow these tips to maximize your copy trading success.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Card 1 */}
            <div className="p-8 rounded-xl bg-card border border-white/5 hover:border-white/10 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-6">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold mb-3">Diversify Across Traders</h3>
              <p className="text-muted-foreground leading-relaxed">
                Copy 3-5 traders with different styles to reduce risk and smooth out returns. Don't put all eggs in one basket.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-8 rounded-xl bg-card border border-white/5 hover:border-white/10 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-6">
                <Trophy className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold mb-3">Check Recent Performance</h3>
              <p className="text-muted-foreground leading-relaxed">
                Focus on 7-day and 30-day stats, not just all-time. Markets change and so do trader strategies.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-8 rounded-xl bg-card border border-white/5 hover:border-white/10 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-6">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold mb-3">Start Small</h3>
              <p className="text-muted-foreground leading-relaxed">
                Begin with smaller allocations and increase as you verify the trader's performance and consistency.
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-8 rounded-xl bg-card border border-white/5 hover:border-white/10 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-6">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold mb-3">Monitor Weekly</h3>
              <p className="text-muted-foreground leading-relaxed">
                Check your portfolio every week and adjust based on trader performance. Stop copying underperformers early.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-4 bg-card/30 border-t border-white/5">
        <div className="container max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>

          <div className="space-y-4">
            {[
              { q: "How do I know which Polymarket traders to follow?", a: "Look for traders with consistent win rates (above 55%), positive profit over 7-30 days, and multiple followers. Avoid traders who only trade occasionally or have recent losing streaks." },
              { q: "Can I copy multiple traders at once?", a: "Yes! With PolyHunter, you can copy unlimited traders simultaneously. This is actually recommended for diversification — if one trader has a bad week, others may balance it out." },
              { q: "How much should I allocate per trader?", a: "We recommend starting with $50-100 per trader and spreading across 3-5 traders. As you learn which traders perform best for your risk tolerance, you can adjust allocations." },
              { q: "What if a top trader starts losing money?", a: "You can pause or stop copying any trader instantly. We recommend checking your portfolio weekly and adjusting if a trader has lost more than 20% in a month." },
              { q: "Are these traders verified?", a: "All trader statistics on PolyHunter come directly from on-chain Polymarket data. Win rates, PnL, and trading history are verifiable and cannot be faked." }
            ].map((item, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-card overflow-hidden">
                <details className="group">
                  <summary className="flex cursor-pointer items-center justify-between p-6 font-medium transition-colors hover:bg-white/5 list-none">
                    {item.q}
                    <span className="ml-4 flex-shrink-0 transition-transform group-open:rotate-180">
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </summary>
                  <div className="px-6 pb-6 pt-0 text-muted-foreground leading-relaxed">
                    {item.a}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 px-4 text-center">
        <div className="container max-w-4xl mx-auto space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold">Start Copying Top Traders Today</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join thousands of traders already copying Polymarket whales. It's free to start — you only pay when you profit.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/smart-money"
              className="px-8 py-3 rounded-lg bg-yellow-500 text-black font-bold text-lg hover:bg-yellow-400 transition-colors w-full sm:w-auto"
            >
              Find Traders to Copy <ArrowRight className="ml-2 h-4 w-4 inline" />
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-3 rounded-lg bg-white/10 text-foreground font-medium border border-white/10 hover:bg-white/20 transition-colors w-full sm:w-auto"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Footer is now global in layout.tsx */}
    </div>
  );
}

export default Home;
