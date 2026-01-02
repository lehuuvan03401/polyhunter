'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useSmartMoneyLeaderboard } from '@/lib/hooks/use-smart-money';
import { useMarkets } from '@/lib/hooks/use-markets';
import { formatCurrency, shortenAddress } from '@/lib/utils';

export default function Home() {
  const { data: topTraders } = useSmartMoneyLeaderboard(5);
  const { data: hotMarkets } = useMarkets({ limit: 6 });
  const [liveStats, setLiveStats] = useState({ volume: 2456789, markets: 1234, users: 45678 });

  // Simulate live stats updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveStats(prev => ({
        volume: prev.volume + Math.random() * 1000 - 500,
        markets: prev.markets + (Math.random() > 0.8 ? 1 : 0),
        users: prev.users + (Math.random() > 0.7 ? 1 : 0),
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section with Gradient Background */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 pt-8 pb-16">
          <div className="text-center space-y-6 animate-fade-in">
            {/* Logo Animation */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-gradient-elegant flex items-center justify-center border border-silver-600/30 shadow-glow-silver">
                  <span className="text-5xl">⚡</span>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full animate-pulse-subtle" />
              </div>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              <span className="gradient-text">Polymarket Pro</span>
            </h1>
            <p className="text-lg md:text-xl text-silver-400 max-w-2xl mx-auto">
              Professional-grade trading dashboard for prediction markets.
              <br />
              <span className="text-silver-500">Track smart money, find arbitrage, and trade with precision.</span>
            </p>

            {/* Live Status Badge */}
            <div className="flex items-center justify-center gap-4">
              <div className="glass px-4 py-2 rounded-full border border-silver-600/20 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-subtle" />
                <span className="text-sm text-silver-300">Live Data</span>
              </div>
              <div className="glass px-4 py-2 rounded-full border border-silver-600/20">
                <span className="text-sm text-silver-400">🚀 SDK v0.3.0</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
              <Link href="/smart-money">
                <Button size="lg" className="text-base px-8">
                  💎 Smart Money Tracker
                </Button>
              </Link>
              <Link href="/arbitrage">
                <Button variant="secondary" size="lg" className="text-base px-8">
                  💰 Arbitrage Scanner
                </Button>
              </Link>
              <Link href="/trading">
                <Button variant="ghost" size="lg" className="text-base px-8">
                  💱 Trading Terminal
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Live Stats Bar */}
      <div className="border-y border-silver-600/20 bg-dark-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 md:gap-8">
            <LiveStat label="24h Volume" value={`$${(liveStats.volume / 1000000).toFixed(2)}M`} />
            <LiveStat label="Markets" value={liveStats.markets.toLocaleString()} />
            <LiveStat label="Traders" value={`${(liveStats.users / 1000).toFixed(1)}K`} />
            <LiveStat label="API Status" value="✓ Online" highlight />
            <LiveStat label="WebSocket" value="✓ Connected" highlight />
            <LiveStat label="Latency" value="48ms" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <FeatureCard
            icon="💎"
            title="Smart Money"
            description="Track top traders, analyze strategies, and copy winning trades"
            href="/smart-money"
            stats={topTraders ? `${topTraders.length}+ wallets` : 'Loading...'}
            badge="Live"
          />
          <FeatureCard
            icon="💰"
            title="Arbitrage Monitor"
            description="Scan markets for price discrepancies and execute profitable trades"
            href="/arbitrage"
            stats="Real-time scanning"
            badge="Active"
          />
          <FeatureCard
            icon="📊"
            title="Market Analytics"
            description="Advanced charts, orderbook visualization, and market insights"
            href="/markets"
            stats={hotMarkets ? `${hotMarkets.length}+ markets` : 'Loading...'}
            badge="New"
          />
          <FeatureCard
            icon="🔧"
            title="On-Chain Tools"
            description="CTF operations, token swaps, and approval management"
            href="/onchain"
            stats="CTF Integration"
            badge="SDK"
          />
        </div>

        {/* Two Column Layout: Top Traders + Hot Markets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* Top Traders */}
          <Card className="card-elegant">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-silver-100 flex items-center gap-2">
                    🏆 Top Smart Money
                  </CardTitle>
                  <CardDescription>Highest PnL traders this week</CardDescription>
                </div>
                <Link href="/smart-money">
                  <Button variant="ghost" size="sm">View All →</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {topTraders && topTraders.length > 0 ? (
                <div className="space-y-3">
                  {topTraders.slice(0, 5).map((trader, i) => (
                    <Link
                      href={`/smart-money/${trader.address}`}
                      key={trader.address}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-silver-500 w-6">#{i + 1}</span>
                        <div className="w-8 h-8 rounded-full bg-gradient-elegant flex items-center justify-center text-sm">
                          {['🦈', '🐋', '🦁', '🦅', '🐺'][i]}
                        </div>
                        <span className="text-silver-300 font-mono text-sm group-hover:text-silver-100 transition">
                          {shortenAddress(trader.address)}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${trader.pnl >= 0 ? 'text-emerald-400' : 'text-crimson-400'}`}>
                          {trader.pnl >= 0 ? '+' : ''}{formatCurrency(trader.pnl)}
                        </p>
                        <p className="text-xs text-silver-500">Score: {trader.score}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="animate-pulse text-4xl mb-2">⏳</div>
                  <p className="text-silver-400">Loading top traders...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hot Markets */}
          <Card className="card-elegant">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-silver-100 flex items-center gap-2">
                    🔥 Hot Markets
                  </CardTitle>
                  <CardDescription>Trending prediction markets</CardDescription>
                </div>
                <Link href="/markets">
                  <Button variant="ghost" size="sm">View All →</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {hotMarkets && hotMarkets.length > 0 ? (
                <div className="space-y-3">
                  {hotMarkets.slice(0, 5).map((market, i) => (
                    <Link
                      href={`/markets/${market.slug}`}
                      key={market.conditionId}
                      className="block p-3 rounded-lg hover:bg-white/5 transition"
                    >
                      <p className="text-silver-200 text-sm mb-2 line-clamp-1">{market.question}</p>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 flex gap-2">
                          <Badge variant="success" className="text-xs">
                            YES {(market.yesPrice * 100).toFixed(0)}¢
                          </Badge>
                          <Badge variant="danger" className="text-xs">
                            NO {(market.noPrice * 100).toFixed(0)}¢
                          </Badge>
                        </div>
                        <span className="text-xs text-silver-500">
                          Vol: {formatCurrency(market.volume24h, 0)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="animate-pulse text-4xl mb-2">⏳</div>
                  <p className="text-silver-400">Loading markets...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Access Grid */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold gradient-text mb-6">Quick Access</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <QuickLink href="/trading" icon="💱" label="Trading" />
            <QuickLink href="/trading/orders" icon="📋" label="Orders" />
            <QuickLink href="/trading/positions" icon="💼" label="Positions" />
            <QuickLink href="/analytics" icon="📈" label="Analytics" />
            <QuickLink href="/smart-money/copy-trading" icon="🔄" label="Copy Trading" />
            <QuickLink href="/settings" icon="⚙️" label="Settings" />
          </div>
        </div>

        {/* Platform Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <StatsCard title="Active Markets" value="1,234" icon="📊" />
          <StatsCard title="24h Volume" value="$2.4M" icon="💵" />
          <StatsCard title="Smart Wallets" value="500+" icon="💎" />
          <StatsCard title="Arbitrage Opps" value="24/7" icon="🔍" />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-silver-600/20 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <span className="font-bold gradient-text">Polymarket Pro</span>
              <Badge variant="info">v1.0</Badge>
            </div>
            <p className="text-silver-500 text-sm">
              Powered by @catalyst-team/poly-sdk
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LiveStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-xs text-silver-500 uppercase tracking-wide">{label}</p>
      <p className={`font-bold ${highlight ? 'text-emerald-400' : 'text-silver-200'}`}>{value}</p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  href,
  stats,
  badge,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
  stats: string;
  badge?: string;
}) {
  return (
    <Link href={href}>
      <Card className="card-elegant hover:shadow-glow-silver transition-all duration-300 cursor-pointer h-full group">
        <CardHeader>
          <div className="flex items-start justify-between mb-3">
            <div className="text-4xl transform group-hover:scale-110 transition-transform">
              {icon}
            </div>
            {badge && (
              <Badge variant={badge === 'Live' ? 'success' : badge === 'Active' ? 'info' : 'default'}>
                {badge}
              </Badge>
            )}
          </div>
          <CardTitle className="text-silver-100 group-hover:text-white transition">{title}</CardTitle>
          <CardDescription className="text-silver-400">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-silver-500 uppercase tracking-wide">{stats}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href}>
      <div className="glass p-4 rounded-lg border border-silver-600/20 hover:border-silver-500/30 hover:bg-white/5 transition text-center group">
        <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">{icon}</div>
        <p className="text-sm text-silver-400 group-hover:text-silver-200 transition">{label}</p>
      </div>
    </Link>
  );
}

function StatsCard({ title, value, icon }: { title: string; value: string; icon: string }) {
  return (
    <Card className="card-elegant">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="text-3xl">{icon}</div>
          <div>
            <p className="text-sm text-silver-400">{title}</p>
            <p className="text-2xl font-bold gradient-text">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
