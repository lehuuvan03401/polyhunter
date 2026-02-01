import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';

export interface OpenOrder {
    orderId: string;
    tradeId: string;
    status: string;
    side: 'BUY' | 'SELL';
    size: number;
    price: number;
    market: string;
    filledSize: number;
}

export function useOpenOrders(walletAddress?: string) {
    const { authenticated } = usePrivy();
    const [orders, setOrders] = useState<OpenOrder[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authenticated || !walletAddress) {
            setOrders([]);
            return;
        }

        const fetchOrders = async () => {
            setIsLoading(true);
            try {
                // Fetch only OPEN or PENDING orders that lock funds
                // In a real scenario, we might want to filter by side=BUY for funds locking,
                // but usually for simplicity we track all open orders.
                // However, strictly speaking, only BUY orders lock USDC.
                // SELL orders lock tokens (outcome shares).
                // But let's fetch all 'OPEN' status orders.
                const res = await fetch(`/api/copy-trading/orders?wallet=${walletAddress}&status=OPEN`);
                if (!res.ok) throw new Error('Failed to fetch orders');

                const data = await res.json();
                setOrders(data.orders || []);
                setError(null);
            } catch (err) {
                console.error('Error fetching open orders:', err);
                setError('Failed to load open orders');
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrders();

        // Poll every 10 seconds
        const interval = setInterval(fetchOrders, 10000);
        return () => clearInterval(interval);

    }, [walletAddress, authenticated]);

    // Calculate total value of BUY orders (USDC locked)
    // Locked = (Size - Filled) * Price
    const lockedFunds = orders
        .filter(o => o.side === 'BUY')
        .reduce((sum, o) => {
            const remaining = o.size - (o.filledSize || 0);
            return sum + (remaining * o.price);
        }, 0);

    return {
        orders,
        lockedFunds, // Total USDC locked in open BUY orders
        isLoading,
        error
    };
}
