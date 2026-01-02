'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSDK, useSDKServices } from '@/lib/hooks/use-sdk';

// Market type
export interface Market {
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

// Market detail hook - now uses SDK directly instead of API route
export function useMarketDetail(conditionId: string | null) {
  const { sdk } = useSDK();
  const { getMarket } = useSDKServices(sdk);
  
  return useQuery<Market, Error>({
    queryKey: ['market-detail', conditionId],
    queryFn: async () => {
      if (!conditionId) throw new Error('No conditionId provided');
      
      const result = await getMarket(conditionId);
      if (!result) throw new Error('Market not found');
      
      // Map SDK market type to our interface
      return {
        conditionId: result.conditionId,
        slug: result.slug || conditionId,
        question: result.question,
        description: result.description,
        yesPrice: result.tokens.find(t => t.outcome === 'Yes')?.price || 0,
        noPrice: result.tokens.find(t => t.outcome === 'No')?.price || 0,
        volume24h: result.volume24hr || 0,
        liquidity: result.liquidity || 0,
        endDate: result.endDate ? result.endDate.toISOString() : '',
        active: result.active,
        closed: result.closed
      };
    },
    enabled: !!conditionId,
    refetchInterval: 30000, // Still use polling for now, but could be replaced with real-time
    retry: 1, // Only retry once to avoid infinite retry loops on network errors
  });
}

// Markets list hook - now uses SDK directly instead of API route
export function useMarkets(params?: { limit?: number; search?: string; active?: boolean }) {
  const { sdk, loading, error } = useSDK();
  const { getMarkets } = useSDKServices(sdk, loading, error);
  
  return useQuery<Market[], Error>({
    queryKey: ['markets', params],
    queryFn: async () => {
      const result = await getMarkets();
      if (!result) throw new Error('Failed to fetch markets');
      
      // Apply client-side filtering based on params
      let filteredMarkets = result.map((m: import('@catalyst-team/poly-sdk').GammaMarket) => ({
        conditionId: m.conditionId,
        slug: m.slug || m.conditionId,
        question: m.question,
        description: m.description,
        yesPrice: m.outcomePrices?.[0] || 0,
        noPrice: m.outcomePrices?.[1] || 0,
        volume24h: m.volume24hr || 0,
        liquidity: m.liquidity || 0,
        endDate: m.endDate ? m.endDate.toISOString() : '',
        active: m.active,
        closed: m.closed
      }));
      
      if (params?.search) {
        const searchTerm = params.search.toLowerCase();
        filteredMarkets = filteredMarkets.filter((market: Market) => 
          market.question.toLowerCase().includes(searchTerm) ||
          market.description?.toLowerCase().includes(searchTerm)
        );
      }
      
      if (params?.active !== undefined) {
        filteredMarkets = filteredMarkets.filter((market: Market) => 
          market.active === params.active
        );
      }
      
      if (params?.limit) {
        filteredMarkets = filteredMarkets.slice(0, params.limit);
      }
      
      return filteredMarkets;
    },
    refetchInterval: 30000, // Still use polling for now, but could be replaced with real-time
    retry: 1, // Only retry once to avoid infinite retry loops on network errors
  });
}
