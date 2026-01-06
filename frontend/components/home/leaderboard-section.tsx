import { LeaderboardTable, ActiveTrader } from './leaderboard-table';

async function fetchActiveTraders(): Promise<ActiveTrader[]> {
    try {
        // Use the new active traders API that filters for copy-worthy traders
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        // Default to 7d period for initial server render
        const response = await fetch(`${baseUrl}/api/traders/active?limit=10&period=7d`, {
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
        <LeaderboardTable initialData={activeTraders} />
    );
}

