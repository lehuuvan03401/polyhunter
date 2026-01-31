'use client';

import { Link } from '@/i18n/routing';

import { ArrowRight, ChevronDown, Trophy, Users, Zap, ShieldCheck, Lock, TrendingUp, BarChart3, Loader2 } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { LeaderboardSection } from '@/components/home/leaderboard-section';
import { LeaderboardSkeleton } from '@/components/home/leaderboard-skeleton';
import { ImportTraderSection } from '@/components/home/import-trader-section';
import { usePrivyLogin } from '@/lib/privy-login';
import { useTranslations } from 'next-intl';

export function Home() {
  const t = useTranslations('HomePage');
  const tFaq = useTranslations('HomePage.faq');
  const tHowToPick = useTranslations('HomePage.howToPick');
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
            {t.rich('title', {
              br: () => <br />
            })}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/smart-money"
              className="px-8 py-3 rounded-lg bg-yellow-500 text-black font-bold text-lg hover:bg-yellow-400 transition-colors"
            >
              {t('seeAll')}
            </Link>
            <Link
              href="/portfolio"
              className="px-8 py-3 rounded-lg bg-white/10 text-foreground font-medium border border-white/10 hover:bg-white/20 transition-colors"
            >
              {t('howItWorks')}
            </Link>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-8 pt-12 max-w-3xl mx-auto border-t border-white/10 mt-12">
            <div>
              <div className="text-2xl md:text-3xl font-bold text-yellow-500">
                {homeStats.traderCount !== null ? `${homeStats.traderCount.toLocaleString()}+` : '500+'}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{t('statsVerification')}</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold text-green-500">
                {homeStats.totalVolume !== null ? formatVolume(homeStats.totalVolume) : '$2M+'}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{t('statsVolume')}</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold text-blue-500">Live</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{t('statsData')}</div>
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
                <h2 className="text-2xl font-bold">{t('leaderboardTitle')}</h2>
                <p className="text-sm text-muted-foreground hidden md:block">{t('leaderboardSubtitle')}</p>
              </div>

              <Suspense fallback={<LeaderboardSkeleton />}>
                {/* Show skeleton if not ready, otherwise real component */}
                {!ready ? <LeaderboardSkeleton /> : <LeaderboardSection />}
              </Suspense>

              <div className="text-center mt-8">
                <Link href="/smart-money" className="text-yellow-500 hover:text-yellow-400 text-sm font-medium inline-flex items-center gap-1">
                  {t('viewAllTraders')} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-card/50 p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Lock className="h-10 w-10 text-yellow-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3">{t('connectWalletTitle')}</h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                {t('connectWalletText')}
              </p>

              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-yellow-400" />
                  </div>
                  <h3 className="font-semibold mb-1">{t('topPreview')}</h3>
                  <p className="text-xs text-muted-foreground">{t('topPreviewDesc')}</p>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                  </div>
                  <h3 className="font-semibold mb-1">{t('realTimePnl')}</h3>
                  <p className="text-xs text-muted-foreground">{t('realTimePnlDesc')}</p>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-blue-400" />
                  </div>
                  <h3 className="font-semibold mb-1">{t('verifiedData')}</h3>
                  <p className="text-xs text-muted-foreground">{t('verifiedDataDesc')}</p>
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
                    {t('connectWalletBtn')}
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
            <h2 className="text-3xl font-bold mb-4">{t('howToPickTitle')}</h2>
            <p className="text-muted-foreground">{t('howToPickSubtitle')}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Card 1 */}
            <div className="p-8 rounded-xl bg-card border border-white/5 hover:border-white/10 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-6">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold mb-3">{tHowToPick('diversify.title')}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {tHowToPick('diversify.desc')}
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-8 rounded-xl bg-card border border-white/5 hover:border-white/10 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-6">
                <Trophy className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold mb-3">{tHowToPick('performance.title')}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {tHowToPick('performance.desc')}
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-8 rounded-xl bg-card border border-white/5 hover:border-white/10 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-6">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold mb-3">{tHowToPick('startSmall.title')}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {tHowToPick('startSmall.desc')}
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-8 rounded-xl bg-card border border-white/5 hover:border-white/10 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-6">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold mb-3">{tHowToPick('monitor.title')}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {tHowToPick('monitor.desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-4 bg-card/30 border-t border-white/5">
        <div className="container max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">{t('faqTitle')}</h2>

          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-card overflow-hidden">
                <details className="group">
                  <summary className="flex cursor-pointer items-center justify-between p-6 font-medium transition-colors hover:bg-white/5 list-none">
                    {tFaq(`q${i}`)}
                    <span className="ml-4 flex-shrink-0 transition-transform group-open:rotate-180">
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </summary>
                  <div className="px-6 pb-6 pt-0 text-muted-foreground leading-relaxed">
                    {tFaq(`a${i}`)}
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
          <h2 className="text-3xl md:text-4xl font-bold">{t('footerTitle')}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('footerText')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/smart-money"
              className="px-8 py-3 rounded-lg bg-yellow-500 text-black font-bold text-lg hover:bg-yellow-400 transition-colors w-full sm:w-auto"
            >
              {t('findTraders')} <ArrowRight className="ml-2 h-4 w-4 inline" />
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-3 rounded-lg bg-white/10 text-foreground font-medium border border-white/10 hover:bg-white/20 transition-colors w-full sm:w-auto"
            >
              {t('viewPricing')}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer is now global in layout.tsx */}
    </div>
  );
}

export default Home;
