'use client';

import { useState, useEffect } from 'react';
import { LeaderboardTable, ActiveTrader } from './leaderboard-table';

async function fetchActiveTraders(): Promise<ActiveTrader[]> {
    try {
        // Use the new active traders API that filters for copy-worthy traders
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        // Default to 30d period to match LeaderboardTable default
        const response = await fetch(`${baseUrl}/api/traders/active?limit=10&period=30d`, {
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

            // Check cache
            const CACHE_KEY = 'polyhunter:leaderboard_data';
            const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    const age = Date.now() - timestamp;

                    if (age < CACHE_TTL) {
                        // Use cache
                        setActiveTraders(data);
                        setIsLoading(false);
                        return;
                    }
                }
            } catch (e) {
                console.warn('Failed to parse leaderboard cache', e);
            }

            // Fetch fresh data
            const data = await fetchActiveTraders();
            setActiveTraders(data);
            setIsLoading(false);

            // Save to cache
            try {
                if (data.length > 0) {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        data,
                        timestamp: Date.now()
                    }));
                }
            } catch (e) {
                console.warn('Failed to save leaderboard cache', e);
            }
        };

        loadData();
    }, []);

    if (isLoading) {
        return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
    }

    return <LeaderboardTable initialData={activeTraders} />;
}

