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
    tradingPnL: number; // Execution slippage (realized from completed trades)
    realizedWins?: number;
    realizedLosses?: number;
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
                totalPnL: 0,
                tradingPnL: 0
            }
        }
    );

    // Calc total PnL if not provided or just pass through
    const metrics = data ? {
        ...data,
        totalPnL: data.unrealizedPnL || 0, // Settlement value as main PnL
        tradingPnL: data.tradingPnL || data.realizedPnL || 0
    } : {
        totalInvested: 0,
        activePositions: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        totalPnL: 0,
        tradingPnL: 0,
        realizedWins: 0,
        realizedLosses: 0
    };

    return {
        metrics,
        isLoading,
        isError: error
    };
}
