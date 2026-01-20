
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useSimulatedHistory(walletAddress: string) {
    const { data, error, isLoading, mutate } = useSWR(
        walletAddress ? `/api/copy-trading/history?wallet=${walletAddress}` : null,
        fetcher,
        {
            refreshInterval: 10000, // Refresh every 10s
        }
    );

    return {
        history: data || [],
        isLoading,
        isError: error,
        mutate
    };
}
