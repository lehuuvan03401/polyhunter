'use client';

import { useQuery } from '@tanstack/react-query';

interface SmartMoneyWallet {
    address: string;
    pnl: number;
    volume: number;
    score: number;
    rank: number;
    winRate?: number;
    trades?: number;
}

export function useSmartMoneyLeaderboard(limit: number = 50) {
    return useQuery({
        queryKey: ['smart-money-leaderboard', limit],
        queryFn: async () => {
            const response = await fetch(`/api/smart-money/leaderboard?limit=${limit}`);
            if (!response.ok) {
                throw new Error('Failed to fetch leaderboard');
            }
            const result = await response.json();
            return result.data as SmartMoneyWallet[];
        },
        refetchInterval: 60000, // Refetch every minute
    });
}

export function useWalletProfile(address: string | null) {
    return useQuery({
        queryKey: ['wallet-profile', address],
        queryFn: async () => {
            if (!address) throw new Error('No address provided');

            const response = await fetch(`/api/smart-money/wallet/${address}`);
            if (!response.ok) {
                throw new Error('Failed to fetch wallet profile');
            }
            const result = await response.json();
            return result.data;
        },
        enabled: !!address,
    });
}
