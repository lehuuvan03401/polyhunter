
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useSimulatedHistory(walletAddress: string) {
    const { data, error, isLoading, mutate } = useSWR(
        walletAddress ? `/api/copy-trading/history?wallet=${walletAddress}` : null,
        fetcher,
        {
            refreshInterval: 15000, // Refresh every 15s
            dedupingInterval: 15000,
        }
    );

    const history = Array.isArray(data) ? data : [];

    return {
        history,
        isLoading,
        isError: error,
        mutate
    };
}
