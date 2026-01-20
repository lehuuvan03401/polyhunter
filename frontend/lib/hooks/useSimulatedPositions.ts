import useSWR from 'swr';

export interface SimulatedPosition {
    tokenId: string;
    title: string;
    outcome: string;
    size: number;
    avgPrice: number;
    curPrice: number;
    percentPnl: number;
    totalCost: number;
    simulated: boolean;
    timestamp?: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useSimulatedPositions(walletAddress: string) {
    const { data, error, isLoading } = useSWR<SimulatedPosition[]>(
        walletAddress ? `/api/copy-trading/positions?wallet=${walletAddress}` : null,
        fetcher,
        {
            refreshInterval: 3000,
            fallbackData: []
        }
    );

    return {
        positions: data || [],
        isLoading,
        isError: error
    };
}
