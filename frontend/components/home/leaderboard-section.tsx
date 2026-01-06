import Link from 'next/link';

interface ActiveTrader {
    address: string;
    name: string | null;
    profileImage?: string;
    activePositions: number;
    recentTrades: number;
    lastTradeTime: number;
    weeklyPnl: number;
    weeklyVolume: number;
    winRate: number;
    copyScore: number;
    rank: number;
}

async function fetchActiveTraders(): Promise<ActiveTrader[]> {
    try {
        // Use the new active traders API that filters for copy-worthy traders
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/traders/active?limit=10`, {
            next: { revalidate: 60 }, // Next.js ISR cache
        });

        if (!response.ok) {
            throw new Error('Failed to fetch');
        }

        const data = await response.json();
        return data.traders || [];
    } catch (error) {
        console.error('Failed to fetch active traders:', error);
        return [];
    }
}

export async function LeaderboardSection() {
    const activeTraders = await fetchActiveTraders();

    return (
        <div className="bg-card border rounded-xl overflow-hidden">
            {/* Header Row */}
            <div className="grid grid-cols-12 gap-4 p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b bg-muted/50">
                <div className="col-span-1 text-center">Rank</div>
                <div className="col-span-3">Trader</div>
                <div className="col-span-2 text-right">7d PnL</div>
                <div className="col-span-2 text-center">Positions</div>
                <div className="col-span-2 text-center">Score</div>
                <div className="col-span-2 text-right">Action</div>
            </div>

            {/* Rows */}
            {activeTraders.length > 0 ? activeTraders.map((trader) => (
                <div key={trader.address} className="grid grid-cols-12 gap-4 p-4 border-b last:border-0 hover:bg-white/5 items-center transition-colors">
                    <div className="col-span-1 text-center font-bold text-muted-foreground">#{trader.rank}</div>
                    <div className="col-span-3 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">
                            {trader.address.substring(2, 4).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-medium text-sm truncate max-w-[120px]">{trader.name || `${trader.address.slice(0, 6)}...`}</span>
                            <span className="text-xs text-muted-foreground">{trader.address.slice(0, 8)}...</span>
                        </div>
                    </div>
                    <div className={`col-span-2 text-right font-mono font-medium ${trader.weeklyPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {trader.weeklyPnl >= 0 ? '+' : ''}{trader.weeklyPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="col-span-2 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">
                            {trader.activePositions} <span className="text-muted-foreground">active</span>
                        </span>
                    </div>
                    <div className="col-span-2 text-center">
                        <div className="inline-flex items-center gap-2">
                            <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-yellow-500 to-green-500 rounded-full"
                                    style={{ width: `${trader.copyScore}%` }}
                                />
                            </div>
                            <span className="text-sm font-mono text-muted-foreground">{trader.copyScore}</span>
                        </div>
                    </div>
                    <div className="col-span-2 text-right">
                        <Link href={`/traders/${trader.address}`} className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors inline-block">
                            Copy
                        </Link>
                    </div>
                </div>
            )) : (
                <div className="p-8 text-center text-muted-foreground">No active traders found at the moment.</div>
            )}
        </div>
    );
}

