'use client';

import { useState, useEffect } from 'react';
import { TradeCard } from './trade-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Trade {
    id: string;
    trader: string;
    market: string;
    side: 'BUY' | 'SELL';
    outcome: 'YES' | 'NO';
    amount: number;
    price: number;
    timestamp: Date;
}

interface TradeFeedProps {
    maxTrades?: number;
}

// Mock trades for demo
const generateMockTrade = (): Trade => {
    const traders = [
        '0x742d35Cc6634C0532925a3b844Bc9e7595f9EC32',
        '0x1A2b3C4d5E6f7890AbCdEf1234567890aBcDeF12',
        '0x9876543210FeDcBa0987654321FeDcBa09876543',
        '0xDeadBeef123456789DeadBeef123456789DeaD00',
    ];

    const markets = [
        'Will Bitcoin reach $100k in 2025?',
        'US Presidential Election 2024',
        'Will ETH flip BTC by 2026?',
        'Next Fed interest rate decision',
        'SpaceX Mars landing by 2030?',
    ];

    return {
        id: Math.random().toString(36).slice(2),
        trader: traders[Math.floor(Math.random() * traders.length)],
        market: markets[Math.floor(Math.random() * markets.length)],
        side: Math.random() > 0.5 ? 'BUY' : 'SELL',
        outcome: Math.random() > 0.5 ? 'YES' : 'NO',
        amount: Math.floor(Math.random() * 5000) + 100,
        price: Math.random() * 0.8 + 0.1,
        timestamp: new Date(),
    };
};

export function TradeFeed({ maxTrades = 10 }: TradeFeedProps) {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [isLive, setIsLive] = useState(true);

    useEffect(() => {
        // Initialize with some trades
        const initialTrades = Array.from({ length: 5 }, () => {
            const trade = generateMockTrade();
            trade.timestamp = new Date(Date.now() - Math.random() * 300000); // Last 5 minutes
            return trade;
        }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        setTrades(initialTrades);

        if (!isLive) return;

        // Simulate real-time trades
        const interval = setInterval(() => {
            const newTrade = generateMockTrade();
            setTrades(prev => [newTrade, ...prev].slice(0, maxTrades));
        }, 3000 + Math.random() * 4000); // Random interval 3-7s

        return () => clearInterval(interval);
    }, [isLive, maxTrades]);

    return (
        <Card className="card-elegant">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-silver-100">Live Trade Feed</CardTitle>
                    <button
                        onClick={() => setIsLive(!isLive)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${isLive
                                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                                : 'bg-dark-700 border-silver-600/30 text-silver-400'
                            }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-silver-500'}`} />
                        <span className="text-sm font-medium">{isLive ? 'Live' : 'Paused'}</span>
                    </button>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {trades.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="text-3xl mb-3">📡</div>
                        <p className="text-silver-400">Waiting for trades...</p>
                    </div>
                ) : (
                    trades.map((trade, index) => (
                        <div key={trade.id} style={{ animationDelay: `${index * 50}ms` }}>
                            <TradeCard trade={trade} />
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}
