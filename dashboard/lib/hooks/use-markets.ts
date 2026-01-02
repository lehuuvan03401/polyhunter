'use client';

import { useQuery } from '@tanstack/react-query';

interface Market {
    conditionId: string;
    slug: string;
    question: string;
    yesPrice: number;
    noPrice: number;
    volume24h: number;
    liquidity: number;
    endDate?: string;
}

export function useMarkets(limit: number = 20, search: string = '') {
    return useQuery({
        queryKey: ['markets', limit, search],
        queryFn: async () => {
            const params = new URLSearchParams({ limit: limit.toString() });
            if (search) params.set('search', search);

            const response = await fetch(`/api/markets?${params}`);
            if (!response.ok) {
                throw new Error('Failed to fetch markets');
            }
            const result = await response.json();
            return result.data as Market[];
        },
        refetchInterval: 30000, // Refetch every 30 seconds
    });
}
