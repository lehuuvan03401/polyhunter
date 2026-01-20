
import { useState, useEffect } from 'react';

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
}

export function useSimulatedPositions(walletAddress: string, pollInterval = 3000) {
    const [positions, setPositions] = useState<SimulatedPosition[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!walletAddress) return;

        let isMounted = true;

        const fetchPositions = async () => {
            try {
                const res = await fetch(`/api/copy-trading/positions?wallet=${walletAddress}`);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) {
                        setPositions(data);
                        setIsLoading(false);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch simulated positions", err);
            }
        };

        fetchPositions();
        const interval = setInterval(fetchPositions, pollInterval);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [walletAddress, pollInterval]);

    return { positions, isLoading };
}
