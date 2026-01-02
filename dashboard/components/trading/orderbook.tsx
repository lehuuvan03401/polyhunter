'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OrderbookLevel {
    price: number;
    size: number;
    total: number;
}

interface OrderbookProps {
    bids: OrderbookLevel[];
    asks: OrderbookLevel[];
    spread?: number;
}

export function Orderbook({ bids, asks, spread }: OrderbookProps) {
    const maxTotal = Math.max(
        ...bids.map(b => b.total),
        ...asks.map(a => a.total)
    );

    return (
        <Card className="card-elegant">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-silver-100">Orderbook</CardTitle>
                    {spread && (
                        <span className="text-sm text-silver-400">
                            Spread: <span className="text-emerald-400">{(spread * 100).toFixed(2)}%</span>
                        </span>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {/* Header */}
                <div className="grid grid-cols-3 text-xs text-silver-500 uppercase tracking-wide pb-2 border-b border-silver-600/20">
                    <span>Price</span>
                    <span className="text-center">Size</span>
                    <span className="text-right">Total</span>
                </div>

                {/* Asks (sells) - reversed to show lowest at bottom */}
                <div className="space-y-1 py-2">
                    {[...asks].reverse().slice(0, 8).map((level, i) => (
                        <OrderbookRow
                            key={`ask-${i}`}
                            level={level}
                            maxTotal={maxTotal}
                            side="ask"
                        />
                    ))}
                </div>

                {/* Spread indicator */}
                <div className="py-2 border-y border-silver-600/20 text-center">
                    <span className="text-lg font-bold gradient-text">
                        {spread ? `${(spread * 100).toFixed(2)}%` : '—'}
                    </span>
                </div>

                {/* Bids (buys) */}
                <div className="space-y-1 py-2">
                    {bids.slice(0, 8).map((level, i) => (
                        <OrderbookRow
                            key={`bid-${i}`}
                            level={level}
                            maxTotal={maxTotal}
                            side="bid"
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function OrderbookRow({
    level,
    maxTotal,
    side
}: {
    level: OrderbookLevel;
    maxTotal: number;
    side: 'bid' | 'ask'
}) {
    const percentage = (level.total / maxTotal) * 100;
    const isBid = side === 'bid';

    return (
        <div className="relative grid grid-cols-3 text-sm py-1.5 px-2 rounded hover:bg-white/5 transition">
            {/* Background bar */}
            <div
                className={`absolute inset-0 rounded ${isBid ? 'bg-emerald-500/10' : 'bg-crimson-500/10'
                    }`}
                style={{
                    width: `${percentage}%`,
                    [isBid ? 'left' : 'right']: 0
                }}
            />

            {/* Content */}
            <span className={`relative ${isBid ? 'text-emerald-400' : 'text-crimson-400'} font-mono`}>
                {(level.price * 100).toFixed(1)}¢
            </span>
            <span className="relative text-center text-silver-300 font-mono">
                {level.size.toLocaleString()}
            </span>
            <span className="relative text-right text-silver-400 font-mono">
                {level.total.toLocaleString()}
            </span>
        </div>
    );
}

// Mock data generator for demo
export function generateMockOrderbook(): { bids: OrderbookLevel[]; asks: OrderbookLevel[]; spread: number } {
    const midPrice = 0.55;

    const bids: OrderbookLevel[] = [];
    const asks: OrderbookLevel[] = [];

    let bidTotal = 0;
    let askTotal = 0;

    for (let i = 0; i < 10; i++) {
        const bidSize = Math.floor(Math.random() * 5000) + 500;
        const askSize = Math.floor(Math.random() * 5000) + 500;
        bidTotal += bidSize;
        askTotal += askSize;

        bids.push({
            price: midPrice - (i + 1) * 0.005,
            size: bidSize,
            total: bidTotal,
        });

        asks.push({
            price: midPrice + (i + 1) * 0.005,
            size: askSize,
            total: askTotal,
        });
    }

    return {
        bids,
        asks,
        spread: (asks[0].price - bids[0].price) / midPrice
    };
}
