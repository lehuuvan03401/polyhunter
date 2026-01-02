export default function ArbitragePage() {
    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto spacious">
                {/* Page Header */}
                <div className="flex items-center justify-between animate-fade-in mb-8">
                    <div>
                        <h1 className="text-4xl font-bold gradient-text mb-2">Arbitrage Monitor</h1>
                        <p className="text-silver-400">Scan and execute profitable arbitrage opportunities</p>
                    </div>
                    <div className="glass px-4 py-2 rounded-lg border border-silver-600/20">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-subtle" />
                            <span className="text-sm font-medium text-silver-200">Scanner Active</span>
                        </div>
                    </div>
                </div>

                {/* Coming Soon Placeholder */}
                <div className="glass rounded-xl p-16 text-center card-elegant">
                    <div className="text-6xl mb-6">💰</div>
                    <h2 className="text-3xl font-bold gradient-text mb-4">Arbitrage Scanner</h2>
                    <p className="text-silver-400 mb-3 text-lg">Under Development</p>
                    <p className="text-sm text-silver-500 max-w-2xl mx-auto leading-relaxed">
                        Automated arbitrage detection and execution system.
                        Find profitable opportunities across markets and execute trades instantly.
                    </p>
                </div>
            </div>
        </div>
    );
}
