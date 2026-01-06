import Link from 'next/link';

interface TopTrader {
    address: string;
    name: string | null;
    pnl: number;
    volume: number;
    score: number;
    rank: number;
}

async function fetchTopTraders(): Promise<TopTrader[]> {
    try {
        // Use internal cached API instead of SDK direct call
        // This is much faster because:
        // 1. Uses simple in-memory cache (5 min TTL)
        // 2. Only makes 1 API call (leaderboard) instead of N+1 calls
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/traders/top?limit=10`, {
            next: { revalidate: 60 }, // Next.js ISR cache
        });

        if (!response.ok) {
            throw new Error('Failed to fetch');
        }

        const data = await response.json();
        return data.traders || [];
    } catch (error) {
        console.error('Failed to fetch top traders:', error);
        return [];
    }
}

export async function LeaderboardSection() {
    const topTraders = await fetchTopTraders();

    return (
        <div className="bg-card border rounded-xl overflow-hidden">
            {/* Header Row */}
            <div className="grid grid-cols-12 gap-4 p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b bg-muted/50">
                <div className="col-span-1 text-center">Rank</div>
                <div className="col-span-4">Trader</div>
                <div className="col-span-3 text-right">Profit</div>
                <div className="col-span-2 text-right">Score</div>
                <div className="col-span-2 text-right">Action</div>
            </div>

            {/* Rows */}
            {topTraders.length > 0 ? topTraders.map((trader, i) => (
                <div key={trader.address} className="grid grid-cols-12 gap-4 p-4 border-b last:border-0 hover:bg-white/5 items-center transition-colors">
                    <div className="col-span-1 text-center font-bold text-muted-foreground">#{trader.rank || i + 1}</div>
                    <div className="col-span-4 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">
                            {trader.address.substring(2, 4).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-medium text-sm truncate max-w-[120px]">{trader.name || `${trader.address.slice(0, 6)}...`}</span>
                            <span className="text-xs text-muted-foreground">{trader.address.slice(0, 8)}...</span>
                        </div>
                    </div>
                    <div className="col-span-3 text-right text-green-500 font-mono font-medium">
                        +${trader.pnl.toLocaleString()}
                    </div>
                    <div className="col-span-2 text-right font-mono text-muted-foreground">
                        {trader.score}
                    </div>
                    <div className="col-span-2 text-right">
                        <Link href={`/traders/${trader.address}`} className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors inline-block">
                            Copy
                        </Link>
                    </div>
                </div>
            )) : (
                <div className="p-8 text-center text-muted-foreground">No traders found at the moment.</div>
            )}
        </div>
    );
}

