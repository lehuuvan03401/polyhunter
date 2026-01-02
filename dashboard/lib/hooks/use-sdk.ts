'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PolymarketSDK,
  RealtimeServiceV2,
  type ArbitrageOpportunity,
  type SmartMoneyTrade,
  type Position,
  type Market
} from '@catalyst-team/poly-sdk';
import { getReadOnlySDK, getSDK } from '@/lib/sdk';

interface SDKContextType {
  sdk: PolymarketSDK | null;
  realtimeService: RealtimeServiceV2 | null;
  loading: boolean;
  error: string | null;
  initializeSDK: (withTrading?: boolean) => Promise<void>;
  cleanup: () => void;
}

/**
 * SDK Context Hook
 * Provides access to SDK instances and manages their lifecycle
 */
export function useSDK(initializeWithTrading: boolean = false): SDKContextType {
  const [sdk, setSdk] = useState<PolymarketSDK | null>(null);
  const [realtimeService, setRealtimeService] = useState<RealtimeServiceV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use ref to track realtime service for cleanup to avoid dependency loops
  const realtimeRef = useRef<RealtimeServiceV2 | null>(null);

  const initializeSDK = useCallback(async (withTrading: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      let sdkInstance: PolymarketSDK;

      if (withTrading) {
        // Initialize SDK with trading capabilities
        sdkInstance = await getSDK();
      } else {
        // Initialize read-only SDK
        // Use proxy URL when running in browser to avoid CORS
        const isClient = typeof window !== 'undefined';
        sdkInstance = new PolymarketSDK({
          gammaApiUrl: isClient ? '/api/gamma' : 'https://gamma-api.polymarket.com',
        });
      }

      // Initialize real-time service
      const realtime = new RealtimeServiceV2({
        autoReconnect: true,
        pingInterval: 5000,
      });

      setSdk(sdkInstance);
      setRealtimeService(realtime);
      realtimeRef.current = realtime;
    } catch (err) {
      console.error('Error initializing SDK:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize SDK');
    } finally {
      setLoading(false);
    }
  }, []); // Removed dependencies as getSDK/getReadOnlySDK are external imports

  const cleanup = useCallback(() => {
    if (realtimeRef.current) {
      realtimeRef.current.disconnect();
      realtimeRef.current = null;
    }
    setRealtimeService(null);
    setSdk(null);
  }, []);

  useEffect(() => {
    // Initialize SDK on mount
    initializeSDK(initializeWithTrading);

    // Cleanup on unmount
    return () => {
      if (realtimeRef.current) {
        realtimeRef.current.disconnect();
      }
    };
  }, [initializeWithTrading, initializeSDK]);

  return {
    sdk,
    realtimeService,
    loading,
    error,
    initializeSDK,
    cleanup
  };
}

/**
 * Hook to access SDK services with error handling
 * This version accepts the SDK instance as a parameter to avoid circular dependencies
 */
export function useSDKServices(sdk: PolymarketSDK | null, loading?: boolean, error?: string | null) {
  const getMarkets = useCallback(async (): Promise<import('@catalyst-team/poly-sdk').GammaMarket[] | null> => {
    if (!sdk) return null;
    try {
      return await sdk.gammaApi.getMarkets();
    } catch (err) {
      console.error('Error fetching markets:', err);
      return null;
    }
  }, [sdk]);

  const getMarket = useCallback(async (conditionId: string) => {
    if (!sdk) return null;
    try {
      return await sdk.getMarket(conditionId);
    } catch (err) {
      console.error('Error fetching market:', err);
      return null;
    }
  }, [sdk]);

  const getPositions = useCallback(async () => {
    if (!sdk) return [];
    try {
      // Need wallet address to get positions
      const walletAddress = process.env.NEXT_PUBLIC_WALLET_ADDRESS; // or get from context
      if (!walletAddress) return [];
      return await sdk.dataApi.getPositions(walletAddress);
    } catch (err) {
      console.error('Error fetching positions:', err);
      return [];
    }
  }, [sdk]);

  const detectArbitrage = useCallback(async (conditionId: string, minProfit: number = 0.005) => {
    if (!sdk) return null;
    try {
      return await sdk.detectArbitrage(conditionId, minProfit);
    } catch (err) {
      console.error('Error detecting arbitrage:', err);
      return null;
    }
  }, [sdk]);

  const getSmartMoneyTrades = useCallback(async (limit: number = 20) => {
    if (!sdk) return [];
    try {
      return await sdk.smartMoney.getSmartMoneyList(limit);
    } catch (err) {
      console.error('Error fetching smart money trades:', err);
      return [];
    }
  }, [sdk]);

  return {
    getMarkets,
    getMarket,
    getPositions,
    detectArbitrage,
    getSmartMoneyTrades,
    loading: loading ?? false,
    error: error ?? null
  };
}