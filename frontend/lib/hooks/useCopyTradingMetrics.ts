import useSWR from 'swr';

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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * Hook to fetch simulated copy trading metrics
 */
export function useCopyTradingMetrics(walletAddress: string) {
    const { data, error, isLoading } = useSWR<CopyTradingMetrics>(
        walletAddress ? `/api/copy-trading/metrics?wallet=${walletAddress}` : null,
        fetcher,
        {
            refreshInterval: 3000,
            fallbackData: {
                totalInvested: 0,
                activePositions: 0,
                realizedPnL: 0,
                unrealizedPnL: 0,
                totalPnL: 0
            }
        }
    );

    // Calc total PnL if not provided or just pass through
    const metrics = data ? {
        ...data,
        totalPnL: (data.realizedPnL || 0) + (data.unrealizedPnL || 0)
    } : {
        totalInvested: 0,
        activePositions: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        totalPnL: 0
    };

    return {
        metrics,
        isLoading,
        isError: error
    };
}
