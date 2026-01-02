'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RealtimeServiceV2,
  type PriceUpdate,
  type Orderbook,
  type ArbitrageOpportunity,
  type Market
} from '@catalyst-team/poly-sdk';
import { useSDK } from './use-sdk';

interface RealtimeData {
  prices: Record<string, PriceUpdate>;
  orderbooks: Record<string, Orderbook>;
  arbitrageOpportunities: ArbitrageOpportunity[];
}

/**
 * Hook for real-time market data
 * Provides real-time prices, orderbooks, and arbitrage opportunities
 */
export function useRealtimeMarketData(tokenIds: string[] = []) {
  const { realtimeService, sdk, loading: sdkLoading } = useSDK();
  const [data, setData] = useState<RealtimeData>({
    prices: {},
    orderbooks: {},
    arbitrageOpportunities: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use refs to store latest data for callbacks
  const dataRef = useRef(data);
  dataRef.current = data;

  const subscribeToMarketUpdates = useCallback(async () => {
    if (!realtimeService || !sdk) return;

    let priceSubscription: any;

    try {
      setLoading(true);
      setError(null);

      // Subscribe to price updates
      if (tokenIds.length > 0) {
        priceSubscription = realtimeService.subscribeMarkets(tokenIds, {
          onPriceChange: (update) => {
            // Use the first price in changes array as current price
            const price = update.changes.length > 0 ? parseFloat(update.changes[0].price) : 0;
            setData(prev => ({
              ...prev,
              prices: {
                ...prev.prices,
                [update.assetId]: {
                  assetId: update.assetId,
                  price: price,
                  midpoint: price,
                  spread: 0,
                  timestamp: update.timestamp
                }
              }
            }));
          }
        });
      }

      // Set up arbitrage scanning
      if (sdk) {
        // Scan for arbitrage opportunities periodically
        const scanArbitrage = async () => {
          if (!sdk) return;

          try {
            // Get trending markets to scan for arbitrage
            // Reduced limit to 5 to prevent rate limits
            const markets = await sdk.gammaApi.getMarkets({ limit: 5 });
            const opportunities: ArbitrageOpportunity[] = [];

            // Sequential scan with delay
            for (const market of markets) {
              try {
                const arb = await sdk.detectArbitrage(market.conditionId, 0.005);
                if (arb) {
                  opportunities.push(arb);
                }
                // Small delay to be nice to the API
                await new Promise(r => setTimeout(r, 200));
              } catch (e) {
                console.warn('Error checking market:', market.conditionId, e);
              }
            }

            setData(prev => ({
              ...prev,
              arbitrageOpportunities: opportunities
            }));
          } catch (err) {
            console.error('Error scanning arbitrage:', err);
          }
        };

        // Initial scan
        void scanArbitrage();

        // Scan every 15 seconds (increased from 10)
        const interval = setInterval(scanArbitrage, 15000);

        // Clean up interval on unmount
        return () => {
          clearInterval(interval);
          priceSubscription?.unsubscribe();
        };
      }
    } catch (err) {
      console.error('Error in real-time subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to subscribe to real-time updates');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeService, sdk, JSON.stringify(tokenIds)]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setupSubscriptions = async () => {
      cleanup = await subscribeToMarketUpdates();
    };

    setupSubscriptions();

    return () => {
      if (cleanup) cleanup();
    };
  }, [subscribeToMarketUpdates]);

  const refreshArbitrage = useCallback(async () => {
    if (!sdk) return;

    try {
      // Get trending markets to scan for arbitrage
      const markets = await sdk.gammaApi.getMarkets({ limit: 20 });
      const opportunities: ArbitrageOpportunity[] = [];

      for (const market of markets) {
        const arb = await sdk.detectArbitrage(market.conditionId, 0.005);
        if (arb) {
          opportunities.push(arb);
        }
      }

      setData(prev => ({
        ...prev,
        arbitrageOpportunities: opportunities
      }));
    } catch (err) {
      console.error('Error refreshing arbitrage:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh arbitrage data');
    }
  }, [sdk]);

  return {
    data,
    loading: loading || sdkLoading,
    error,
    refreshArbitrage
  };
}