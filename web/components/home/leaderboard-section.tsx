'use client';

import { useState, useEffect } from 'react';
import { LeaderboardTable, ActiveTrader, populateCache } from './leaderboard-table';
import { LeaderboardSkeleton } from './leaderboard-skeleton';

const PERIODS = ['7d', '15d', '30d', '90d'] as const;
const CACHE_KEY_PREFIX = 'polyhunter:leaderboard_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchTradersByPeriod(period: string): Promise<ActiveTrader[]> {
    try {
        const response = await fetch(`/api/traders/active?limit=10&period=${period}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        return data.traders || [];
    } catch (error) {
        console.error(`Failed to fetch traders for ${period}:`, error);
        return [];
    }
}

function getLocalCache(period: string): ActiveTrader[] | null {
    try {
        const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${period}`);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_TTL) {
                return data;
            }
        }
    } catch (e) { /* ignore */ }
    return null;
}

function setLocalCache(period: string, data: ActiveTrader[]) {
    try {
        if (data.length > 0) {
            localStorage.setItem(`${CACHE_KEY_PREFIX}${period}`, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        }
    } catch (e) { /* ignore */ }
}

export function LeaderboardSection() {
    const [initialData, setInitialData] = useState<ActiveTrader[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadAllPeriods = async () => {
            // Step 1: Check localStorage for ALL periods, populate in-memory cache
            let hasCachedData = false;
            for (const period of PERIODS) {
                const cached = getLocalCache(period);
                if (cached && cached.length > 0) {
                    populateCache(period, cached);
                    if (period === '30d') {
                        setInitialData(cached);
                        hasCachedData = true;
                    }
                }
            }

            // If we have cached 30d data, show it immediately
            if (hasCachedData) {
                setIsLoading(false);
            }

            // Step 2: Fetch all periods in parallel (background refresh or initial load)
            const results = await Promise.all(
                PERIODS.map(async (period) => {
                    const data = await fetchTradersByPeriod(period);
                    if (data.length > 0) {
                        populateCache(period, data);
                        setLocalCache(period, data);
                    }
                    return { period, data };
                })
            );

            // Update initial data with fresh 30d data
            const fresh30d = results.find(r => r.period === '30d')?.data || [];
            if (fresh30d.length > 0) {
                setInitialData(fresh30d);
            }
            setIsLoading(false);
        };

        loadAllPeriods();
    }, []);

    if (isLoading && initialData.length === 0) {
        return <LeaderboardSkeleton />;
    }

    return <LeaderboardTable initialData={initialData} />;
}
