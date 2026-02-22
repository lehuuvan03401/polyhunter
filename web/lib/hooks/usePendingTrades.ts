/**
 * usePendingTrades Hook
 * 
 * Fetches and manages pending copy trades that need user confirmation
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PendingTrade {
    id: string;
    configId: string;
    originalTrader: string;
    originalSide: 'BUY' | 'SELL';
    originalSize: number;
    originalPrice: number;
    marketSlug: string | null;
    conditionId: string | null;
    tokenId: string | null;
    outcome: string | null;
    copySize: number;
    status: string;
    detectedAt: string;
    expiresAt: string | null;
    config: {
        traderName: string | null;
        traderAddress: string;
    };
}

export function usePendingTrades(walletAddress: string | undefined) {
    const [pendingTrades, setPendingTrades] = useState<PendingTrade[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inFlightRef = useRef(false);

    const fetchPendingTrades = useCallback(async () => {
        if (!walletAddress) {
            setPendingTrades([]);
            return;
        }
        if (inFlightRef.current) return;

        inFlightRef.current = true;
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/copy-trading/execute?wallet=${walletAddress}`);
            if (!response.ok) {
                throw new Error('Failed to fetch pending trades');
            }
            const data = await response.json();
            setPendingTrades(data.pendingTrades || []);
        } catch (err) {
            console.error('Error fetching pending trades:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            setPendingTrades([]);
        } finally {
            inFlightRef.current = false;
            setIsLoading(false);
        }
    }, [walletAddress]);

    // Execute a pending trade
    const executeTrade = useCallback(async (
        tradeId: string,
        status: 'executed' | 'failed' | 'skipped',
        txHash?: string,
        errorMessage?: string
    ) => {
        if (!walletAddress) return false;

        try {
            const response = await fetch('/api/copy-trading/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-wallet-address': walletAddress.toLowerCase(),
                },
                body: JSON.stringify({
                    tradeId,
                    walletAddress,
                    status,
                    txHash,
                    errorMessage,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update trade status');
            }

            // Refresh the list
            await fetchPendingTrades();
            return true;
        } catch (err) {
            console.error('Error executing trade:', err);
            return false;
        }
    }, [walletAddress, fetchPendingTrades]);

    // Skip a pending trade
    const skipTrade = useCallback(async (tradeId: string) => {
        return executeTrade(tradeId, 'skipped', undefined, 'User skipped');
    }, [executeTrade]);

    // Fetch on mount and when wallet changes
    useEffect(() => {
        fetchPendingTrades();
    }, [fetchPendingTrades]);

    // Poll for new trades every 30 seconds
    useEffect(() => {
        if (!walletAddress) return;

        const interval = setInterval(fetchPendingTrades, 30000);
        return () => clearInterval(interval);
    }, [walletAddress, fetchPendingTrades]);

    return {
        pendingTrades,
        isLoading,
        error,
        refresh: fetchPendingTrades,
        executeTrade,
        skipTrade,
    };
}
