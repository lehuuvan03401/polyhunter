'use client';

import { useQuery } from '@tanstack/react-query';

// Market type
interface Market {
    conditionId: string;
    slug: string;
    question: string;
    description?: string;
    yesPrice: number;
    noPrice: number;
    volume24h: number;
    liquidity: number;
    endDate?: string;
    active?: boolean;
    closed?: boolean;
}

// Market detail with orderbook
interface MarketDetail {
    market: Market;
    orderbook?: unknown;
}

// Market detail hook
export function useMarketDetail(slug: string | null) {
    return useQuery<MarketDetail>({
        queryKey: ['market-detail', slug],
        queryFn: async () => {
            if (!slug) throw new Error('No slug provided');

            const response = await fetch(`/api/markets/${slug}`);
            if (!response.ok) {
                throw new Error('Failed to fetch market details');
            }
            const result = await response.json();
            return result.data;
        },
        enabled: !!slug,
        refetchInterval: 30000,
    });
}

// Markets list hook
export function useMarkets(params?: { limit?: number; search?: string; active?: boolean }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.active !== undefined) searchParams.set('active', params.active.toString());

    return useQuery<Market[]>({
        queryKey: ['markets', params],
        queryFn: async () => {
            const response = await fetch(`/api/markets?${searchParams.toString()}`);
            if (!response.ok) {
                throw new Error('Failed to fetch markets');
            }
            const result = await response.json();
            return result.data;
        },
        refetchInterval: 30000,
    });
}
