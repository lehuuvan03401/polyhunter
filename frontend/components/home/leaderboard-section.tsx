'use client';

import { useState, useEffect } from 'react';
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

export function LeaderboardSection() {
    const [activeTraders, setActiveTraders] = useState<ActiveTrader[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            const data = await fetchActiveTraders();
            setActiveTraders(data);
            setIsLoading(false);
        };

        loadData();
    }, []);

    if (isLoading) {
        return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
    }

    return <LeaderboardTable initialData={activeTraders} />;
}

