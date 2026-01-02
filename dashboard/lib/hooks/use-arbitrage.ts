'use client';

import { useQuery } from '@tanstack/react-query';

interface ArbitrageOpportunity {
    marketId: string;
    marketName: string;
    type: 'LONG' | 'SHORT';
    profitRate: number;
    yesBid: number;
    yesAsk: number;
    noBid: number;
    noAsk: number;
    depth: number;
    suggestedAmount: number;
}

export function useArbitrageScan(minVolume: number = 1000, profitThreshold: number = 0.01) {
    return useQuery({
        queryKey: ['arbitrage-scan', minVolume, profitThreshold],
        queryFn: async () => {
            const response = await fetch(
                `/api/arbitrage/scan?minVolume=${minVolume}&profitThreshold=${profitThreshold}`
            );
            if (!response.ok) {
                throw new Error('Failed to scan for arbitrage');
            }
            const result = await response.json();
            return result.data as ArbitrageOpportunity[];
        },
        refetchInterval: 10000, // Refetch every 10 seconds
    });
}
