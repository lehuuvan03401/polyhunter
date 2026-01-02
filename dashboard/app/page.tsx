export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        {/* Hero Section */}
        <div className="text-center space-y-6 animate-fade-in">
          <h1 className="text-6xl font-bold">
            <span className="gradient-text">Polymarket Pro</span>
          </h1>
          <p className="text-xl text-gray-400">
            Advanced Trading Dashboard for Prediction Markets
          </p>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
            <FeatureCard
              icon="💎"
              title="Smart Money Tracker"
              description="Track top traders and auto-copy their strategies in real-time"
              href="/smart-money"
            />
            <FeatureCard
              icon="💰"
              title="Arbitrage Monitor"
              description="Scan markets for opportunities and execute profitable arbitrage"
              href="/arbitrage"
            />
            <FeatureCard
              icon="📊"
              title="Market Analytics"
              description="Advanced charts, orderbook analysis, and price predictions"
              href="/markets"
            />
            <FeatureCard
              icon="💱"
              title="Pro Trading"
              description="Professional trading interface with limit and market orders"
              href="/trading"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description, href }: {
  icon: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="glass p-6 rounded-xl hover:glow transition-all duration-300 group cursor-pointer"
    >
      <div className="text-4xl mb-4 transform group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2 gradient-text">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </a>
  );
}
