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

interface WalletProfile {
    address: string;
    pnl: number;
    volume: number;
    score: number;
    rank: number;
    winRate?: number;
    trades?: number;
    isSmartMoney?: boolean;
    pnlHistory?: Array<{ date: string; pnl: number }>;
    totalPnL?: number;
    realizedPnL?: number;
    unrealizedPnL?: number;
    avgPercentPnL?: number;
    positionCount?: number;
    tradeCount?: number;
    smartScore?: number;
    lastActiveAt?: Date;
}

interface Trade {
    id: string;
    timestamp: string;
    market: string;
    side: 'BUY' | 'SELL';
    outcome: 'YES' | 'NO';
    amount: number;
    price: number;
}

interface Position {
    id: string;
    market: string;
    outcome: 'YES' | 'NO';
    shares: number;
    avgPrice: number;
    currentValue: number;
    pnl: number;
}

// Smart money leaderboard
export function useSmartMoneyLeaderboard(limit: number = 50, period: string = '7d') {
    return useQuery<SmartMoneyWallet[]>({
        queryKey: ['smart-money-leaderboard', limit, period],
        queryFn: async () => {
            const response = await fetch(`/api/smart-money/leaderboard?limit=${limit}&period=${period}`);
            if (!response.ok) {
                throw new Error('Failed to fetch leaderboard');
            }
            const result = await response.json();
            return result.data;
        },
        refetchInterval: 60000,
    });
}

// Wallet profile with PnL history
export function useWalletProfile(address: string | null) {
    return useQuery<WalletProfile>({
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
        refetchInterval: 60000,
    });
}

// Wallet trades
export function useWalletTrades(address: string | null, limit: number = 50) {
    return useQuery<Trade[]>({
        queryKey: ['wallet-trades', address, limit],
        queryFn: async () => {
            if (!address) throw new Error('No address provided');

            const response = await fetch(`/api/smart-money/wallet/${address}/trades?limit=${limit}`);
            if (!response.ok) {
                throw new Error('Failed to fetch trades');
            }
            const result = await response.json();
            return result.data;
        },
        enabled: !!address,
        refetchInterval: 30000,
    });
}

// Wallet positions
export function useWalletPositions(address: string | null) {
    return useQuery<Position[]>({
        queryKey: ['wallet-positions', address],
        queryFn: async () => {
            if (!address) throw new Error('No address provided');

            const response = await fetch(`/api/smart-money/wallet/${address}/positions`);
            if (!response.ok) {
                throw new Error('Failed to fetch positions');
            }
            const result = await response.json();
            return result.data;
        },
        enabled: !!address,
        refetchInterval: 30000,
    });
}
