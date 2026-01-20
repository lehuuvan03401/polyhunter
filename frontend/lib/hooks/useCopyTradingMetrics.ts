
import { useState, useEffect } from 'react';

/**
 * Interface for Copy Trading Metrics response
 */
export interface CopyTradingMetrics {
    totalInvested: number;
    activePositions: number;
    realizedPnL: number;
    unrealizedPnL: number;
    totalPnL: number;
}

/**
 * Hook to fetch simulated copy trading metrics
 */
export function useCopyTradingMetrics(walletAddress: string, pollInterval = 3000) {
    const [metrics, setMetrics] = useState<CopyTradingMetrics>({
        totalInvested: 0,
        activePositions: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        totalPnL: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!walletAddress) return;

        let isMounted = true;

        const fetchMetrics = async () => {
            try {
                const res = await fetch(`/api/copy-trading/metrics?wallet=${walletAddress}`);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) {
                        setMetrics({
                            ...data,
                            totalPnL: (data.realizedPnL || 0) + (data.unrealizedPnL || 0)
                        });
                        setIsLoading(false);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch copy trading metrics", err);
            }
        };

        // Initial fetch
        fetchMetrics();

        // Polling
        const intervalId = setInterval(fetchMetrics, pollInterval);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [walletAddress, pollInterval]);

    return { metrics, isLoading };
}
