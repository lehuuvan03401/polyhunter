import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto spacious">
        {/* Hero Section */}
        <div className="text-center space-y-8 animate-fade-in mb-16">
          <h1 className="text-6xl font-bold tracking-tight">
            <span className="gradient-text">Polymarket Pro</span>
          </h1>
          <p className="text-xl text-silver-400 max-w-2xl mx-auto">
            Professional trading dashboard for prediction markets
          </p>

          {/* Quick Actions */}
          <div className="flex items-center justify-center gap-4 mt-12">
            <Link href="/smart-money">
              <Button size="lg">
                💎 Smart Money Tracker
              </Button>
            </Link>
            <Link href="/arbitrage">
              <Button variant="secondary" size="lg">
                💰 Arbitrage Scanner
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <FeatureCard
            icon="💎"
            title="Smart Money Tracker"
            description="Track top traders and analyze their strategies in real-time"
            href="/smart-money"
            badge="Live"
          />
          <FeatureCard
            icon="💰"
            title="Arbitrage Monitor"
            description="Scan markets for opportunities and execute profitable trades"
            href="/arbitrage"
            badge="Active"
          />
          <FeatureCard
            icon="📊"
            title="Market Analytics"
            description="Advanced charts and orderbook analysis tools"
            href="/markets"
            badge="Coming Soon"
            disabled
          />
          <FeatureCard
            icon="💱"
            title="Pro Trading"
            description="Professional interface with advanced order types"
            href="/trading"
            badge="Coming Soon"
            disabled
          />
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard title="Active Markets" value="1,234" trend="+12.5%" positive />
          <StatsCard title="24h Volume" value="$2.4M" trend="+8.2%" positive />
          <StatsCard title="Total Users" value="45.6K" trend="+5.1%" positive />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  href,
  badge,
  disabled
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
  badge?: string;
  disabled?: boolean;
}) {
  const content = (
    <Card glow={!disabled} className={`${disabled ? 'opacity-50' : 'cursor-pointer hover:shadow-glow-silver'} transition-all duration-300 card-elegant`}>
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
        <CardTitle className="text-silver-100">{title}</CardTitle>
        <CardDescription className="text-silver-400">{description}</CardDescription>
      </CardHeader>
    </Card>
  );

  if (disabled) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}

function StatsCard({
  title,
  value,
  trend,
  positive
}: {
  title: string;
  value: string;
  trend: string;
  positive?: boolean;
}) {
  return (
    <Card className="card-elegant">
      <CardContent className="pt-6">
        <div className="space-y-2">
          <p className="text-sm text-silver-400">{title}</p>
          <div className="flex items-baseline justify-between">
            <h3 className="text-3xl font-bold gradient-text">{value}</h3>
            <Badge variant={positive ? 'success' : 'danger'}>
              {positive ? '↑' : '↓'} {trend}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
