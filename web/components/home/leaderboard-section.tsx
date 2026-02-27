'use client';

import { useState, useEffect } from 'react';
import { LeaderboardTable, ActiveTrader, populateCache } from './leaderboard-table';
import { LeaderboardSkeleton } from './leaderboard-skeleton';

const PERIODS = ['7d', '15d', '30d', '90d'] as const;
const DEFAULT_PERIOD = '30d';
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
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
}

export function LeaderboardSection() {
    const [initialData, setInitialData] = useState<ActiveTrader[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        let deferredTimer: ReturnType<typeof setTimeout> | null = null;

        const refreshPeriod = async (period: string): Promise<ActiveTrader[]> => {
            const data = await fetchTradersByPeriod(period);
            if (data.length > 0) {
                populateCache(period, data);
                setLocalCache(period, data);
            }
            return data;
        };

        const loadLeaderboard = async () => {
            // Step 1: Hydrate cache from localStorage first
            for (const period of PERIODS) {
                const cached = getLocalCache(period);
                if (cached && cached.length > 0) {
                    populateCache(period, cached);
                }
            }

            const cachedDefault = getLocalCache(DEFAULT_PERIOD);

            // Show default period immediately when available
            if (cachedDefault && cachedDefault.length > 0) {
                if (!cancelled) {
                    setInitialData(cachedDefault);
                    setIsLoading(false);
                }

                // Refresh default period in background
                void refreshPeriod(DEFAULT_PERIOD).then((freshDefault) => {
                    if (!cancelled && freshDefault.length > 0) {
                        setInitialData(freshDefault);
                    }
                });
            } else {
                // No default-period cache: fetch only default period first to unblock UI
                const freshDefault = await refreshPeriod(DEFAULT_PERIOD);
                if (!cancelled && freshDefault.length > 0) {
                    setInitialData(freshDefault);
                }
                if (!cancelled) {
                    setIsLoading(false);
                }
            }

            // Step 2: Defer remaining periods so first paint is not blocked by slower endpoints
            deferredTimer = setTimeout(() => {
                for (const period of PERIODS) {
                    if (period === DEFAULT_PERIOD) continue;
                    void refreshPeriod(period);
                }
            }, 1200);
        };

        void loadLeaderboard();

        return () => {
            cancelled = true;
            if (deferredTimer) clearTimeout(deferredTimer);
        };
    }, []);

    if (isLoading && initialData.length === 0) {
        return <LeaderboardSkeleton />;
    }

    return <LeaderboardTable initialData={initialData} />;
}
