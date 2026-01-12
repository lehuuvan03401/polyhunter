/**
 * useOrderStatus Hook
 * 
 * React hook for monitoring copy trade order status
 * Polls for updates and provides real-time status information
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Order status types
export type OrderStatus = 'PENDING' | 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'EXPIRED' | 'REJECTED' | 'SETTLEMENT_PENDING';

export interface Order {
    tradeId: string;
    orderId: string | null;
    status: OrderStatus;
    side: string;
    size: number;
    price: number;
    market: string | null;
    tokenId: string | null;
    traderName: string | null;
    traderAddress: string;
    detectedAt: string;
    executedAt: string | null;
    errorMessage: string | null;
    filledSize: number;
    filledPercent: number;
}

// ... (keep interface UseOrderStatusReturn)

// Helper to get status color
export function getOrderStatusColor(status: OrderStatus): string {
    switch (status) {
        case 'FILLED':
            return 'text-green-400';
        case 'OPEN':
        case 'PARTIALLY_FILLED':
            return 'text-blue-400';
        case 'PENDING':
            return 'text-yellow-400';
        case 'SETTLEMENT_PENDING':
            return 'text-orange-400'; // Distinct color for settlement
        case 'CANCELLED':
        case 'EXPIRED':
            return 'text-gray-400';
        case 'REJECTED':
            return 'text-red-400';
        default:
            return 'text-muted-foreground';
    }
}

// Helper to get status icon
export function getOrderStatusIcon(status: OrderStatus): string {
    switch (status) {
        case 'FILLED':
            return '✓';
        case 'OPEN':
            return '◯';
        case 'PARTIALLY_FILLED':
            return '◐';
        case 'PENDING':
            return '○';
        case 'SETTLEMENT_PENDING':
            return '⇄'; // Settlement/Transfer icon
        case 'CANCELLED':
            return '✗';
        case 'EXPIRED':
            return '⌛';
        case 'REJECTED':
            return '✗';
        default:
            return '?';
    }
}
export interface OrderStats {
    total: number;
    pending: number;
    open: number;
    filled: number;
    failed: number;
}

interface UseOrderStatusOptions {
    /** Polling interval in ms (default: 10000) */
    pollInterval?: number;
    /** Only fetch specific statuses */
    statusFilter?: OrderStatus[];
    /** Auto-refresh on mount */
    autoRefresh?: boolean;
}

interface UseOrderStatusReturn {
    orders: Order[];
    stats: OrderStats;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    refreshOrderStatus: (orderIds: string[]) => Promise<void>;
    lastUpdated: Date | null;
}

export function useOrderStatus(
    walletAddress: string | undefined,
    options: UseOrderStatusOptions = {}
): UseOrderStatusReturn {
    const {
        pollInterval = 10000,
        statusFilter,
        autoRefresh = true,
    } = options;

    const [orders, setOrders] = useState<Order[]>([]);
    const [stats, setStats] = useState<OrderStats>({
        total: 0,
        pending: 0,
        open: 0,
        filled: 0,
        failed: 0,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch orders
    const refresh = useCallback(async () => {
        if (!walletAddress) return;

        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                wallet: walletAddress,
            });

            if (statusFilter && statusFilter.length > 0) {
                params.set('status', statusFilter[0]);
            }

            const response = await fetch(`/api/copy-trading/orders?${params}`);

            if (!response.ok) {
                throw new Error('Failed to fetch orders');
            }

            const data = await response.json();
            setOrders(data.orders || []);
            setStats(data.stats || {
                total: 0,
                pending: 0,
                open: 0,
                filled: 0,
                failed: 0,
            });
            setLastUpdated(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, [walletAddress, statusFilter]);

    // Refresh specific order statuses from CLOB
    const refreshOrderStatus = useCallback(async (orderIds: string[]) => {
        if (!walletAddress || orderIds.length === 0) return;

        try {
            const response = await fetch('/api/copy-trading/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress,
                    orderIds,
                }),
            });

            if (response.ok) {
                // Refresh full list after status check
                await refresh();
            }
        } catch (err) {
            console.error('Error refreshing order status:', err);
        }
    }, [walletAddress, refresh]);

    // Initial load
    useEffect(() => {
        if (walletAddress && autoRefresh) {
            refresh();
        }
    }, [walletAddress, autoRefresh, refresh]);

    // Polling
    useEffect(() => {
        if (!walletAddress || pollInterval <= 0) return;

        pollIntervalRef.current = setInterval(() => {
            refresh();
        }, pollInterval);

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, [walletAddress, pollInterval, refresh]);

    return {
        orders,
        stats,
        isLoading,
        error,
        refresh,
        refreshOrderStatus,
        lastUpdated,
    };
}


