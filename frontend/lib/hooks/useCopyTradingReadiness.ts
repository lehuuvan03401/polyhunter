import useSWR from 'swr';

export type ReadinessStatus = {
    walletAddress: string;
    proxyAddress?: string | null;
    balances: {
        walletMatic?: number;
        walletUsdc?: number;
        proxyUsdc?: number;
    };
    allowances: {
        usdc?: { allowed: boolean; allowance?: number; reason?: string };
        ctf?: { allowed: boolean; reason?: string };
    };
    requiredActions: string[];
    ready: boolean;
    updatedAt: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useCopyTradingReadiness(walletAddress?: string, options?: { refreshInterval?: number }) {
    const refreshInterval = options?.refreshInterval ?? 15000;
    const { data, error, isLoading, mutate } = useSWR<ReadinessStatus>(
        walletAddress ? `/api/copy-trading/readiness?wallet=${walletAddress}` : null,
        fetcher,
        {
            refreshInterval,
            dedupingInterval: refreshInterval,
        }
    );

    return {
        readiness: data,
        isLoading,
        isError: error,
        refresh: mutate,
    };
}
